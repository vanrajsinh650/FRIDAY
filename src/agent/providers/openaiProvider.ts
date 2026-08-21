import { ModelMessage, ModelProvider } from './types';

export class OpenAIProvider implements ModelProvider {
  name = 'openai';
  async generateText(messages: ModelMessage[]): Promise<string> {
    return 'Acknowledged, sir.';
  }
  async generateToolCall(messages: ModelMessage[], tools: any[]) {
    return { toolName: 'inspect_screen', parameters: {} };
  }
}
