import { ModelMessage, ModelProvider, ToolCallResult, extractText } from './types';
import { resolveIntent } from './intentFastPath';

export class LocalProvider implements ModelProvider {
  name = 'local';
  async generateText(messages: ModelMessage[]): Promise<string> {
    return 'FRIDAY offline engine ready.';
  }
  async generateToolCall(messages: ModelMessage[], tools: any[]): Promise<ToolCallResult> {
    const lastUserMsg = extractText(messages.find((m) => m.role === 'user')?.content)
      .toLowerCase()
      .trim();
    const fast = resolveIntent(lastUserMsg);
    if (fast) return fast;

    return {
      toolName: 'none',
      parameters: { reply: "I'm right here with you, boss. What can I do for you?" },
      rawReply: "I'm right here with you, boss. What can I do for you?",
    };
  }
}

