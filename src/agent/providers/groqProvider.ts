import { ModelMessage, ModelProvider, ToolCallResult, extractText } from './types';
import { resolveIntent } from './intentFastPath';
import { useSettingsStore } from '../../state/settingsStore';
import { getSecret } from '../../config/secrets';
import { Logger } from '../../utils/logger';
import { fetchWithTimeout } from './httpClient';

export class GroqProvider implements ModelProvider {
  name = 'groq';
  private baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
  private defaultModel = 'llama-3.1-8b-instant';

  private getApiKey(): string {
    return useSettingsStore.getState().groqApiKey || getSecret('GROQ_API_KEY');
  }

  async generateText(
    messages: ModelMessage[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Groq API key not configured');
    }

    try {
      const response = await fetchWithTimeout(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: useSettingsStore.getState().modelName || this.defaultModel,
          messages,
          temperature: options?.temperature ?? 0.2,
          max_tokens: options?.maxTokens ?? 1024,
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API error (${response.status}): ${await response.text()}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (err) {
      Logger.error('Groq generateText error', err);
      throw err;
    }
  }

  async generateToolCall(messages: ModelMessage[], tools: any[]): Promise<ToolCallResult> {
    // Tier 0 — deterministic local intents (offline, no network).
    const lastUserMsg = extractText(messages.find((m) => m.role === 'user')?.content)
      .toLowerCase()
      .trim();
    const fast = resolveIntent(lastUserMsg);
    if (fast) return fast;

    // No key means we cannot reach the model; fall back to inspecting the screen
    // rather than fabricating an action.
    if (!this.getApiKey()) {
      return { toolName: 'inspect_screen', parameters: {} };
    }

    return this.reasonToolCall(messages, tools);
  }

  // Network-only reasoning (Llama 3.3 70B on Groq). The router calls this
  // directly after running the shared fast-path, so it never re-evaluates the
  // deterministic intents here.
  async reasonToolCall(messages: ModelMessage[], tools: any[]): Promise<ToolCallResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { toolName: 'inspect_screen', parameters: {} };
    }

    try {
      const toolDescriptions = tools
        .map((t) => `- ${t.function.name}: ${t.function.description}`)
        .join('\n');

      const existingSystemPrompt = extractText(messages.find((m) => m.role === 'system')?.content);

      const fullSystemPrompt = `${existingSystemPrompt}

[TOOL INVOCATION PROTOCOL]
You have access to the following tools:
${toolDescriptions}

[DECISION RULES]
1. If the user is asking a GENERAL QUESTION, chatting, or seeking advice/information:
Provide a cute, kind, warm, natural, and concise spoken answer (2-3 conversational sentences exclusively in clear English) using:
{"toolName": "none", "parameters": {"reply": "<your_spoken_answer>"}}
2. If the user wants phone UI control or device settings, choose the appropriate tool primitive:
{"toolName": "<name_of_tool>", "parameters": {<tool_parameters>}}
3. Output MUST be ONLY valid JSON. NEVER include explanations outside the JSON.`;

      const promptMessages = [
        { role: 'system', content: fullSystemPrompt },
        ...messages.filter((m) => m.role !== 'system'),
      ];

      const response = await fetchWithTimeout(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: useSettingsStore.getState().modelName || this.defaultModel,
          messages: promptMessages,
          temperature: 0.25,
          max_tokens: 350,
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API error (${response.status}): ${await response.text()}`);
      }

      const data = await response.json();
      const content = (data.choices?.[0]?.message?.content || '').trim();

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.toolName) {
            const replyText = parsed.parameters?.reply || (parsed.toolName === 'none' ? content : undefined);
            return {
              toolName: parsed.toolName,
              parameters: parsed.parameters || {},
              rawReply: replyText,
            };
          }
        } catch (_) {}
      }

      return {
        toolName: 'none',
        parameters: { reply: content },
        rawReply: content,
      };
    } catch (err: any) {
      // A network failure or timeout must THROW, not return a spoken reply.
      // The router treats a {toolName:'none', reply} result as a confident
      // answer and stops — so swallowing the error here would strand the user on
      // "I'm on it, boss." instead of letting the next reasoner (NVIDIA) try.
      Logger.error('Groq reasonToolCall error', err);
      throw err;
    }
  }
}
