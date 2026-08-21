# FRIDAY — Model Provider Architecture

---

## 1. Model Provider Abstraction Interface

FRIDAY is never hardcoded to a single LLM vendor. The architecture uses a unified provider interface:

```typescript
// src/agent/providers/types.ts
export interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: any[];
}

export interface ModelProvider {
  name: string;
  generateText(messages: ModelMessage[], options?: { temperature?: number }): Promise<string>;
  streamText(messages: ModelMessage[], onChunk: (token: string) => void): Promise<string>;
  generateToolPlan(messages: ModelMessage[], tools: any[]): Promise<{ toolName: string; parameters: any }>;
}
```

---

## 2. Provider Implementations & Performance Targets

| Provider | Model | Latency (TTFT) | Primary Role |
| :--- | :--- | :--- | :--- |
| **GroqProvider** | Llama 3.3 70B / 8B | ~150-250ms | **Default Fast Agent & Planner** |
| **NvidiaProvider**| Llama 3.3 70B / Mistral | ~200-350ms | Fast Alternative Provider |
| **OpenAIProvider**| DeepSeek V3 / R1 | ~400-800ms | Complex Multi-Step Reasoning |
| **LocalProvider** | Llama.cpp / Ollama | ~800-1500ms | Offline Emergency Fallback |