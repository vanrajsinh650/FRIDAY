import { PlannedAction, AgentContextSnapshot } from './types';
import { ModelProvider } from './providers/types';
import { ProviderFactory } from './providers/providerFactory';
import { VisionPerception } from './perception/visionPerception';
import { ResultRanker } from './perception/resultRanker';
import { PromptBuilder } from './promptBuilder';
import { ToolRegistry } from '../tools/registry';
import { ToolVisibility } from './prompt/toolVisibility';
import { GroundingEngine } from './perception/groundingEngine';

// --- Search query extraction -------------------------------------------------
// The command wrapper around a media request ("open youtube and play X",
// "youtube par X chalao") is not part of what the user wants searched. These
// patterns are peeled off repeatedly, so a query survives any combination of
// them in English or romanised Hindi. Peeling to an empty string is a valid
// outcome and means "no specific title named" — the caller then just plays
// whatever is first.

const QUERY_LEADING_PATTERNS: RegExp[] = [
  /^(hey|ok|okay|please)\s+/i,
  /^friday[,\s]+/i,
  /^(and|then)\s+/i,
  /^(open|launch|start)\s+/i,
  /^(youtube|yt|spotify)\s+/i,
  /^(search|find|play|show)\s+(for\s+|me\s+|the\s+)?/i,
  /^(the|a|an)\s+/i,
];

// Anchored with (?:^|\s) so a trailing modifier can consume the whole
// remainder — "play first video" must reduce to "" rather than "first video".
const QUERY_TRAILING_PATTERNS: RegExp[] = [
  /(?:^|\s)(and\s+)?(play|start)\s+(it|this|that)?$/i,
  /(?:^|\s)(the\s+)?(first)\s+(video|result|one|episode)?$/i,
  /(?:^|\s)(on\s+)?full\s*screen$/i,
  /(?:^|\s)(please)$/i,
  /(?:^|\s)(song|video|track)$/i,
  /(?:^|\s)(and|it|this|that)$/i,
];

// A result that is nothing but a filler noun carries no search intent.
const QUERY_FILLER_ONLY = new Set([
  'it',
  'this',
  'that',
  'video',
  'song',
  'track',
  'one',
  'something',
  'anything',
  'play',
]);

function peelPatterns(text: string, patterns: RegExp[]): string {
  let out = text;
  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of patterns) {
      const next = out.replace(pattern, ' ').trim();
      if (next !== out) {
        out = next;
        changed = true;
      }
    }
  }
  return out;
}

export function extractMediaQuery(rawGoal: string): string {
  let query = (rawGoal || '').trim().toLowerCase();

  // App references can appear mid-sentence ("... on youtube").
  query = query.replace(/\b(on|in)\s+(youtube|yt|spotify)\b/gi, ' ');
  query = query.replace(/\s+/g, ' ').trim();

  query = peelPatterns(query, QUERY_LEADING_PATTERNS);
  query = peelPatterns(query, QUERY_TRAILING_PATTERNS);
  query = query.replace(/\s+/g, ' ').trim();

  return QUERY_FILLER_ONLY.has(query) ? '' : query;
}

// --- Messaging intent extraction --------------------------------------------

export interface MessageIntent {
  contact: string;
  message: string;
}

const MSG_LEAD_STRIP: RegExp[] = [
  /^(hey|ok|okay|please)\s+/i,
  /^friday[,\s]+/i,
  /^(and|then)\s+/i,
  /^(open|launch|start)\s+whats\s*app\s+(and\s+|to\s+)?/i,
];

function stripAppMentions(s: string): string {
  return s
    .replace(/\b(on|via|using|through|from)\s+whats\s*app\b/gi, ' ')
    .replace(/\bwhats\s*app\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanContact(raw: string): string {
  let c = (raw || '').trim().replace(/^["'“”]+|["'“”]+$/g, '').trim();
  c = c.replace(/\b(on|via|using|through)\s+whats\s*app\b.*$/i, '').trim();
  c = stripAppMentions(c);
  c = c.replace(/^(to)\s+/i, '').trim();
  c = c.replace(/[.?!,]+$/, '').trim();
  return c;
}

function cleanMessage(raw: string): string {
  let m = (raw || '').trim();
  const quoted = m.match(/^["'“](.+?)["'”]$/);
  if (quoted) m = quoted[1];
  m = stripAppMentions(m).trim();
  m = m.replace(/[,]+$/, '').trim();
  return m;
}

export function extractMessageIntent(rawGoal: string): MessageIntent {
  let s = (rawGoal || '').trim();
  for (const p of MSG_LEAD_STRIP) s = s.replace(p, '').trim();

  // 1) An explicitly quoted message
  const quoted = s.match(/["'“](.+?)["'”]/);
  if (quoted) {
    const message = quoted[1].trim();
    const after = s.slice((quoted.index || 0) + quoted[0].length);
    const toM = after.match(/\bto\s+(.+)$/i) || s.match(/\bto\s+(.+)$/i);
    let contact = '';
    if (toM) contact = cleanContact(toM[1]);
    return { contact, message: cleanMessage(message) };
  }

  // 2) English: "send <message> to <contact>"
  let m = s.match(/\bsend\s+(.+?)\s+to\s+(.+)$/i);
  if (m) return { contact: cleanContact(m[2]), message: cleanMessage(m[1]) };

  // 3) English: "message|msg|text <contact> saying|that <message>"
  m = s.match(/\b(?:message|msg|text)\s+(.+?)\s+(?:saying|that)\s+(.+)$/i);
  if (m) return { contact: cleanContact(m[1]), message: cleanMessage(m[2]) };

  // 4) English fallback: "message|msg|text <contact-token> <message...>"
  m = s.match(/\b(?:message|msg|text)\s+(\S+)\s+(.+)$/i);
  if (m) return { contact: cleanContact(m[1]), message: cleanMessage(m[2]) };

  return { contact: '', message: '' };
}

export class Planner {
  private provider: ModelProvider;

  constructor(provider?: ModelProvider) {
    this.provider = provider || ProviderFactory.createDefault();
  }

  private buildResultClick(snapshot: AgentContextSnapshot, rawGoal: string): PlannedAction {
    const query = extractMediaQuery(rawGoal || '');
    const best = ResultRanker.pickBestResult(snapshot.screenTree, query);
    if (best) {
      return {
        id: `step_${Date.now()}`,
        toolName: 'click_first_result',
        parameters: { nodeId: best.node.id, matchedTitle: best.matchedTitle },
        description: `Play best match: "${best.matchedTitle}"`,
      };
    }
    return {
      id: `step_${Date.now()}`,
      toolName: 'click_first_result',
      parameters: {},
      description: 'Click first video result',
    };
  }

  async planNextAction(snapshot: AgentContextSnapshot): Promise<PlannedAction> {
    const task = snapshot.activeTask;
    const currentPkg = snapshot.screenTree.activePackage.toLowerCase();
    const actionCount = task?.actionHistory.length || 0;
    const lastAction = actionCount > 0 ? task!.actionHistory[actionCount - 1] : null;
    const lowerGoal = (task?.rawGoal || '').toLowerCase();

    // 1. Pure App Launch Fast-Path
    if (task?.goalType === 'APP_OPERATION') {
      if (actionCount === 0) {
        const appToOpen = (
          task.currentApp ||
          lowerGoal
            .replace(/^(open|launch|start|khol|chalu|please open|go in|go into|go to|head into|take me to)\s+/i, '')
            .replace(/\s+app$/i, '')
        ).trim();
        return {
          id: `step_${Date.now()}`,
          toolName: 'launch_app',
          parameters: { packageNameOrName: appToOpen },
          description: `Launch ${appToOpen}`,
        };
      }
      if (lastAction?.toolName === 'launch_app' || lastAction?.toolName === 'open_camera') {
        return {
          id: `step_${Date.now()}`,
          toolName: 'none',
          parameters: {},
          description: 'App opened successfully.',
        };
      }
    }

    // 2. Hardware / Quick Toggles Fast-Path
    if (task?.goalType === 'SYSTEM_CONTROL' && actionCount >= 1) {
      return {
        id: `step_${Date.now()}`,
        toolName: 'none',
        parameters: {},
        description: 'Action executed successfully.',
      };
    }

    // 3. Media Playback Goal (e.g. "Open YouTube and play first video on full screen", "Play Taarak Mehta")
    if (task?.goalType === 'MEDIA_PLAYBACK') {
      const inYouTube = currentPkg.includes('youtube');

      if (!inYouTube) {
        const history = task.actionHistory;
        const launchCount = history.filter((a) => a.toolName === 'launch_app').length;
        const waitCount = history.filter((a) => a.toolName === 'wait_for_element').length;
        if (launchCount === 0) {
          return {
            id: `step_${Date.now()}`,
            toolName: 'launch_app',
            parameters: { packageNameOrName: 'youtube' },
            description: 'Launch YouTube app',
          };
        }
        if (waitCount < 4) {
          return {
            id: `step_${Date.now()}`,
            toolName: 'wait_for_element',
            parameters: { query: 'search', timeoutMs: 2500 },
            description: 'Wait for YouTube to come to the foreground',
          };
        }
        return {
          id: `step_${Date.now()}`,
          toolName: 'none',
          parameters: {},
          description: 'YouTube did not open to a readable screen.',
        };
      }

      const isFullScreenRequested = lowerGoal.includes('full screen') || lowerGoal.includes('fullscreen');

      if (lastAction?.toolName === 'enter_fullscreen') {
        return {
          id: `step_${Date.now()}`,
          toolName: 'none',
          parameters: {},
          description: 'Video is playing in full screen!',
        };
      }

      const clickedResult = task.actionHistory.some((a) => a.toolName === 'click_first_result');
      if (clickedResult) {
        if (isFullScreenRequested && lastAction?.toolName !== 'enter_fullscreen') {
          return {
            id: `step_${Date.now()}`,
            toolName: 'enter_fullscreen',
            parameters: {},
            description: 'Expand video to full screen',
          };
        }

        let lastClickIdx = -1;
        for (let i = task.actionHistory.length - 1; i >= 0; i--) {
          if (task.actionHistory[i].toolName === 'click_first_result') {
            lastClickIdx = i;
            break;
          }
        }
        const sinceClick = lastClickIdx >= 0 ? task.actionHistory.slice(lastClickIdx + 1) : [];
        const verifyAttempts = sinceClick.filter(
          (a) => a.toolName === 'verify_playback_active' || a.toolName === 'wait_for_element'
        ).length;

        if (verifyAttempts === 0) {
          return {
            id: `step_${Date.now()}`,
            toolName: 'verify_playback_active',
            parameters: {},
            description: 'Confirm the video is actually playing',
          };
        }
        if (verifyAttempts < 3) {
          return {
            id: `step_${Date.now()}`,
            toolName: 'wait_for_element',
            parameters: { query: 'pause', timeoutMs: 2500 },
            description: 'Wait for the player transport controls to confirm playback',
          };
        }
        return {
          id: `step_${Date.now()}`,
          toolName: 'verify_playback_active',
          parameters: {},
          description: 'Final playback verification',
        };
      }

      if (lastAction?.toolName === 'press_enter') {
        return this.buildResultClick(snapshot, task.rawGoal);
      }

      const songQuery = extractMediaQuery(task?.rawGoal || '');
      const isGenericPlay = songQuery.length === 0;

      if (!isGenericPlay && songQuery.length > 1) {
        const editableBox = snapshot.screenTree.nodes.find((n) => n.isEditable);
        const searchBox =
          editableBox ||
          snapshot.screenTree.nodes.find((n) => {
            const desc = (n.contentDescription || '').toLowerCase();
            const text = (n.text || '').toLowerCase();
            const id = (n.id || '').toLowerCase();
            if (desc.includes('voice') || desc.includes('mic') || desc.includes('speak') || text.includes('voice') || text.includes('mic')) {
              return false;
            }
            return desc.includes('search') || text.includes('search') || id.includes('search_button') || id.includes('menu_search');
          });

        if (searchBox) {
          if (searchBox.isEditable) {
            if (lastAction?.toolName !== 'type_text') {
              return {
                id: `step_${Date.now()}`,
                toolName: 'type_text',
                parameters: { text: songQuery, clearFirst: true },
                description: `Type "${songQuery}" into search`,
              };
            } else {
              return {
                id: `step_${Date.now()}`,
                toolName: 'press_enter',
                parameters: {},
                description: 'Submit search query',
              };
            }
          } else {
            return {
              id: `step_${Date.now()}`,
              toolName: 'click_node',
              parameters: { nodeId: searchBox.id || 'search_button' },
              description: 'Tap Search icon in YouTube',
            };
          }
        }
      }

      return this.buildResultClick(snapshot, task?.rawGoal || '');
    }

    // 4. Messaging Goal (e.g. "Open WhatsApp and send 'hi' to Vanrajsinh")
    if (task?.goalType === 'MESSAGING') {
      const inWhatsApp = currentPkg.includes('whatsapp');

      if (!inWhatsApp) {
        const history = task.actionHistory;
        const launchCount = history.filter((a) => a.toolName === 'launch_app').length;
        const waitCount = history.filter((a) => a.toolName === 'wait_for_element').length;
        if (launchCount === 0) {
          return {
            id: `step_${Date.now()}`,
            toolName: 'launch_app',
            parameters: { packageNameOrName: 'whatsapp' },
            description: 'Launch WhatsApp',
          };
        }
        if (waitCount < 4) {
          return {
            id: `step_${Date.now()}`,
            toolName: 'wait_for_element',
            parameters: { query: 'search', timeoutMs: 2500 },
            description: 'Wait for WhatsApp to come to the foreground',
          };
        }
        return {
          id: `step_${Date.now()}`,
          toolName: 'none',
          parameters: {},
          description: 'WhatsApp did not open to a readable screen.',
        };
      }

      const { contact, message } = extractMessageIntent(task.rawGoal);
      const nodes = snapshot.screenTree.nodes;
      const nodeLabel = (n: { contentDescription?: string; text?: string }) =>
        `${n.contentDescription || ''} ${n.text || ''}`;

      let lastSendIdx = -1;
      for (let i = task.actionHistory.length - 1; i >= 0; i--) {
        if (task.actionHistory[i].toolName === 'click_send_button') {
          lastSendIdx = i;
          break;
        }
      }
      if (lastSendIdx >= 0) {
        const sinceSend = task.actionHistory.slice(lastSendIdx + 1);
        const verifyAttempts = sinceSend.filter(
          (a) => a.toolName === 'verify_message_sent' || a.toolName === 'wait_for_element'
        ).length;
        if (verifyAttempts === 0) {
          return {
            id: `step_${Date.now()}`,
            toolName: 'verify_message_sent',
            parameters: message ? { expectedSnippet: message } : {},
            description: 'Confirm the message actually sent',
          };
        }
        if (verifyAttempts < 2) {
          return {
            id: `step_${Date.now()}`,
            toolName: 'wait_for_element',
            parameters: { query: 'delivered', timeoutMs: 2500 },
            description: 'Wait for the sent/delivered marker',
          };
        }
        return {
          id: `step_${Date.now()}`,
          toolName: 'verify_message_sent',
          parameters: message ? { expectedSnippet: message } : {},
          description: 'Final send verification',
        };
      }

      const composer = nodes.find(
        (n) => n.isEditable && /message/i.test(nodeLabel(n)) && !/search/i.test(nodeLabel(n))
      );
      const hasSendButton = nodes.some((n) => /\bsend\b/i.test(nodeLabel(n)));
      if (composer) {
        const composerText = (composer.text || '').toLowerCase();
        const composerHasMsg = message.length > 0 && composerText.includes(message.toLowerCase());
        if (lastAction?.toolName === 'type_text' || hasSendButton || composerHasMsg) {
          return {
            id: `step_${Date.now()}`,
            toolName: 'click_send_button',
            parameters: {},
            description: 'Tap Send to deliver the message',
          };
        }
        if (message.length > 0) {
          return {
            id: `step_${Date.now()}`,
            toolName: 'type_text',
            parameters: { text: message, clearFirst: true },
            description: `Type the message: "${message}"`,
          };
        }
      } else if (contact.length > 0) {
        const searchBox =
          nodes.find((n) => n.isEditable) ||
          nodes.find((n) => /search/i.test(nodeLabel(n)));
        if (searchBox) {
          const resultNode = nodes.find(
            (n) => !n.isEditable && (n.text || '').toLowerCase().includes(contact.toLowerCase())
          );
          if (resultNode) {
            return {
              id: `step_${Date.now()}`,
              toolName: 'click_text',
              parameters: { text: contact },
              description: `Open chat with ${contact}`,
            };
          }
          if (lastAction?.toolName !== 'type_text') {
            return {
              id: `step_${Date.now()}`,
              toolName: 'type_text',
              parameters: { text: contact, clearFirst: true },
              description: `Search for ${contact}`,
            };
          }
          return {
            id: `step_${Date.now()}`,
            toolName: 'click_text',
            parameters: { text: contact },
            description: `Open chat with ${contact}`,
          };
        }
      }
    }

    // --- High-Intelligence LLM Reasoning (tiered router) ---
    const messages = PromptBuilder.buildSystemPrompt(snapshot);
    const tools = ToolVisibility.getScopedTools(snapshot.goalType, snapshot.screenTree.activePackage);
    const perceived = await VisionPerception.augment(messages, snapshot);

    const toolCall = await this.provider.generateToolCall(perceived, tools);

    return {
      id: `step_${Date.now()}`,
      toolName: toolCall.toolName,
      parameters: toolCall.parameters,
      description: toolCall.rawReply || `Execute ${toolCall.toolName}`,
    };
  }

  async createPlan(snapshot: AgentContextSnapshot): Promise<PlannedAction[]> {
    const nextAction = await this.planNextAction(snapshot);
    return [nextAction];
  }
}

