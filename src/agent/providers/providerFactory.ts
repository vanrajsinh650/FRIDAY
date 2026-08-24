import { ModelProvider } from './types';
import { GroqProvider } from './groqProvider';
import { NvidiaProvider } from './nvidiaProvider';
import { NvidiaVisionProvider } from './nvidiaVisionProvider';
import { OpenAIProvider } from './openaiProvider';
import { LocalProvider } from './localProvider';
import { ProviderRouter } from './providerRouter';
import { useSettingsStore } from '../../state/settingsStore';

export type ProviderName = 'groq' | 'nvidia' | 'nvidia-vision' | 'openai' | 'local';

export class ProviderFactory {
  static create(name: ProviderName): ModelProvider {
    switch (name) {
      case 'nvidia':
        return new NvidiaProvider();
      case 'nvidia-vision':
        return new NvidiaVisionProvider();
      case 'openai':
        return new OpenAIProvider();
      case 'local':
        return new LocalProvider();
      case 'groq':
      default:
        return new GroqProvider();
    }
  }

  // Build the default tiered router: the settings-selected provider is primary,
  // followed by the remaining providers as fallbacks. Groq (fastest inference +
  // rich fast-path + solid function calling) is the default primary; NVIDIA
  // follows as the vision-capable fallback; Local is the offline last resort.
  // The shared Tier-0 fast-path lives in the router, so the primary only handles
  // what the deterministic intents don't.
  static createDefault(): ModelProvider {
    const primaryName = useSettingsStore.getState().defaultModelProvider as ProviderName;
    const preferenceOrder: ProviderName[] = ['nvidia', 'groq', 'openai', 'local'];
    const chainNames = [primaryName, ...preferenceOrder.filter((n) => n !== primaryName)];
    const [primary, ...fallbacks] = chainNames.map((n) => this.create(n));
    return new ProviderRouter(primary, fallbacks);
  }
}
