import { ModelMessage, ModelProvider } from './types';

export class LocalProvider implements ModelProvider {
  name = 'local';
  async generateText(messages: ModelMessage[]): Promise<string> {
    return 'FRIDAY offline engine ready.';
  }
  async generateToolCall(messages: ModelMessage[], tools: any[]) {
    return { toolName: 'get_battery_status', parameters: {} };
  }
}
