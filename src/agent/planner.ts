import { PlannedAction, AgentContextSnapshot } from './types';
import { ModelProvider } from './providers/types';
import { ProviderFactory } from './providers/providerFactory';
import { VisionPerception } from './perception/visionPerception';
import { ResultRanker } from './perception/resultRanker';
import { PromptBuilder } from './promptBuilder';
import { ToolRegistry } from '../tools/registry';
import { ToolVisibility } from './prompt/toolVisibility';

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
    // Default to the tiered router (Tier-0 fast-path → primary reasoner →
    // fallbacks) built from settings. Tests can inject a provider directly.
    this.provider = provider || ProviderFactory.createDefault();
  }

  // Choose which result to open. Ranks the visible result cards against the
  // media query and taps the best match by node id; when no card clears a
  // relevance bar (or the request named no specific title), falls back to the
  // platform's own first result. Downstream branch logic keys on the
  // 'click_first_result' tool name, so selection stays reasoned without
  // disturbing the fullscreen / verification flow.
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

    // --- Fast-Path Heuristics for Goal Completion ---

    // 1. Pure App Launch Goal (ONLY when there's no secondary action like play/search/send)
    //    "open youtube" = yes, "open youtube and play video" = NO (that's MEDIA_PLAYBACK)
    if (task?.goalType === 'APP_OPERATION') {
      if (lastAction?.toolName === 'launch_app' || lastAction?.toolName === 'open_camera') {
        return {
          id: `step_${Date.now()}`,
          toolName: 'none',
          parameters: {},
          description: 'App opened successfully.',
        };
      }
    }

    // 2. System Control & Queries (Torch, Volume, Time, Battery, Alarms, Notifications)
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

      // Step A: Launch YouTube — but launch it exactly ONCE. If we already
      // launched and the screen still doesn't read as YouTube, the app is
      // either still cold-starting or momentarily unreadable. Relaunching just
      // reopens YouTube over and over (the "opened YouTube many times" bug), so
      // we wait a couple of settle cycles instead, then stop so the honesty
      // gate reports the truth rather than spamming launches.
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

      // If full screen was already executed, we're done
      if (lastAction?.toolName === 'enter_fullscreen') {
        return {
          id: `step_${Date.now()}`,
          toolName: 'none',
          parameters: {},
          description: 'Video is playing in full screen!',
        };
      }

      // If we just clicked the first video:
      // Post-click verification phase: once we've tapped a result we must NOT
      // self-declare success. Clicking is not proof of playback — an ad, a load
      // error, or a mis-tap all look identical at click time. Give playback a
      // bounded chance to surface real evidence (the loop's terminal check
      // verifies on audio/transport controls); if it never does, stop producing
      // progress so the honesty gate reports the truth instead of falsely
      // claiming the video started.
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
        // Exhausted verification without evidence — one final honest check, then
        // let the loop wind down to the truthful "couldn't confirm" report.
        return {
          id: `step_${Date.now()}`,
          toolName: 'verify_playback_active',
          parameters: {},
          description: 'Final playback verification',
        };
      }

      // If search was submitted, click the best-matching result (ranked over the
      // visible list rather than blindly taking the first card).
      if (lastAction?.toolName === 'press_enter') {
        return this.buildResultClick(snapshot, task.rawGoal);
      }

      // Extract the search query (empty = no specific title named, just play first)
      const songQuery = extractMediaQuery(task?.rawGoal || '');
      const isGenericPlay = songQuery.length === 0;

      // If specific search query exists, perform search workflow
      if (!isGenericPlay && songQuery.length > 1) {
        const editableBox = snapshot.screenTree.nodes.find((n) => n.isEditable);
        const searchBox =
          editableBox ||
          snapshot.screenTree.nodes.find(
            (n) =>
              (n.contentDescription || '').toLowerCase().includes('search') ||
              (n.text || '').toLowerCase().includes('search')
          );

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

      // Fallback: no search box found — rank whatever results are visible and
      // open the best match (or the first card when nothing ranks confidently).
      return this.buildResultClick(snapshot, task?.rawGoal || '');
    }

    // 4. Messaging Goal (e.g. "Open WhatsApp and send 'hi' to Vanrajsinh")
    if (task?.goalType === 'MESSAGING') {
      const inWhatsApp = currentPkg.includes('whatsapp');

      // Launch WhatsApp exactly ONCE, then wait for it to settle rather than
      // relaunching every step when the screen isn't yet readable as WhatsApp.
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

      // Check if send button is visible in composer
      const { contact, message } = extractMessageIntent(task.rawGoal);
      const nodes = snapshot.screenTree.nodes;
      const nodeLabel = (n: { contentDescription?: string; text?: string }) =>
        `${n.contentDescription || ''} ${n.text || ''}`;

      // --- Post-send verification gate (honesty) ---------------------------
      // Clicking Send is NOT proof of delivery — a mis-tap, a crash, or a
      // pending network all look identical at click time. After a send, demand
      // real evidence (the outgoing bubble / delivered marker, checked by the
      // terminal condition) before we ever claim success. This mirrors the
      // playback-verification gate and never returns 'none', so if the message
      // never lands the loop winds down to the truthful "couldn't confirm".
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

      // --- Inside the conversation (composer visible) ----------------------
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
        // No message text parsed — defer to the reasoner rather than guess.
      } else if (contact.length > 0) {
        // --- Chat list → search for and open the target conversation -------
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
    // Tier-0 deterministic intents live inside the router. Here we build the
    // tree-based prompt and, when the tree is too sparse to act on, escalate to
    // an on-demand screenshot for a vision model — never on every step.
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
