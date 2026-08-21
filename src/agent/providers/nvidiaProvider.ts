import { ModelMessage, ModelProvider } from './types';

export class NvidiaProvider implements ModelProvider {
  name = 'nvidia';
  async generateText(messages: ModelMessage[]): Promise<string> {
    return 'Action executed by FRIDAY.';
  }
  async generateToolCall(messages: ModelMessage[], tools: any[]) {
    return { toolName: 'inspect_screen', parameters: {} };
  }
}
