import { ModelMessage, ModelProvider, ToolCallResult, extractText, hasImageContent } from './types';
import { resolveIntent } from './intentFastPath';
import { Logger } from '../../utils/logger';

// Collapse any image parts out of the messages so a text-only reasoner receives
// a valid text payload (it still gets the full accessibility-tree text). Used
// when a non-vision fallback is reached with a screenshot attached.
function stripImageParts(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((m) => {
    if (typeof m.content === 'string') return m;
    const text = m.content
      .filter((p) => p.type === 'text')
      .map((p) => (p as { text: string }).text)
      .join('\n');
    return { ...m, content: text };
  });
}

// Tiered reasoning router.
//
//   Tier 0  — resolveIntent: deterministic local intents, offline, zero latency.
//   Tier 1+ — network reasoners in priority order (primary, then fallbacks).
//             The first confident answer wins; a reasoner that throws or returns
//             a non-answer sentinel is skipped so the next one gets a turn.
//
// "Never everything at once": exactly one tier resolves a call. The fast-path
// short-circuits the common cases; only genuinely open-ended requests reach the
// network, and even then providers are tried in sequence, not fanned out.
export class ProviderRouter implements ModelProvider {
  name = 'router';
  supportsVision: boolean;
  private chain: ModelProvider[];

  constructor(primary: ModelProvider, fallbacks: ModelProvider[] = []) {
    this.chain = [primary, ...fallbacks];
    this.supportsVision = this.chain.some((p) => p.supportsVision === true);
  }

  // A result is unconfident when it is the bare "inspect the screen" sentinel a
  // stub provider emits to mean "I have no real answer". Anything with real
  // parameters or a spoken reply counts as a genuine decision.
  private isConfident(res: ToolCallResult | null): res is ToolCallResult {
    if (!res || !res.toolName) return false;
    const noParams = !res.parameters || Object.keys(res.parameters).length === 0;
    if (res.toolName === 'inspect_screen' && noParams && !res.rawReply) return false;
    return true;
  }

  async generateToolCall(messages: ModelMessage[], tools: any[]): Promise<ToolCallResult> {
    // Tier 0 — local deterministic intents.
    const userMsgs = messages.filter((m) => m.role === 'user');
    const lastUser = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1] : undefined;
    let lastUserMsg = extractText(lastUser?.content)
      .toLowerCase()
      .trim();
    if (lastUserMsg.includes('[screen vision]') || lastUserMsg.includes('[live screen vision]')) {
      lastUserMsg = lastUserMsg.split(/\[(live\s+)?screen\s+vision\]/i)[0].trim();
    }
    const fast = resolveIntent(lastUserMsg);
    if (fast) return fast;

    if (process.env.NODE_ENV === 'test') {
      return { toolName: 'none', parameters: {} };
    }

    // Tier 1+ — network reasoners in order.
    const carriesImage = hasImageContent(messages);
    // When the call carries a screenshot, try vision-capable reasoners first so
    // the image isn't wasted: a text-only primary (e.g. Groq) would otherwise
    // consume the turn on stripped text and the VLM fallback would never run.
    // Stable sort keeps the configured priority within each capability group.
    const chain = carriesImage
      ? [...this.chain].sort((a, b) => Number(b.supportsVision === true) - Number(a.supportsVision === true))
      : this.chain;
    for (const provider of chain) {
      try {
        // A text-only reasoner can't use a screenshot; hand it the tree text.
        const payload = carriesImage && !provider.supportsVision ? stripImageParts(messages) : messages;
        const reason = provider.reasonToolCall
          ? provider.reasonToolCall.bind(provider)
          : provider.generateToolCall.bind(provider);
        const res = await reason(payload, tools);
        if (this.isConfident(res)) return res;
        Logger.warn(`Router: ${provider.name} returned a non-answer, trying next reasoner`);
      } catch (err: any) {
        Logger.warn(`Router: ${provider.name} failed (${err?.message || err}), trying next reasoner`);
      }
    }

    // Every reasoner failed — inspect the screen rather than fabricate an action.
    return { toolName: 'inspect_screen', parameters: {} };
  }

  async generateText(messages: ModelMessage[]): Promise<string> {
    for (const provider of this.chain) {
      try {
        const text = await provider.generateText(messages);
        if (text && text.trim().length > 0) return text;
      } catch (err: any) {
        Logger.warn(`Router: ${provider.name} generateText failed (${err?.message || err})`);
      }
    }
    return '';
  }
}
