export interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

export interface ModelProvider {
  name: string;
  generateText(messages: ModelMessage[]): Promise<string>;
  generateToolCall(messages: ModelMessage[], tools: any[]): Promise<{ toolName: string; parameters: any; rawReply?: string }>;
}
