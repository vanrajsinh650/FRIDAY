import { create } from 'zustand';
import { getSecret } from '../config/secrets';

export interface SettingsStore {
  groqApiKey: string;
  nvidiaApiKey: string;
  openaiApiKey: string;
  vpsServerUrl: string;
  defaultModelProvider: 'groq' | 'nvidia' | 'nvidia-vision' | 'openai' | 'local';
  modelName: string;
  nvidiaModel: string;
  nvidiaVisionModel: string;
  speculativePipeliningEnabled: boolean;
  visionFallbackEnabled: boolean;
  wakeWordSensitivity: number;
  hapticFeedback: boolean;
  
  setSettings: (settings: Partial<SettingsStore>) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  groqApiKey: getSecret('GROQ_API_KEY'),
  nvidiaApiKey: getSecret('NVIDIA_API_KEY'),
  openaiApiKey: getSecret('OPENAI_API_KEY'),
  vpsServerUrl: 'http://localhost:8000',
  defaultModelProvider: 'groq',
  modelName: 'openai/gpt-oss-20b',
  // Small/fast model for NVIDIA's text planning (it's the fallback now that Groq
  // is primary, so keep it quick). 70B lives on as the safe fallback in the
  // provider if this is ever cleared. Vision stays on the large VLM.
  nvidiaModel: 'meta/llama-3.1-8b-instruct',
  nvidiaVisionModel: 'meta/llama-3.2-90b-vision-instruct',
  speculativePipeliningEnabled: true,
  visionFallbackEnabled: true,
  wakeWordSensitivity: 0.7,
  hapticFeedback: true,

  setSettings: (updates) => set((state) => ({ ...state, ...updates })),
}));
