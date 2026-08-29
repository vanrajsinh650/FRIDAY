import { ModelMessage, ModelProvider, ToolCallResult, hasImageContent } from './types';
import { useSettingsStore } from '../../state/settingsStore';
import { getSecret } from '../../config/secrets';
import { Logger } from '../../utils/logger';
import { fetchWithTimeout, TEXT_REQUEST_TIMEOUT_MS, VISION_REQUEST_TIMEOUT_MS } from './httpClient';

export class NvidiaProvider implements ModelProvider {
  name = 'nvidia';
  supportsVision = true;
  private baseUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';
  private defaultModel = 'meta/llama-3.3-70b-instruct';

  private getApiKey(): string {
    return useSettingsStore.getState().nvidiaApiKey || getSecret('NVIDIA_API_KEY');
  }

  // Pick a vision-capable model only when the call actually carries an image;
  // text-only reasoning stays on the cheaper/faster text model. The text model
  // is settings-tunable (defaults to a fast 8B); defaultModel is the safe 70B
  // fallback used only if the setting is cleared.
  private modelFor(messages: ModelMessage[]): string {
    if (hasImageContent(messages)) {
      return useSettingsStore.getState().nvidiaVisionModel || 'meta/llama-3.2-90b-vision-instruct';
    }
    return useSettingsStore.getState().nvidiaModel || this.defaultModel;
  }

  async generateText(messages: ModelMessage[]): Promise<string> {
    const apiKey = this.getApiKey();
    try {
      const response = await fetchWithTimeout(
        this.baseUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: this.modelFor(messages),
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            temperature: 0.2,
            max_tokens: 500,
          }),
        },
        hasImageContent(messages) ? VISION_REQUEST_TIMEOUT_MS : TEXT_REQUEST_TIMEOUT_MS
      );

      if (!response.ok) {
        throw new Error(`NVIDIA API error (${response.status}): ${await response.text()}`);
      }

      const data = await response.json();
      return data?.choices?.[0]?.message?.content || '';
    } catch (err: any) {
      Logger.error('NVIDIA generateText error', err);
      throw err;
    }
  }

  async generateToolCall(messages: ModelMessage[], tools: any[]): Promise<ToolCallResult> {
    const apiKey = this.getApiKey();
    // A hard failure (no network, non-2xx, unparseable body) THROWS so the
    // router can fall back to the next reasoner. Returning a sentinel here would
    // silently swallow NVIDIA being down and strand the user on a dead primary.
    const formattedTools = (tools || []).map((t) => {
      if (t.type === 'function' && t.function) return t;
      return {
        type: 'function',
        function: {
          name: t.name || t.function?.name,
          description: t.description || t.function?.description,
          parameters: t.parameters || t.function?.parameters || { type: 'object', properties: {} },
        },
      };
    });

    const response = await fetchWithTimeout(
      this.baseUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelFor(messages),
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          tools: formattedTools,
          tool_choice: 'auto',
          temperature: 0.1,
          max_tokens: 300,
        }),
      },
      hasImageContent(messages) ? VISION_REQUEST_TIMEOUT_MS : TEXT_REQUEST_TIMEOUT_MS
    );

    if (!response.ok) {
      throw new Error(`NVIDIA tool call error (${response.status}): ${await response.text()}`);
    }

    const data = await response.json();
    const choice = data?.choices?.[0]?.message;

    if (choice?.tool_calls && choice.tool_calls.length > 0) {
      const call = choice.tool_calls[0];
      const parsedArgs = JSON.parse(call.function.arguments || '{}');
      return {
        toolName: call.function.name,
        parameters: parsedArgs,
        rawReply: choice.content || undefined,
      };
    }

    // Model chose to answer in prose instead of calling a tool — surface that as
    // a spoken conversational reply, not as a screen-inspection sentinel.
    if (choice?.content) {
      return { toolName: 'none', parameters: { reply: choice.content }, rawReply: choice.content };
    }

    // No tool call and no content is a non-answer; let the router try the next
    // reasoner rather than committing to a blind inspect.
    throw new Error('NVIDIA returned neither a tool call nor content');
  }

  // NVIDIA has no local fast-path, so network reasoning IS the tool-call path.
  reasonToolCall(messages: ModelMessage[], tools: any[]): Promise<ToolCallResult> {
    return this.generateToolCall(messages, tools);
  }
}
