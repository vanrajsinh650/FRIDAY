// A model message may carry either plain text (the common case) or a list of
// content parts. The parts form is how OpenAI-compatible endpoints (Groq,
// NVIDIA NIM) accept mixed text + image input, so a screenshot can be handed to
// a vision model in the same call. Text-only providers still accept the parts
// array, so widening `content` is backward compatible on the wire.

export interface TextContentPart {
  type: 'text';
  text: string;
}

export interface ImageContentPart {
  type: 'image_url';
  image_url: { url: string; detail?: 'low' | 'high' | 'auto' };
}

export type MessageContentPart = TextContentPart | ImageContentPart;

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | MessageContentPart[];
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

export interface ToolCallResult {
  toolName: string;
  parameters: any;
  rawReply?: string;
}

export interface ModelProvider {
  name: string;
  // Whether this provider can reason over image content parts. The router only
  // attaches a screenshot when the chosen reasoner advertises this.
  supportsVision?: boolean;
  generateText(messages: ModelMessage[]): Promise<string>;
  generateToolCall(messages: ModelMessage[], tools: any[]): Promise<ToolCallResult>;
  // Network-only tool reasoning that skips any local intent fast-path. The
  // router runs the shared fast-path once (Tier 0) and then calls this on each
  // reasoner so the deterministic regexes aren't re-evaluated per provider.
  // Providers without a local fast-path can omit this; the router falls back to
  // generateToolCall.
  reasonToolCall?(messages: ModelMessage[], tools: any[]): Promise<ToolCallResult>;
}

// Flatten a message's content down to plain text — used by the deterministic
// intent fast-path and by any provider path that needs a string (e.g. the
// merged system prompt). Image parts contribute nothing to the text view.
export function extractText(content: string | MessageContentPart[] | undefined): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  return content
    .filter((p): p is TextContentPart => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

// True when any message carries an image part — the signal a provider uses to
// select a vision-capable model for the call.
export function hasImageContent(messages: ModelMessage[]): boolean {
  return messages.some(
    (m) => Array.isArray(m.content) && m.content.some((p) => p.type === 'image_url')
  );
}

// Wrap a base64 JPEG (as returned by AccessibilityService.takeScreenshot) in a
// data URL. Passing an already-formed data URL through is a no-op.
export function toImageDataUrl(base64Jpeg: string): string {
  return base64Jpeg.startsWith('data:') ? base64Jpeg : `data:image/jpeg;base64,${base64Jpeg}`;
}
