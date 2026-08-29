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
  updateManifestUrl: string;
  
  setSettings: (settings: Partial<SettingsStore>) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  groqApiKey: getSecret('GROQ_API_KEY'),
  nvidiaApiKey: getSecret('NVIDIA_API_KEY'),
  openaiApiKey: getSecret('OPENAI_API_KEY'),
  vpsServerUrl: 'http://localhost:8000',
  defaultModelProvider: 'groq',
  modelName: 'llama-3.1-8b-instant',
  nvidiaModel: 'nvidia/llama-3.1-nemotron-70b-instruct',
  nvidiaVisionModel: 'meta/llama-3.2-90b-vision-instruct',
  speculativePipeliningEnabled: true,
  visionFallbackEnabled: true,
  wakeWordSensitivity: 0.7,
  hapticFeedback: true,
  updateManifestUrl: 'https://raw.githubusercontent.com/Friday-AI/releases/main/update.json',

  setSettings: (updates) => set((state) => ({ ...state, ...updates })),
}));
