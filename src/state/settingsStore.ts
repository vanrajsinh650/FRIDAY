import { create } from 'zustand';

export interface SettingsStore {
  groqApiKey: string;
  nvidiaApiKey: string;
  openaiApiKey: string;
  vpsServerUrl: string;
  defaultModelProvider: 'groq' | 'nvidia' | 'openai' | 'local';
  modelName: string;
  speculativePipeliningEnabled: boolean;
  visionFallbackEnabled: boolean;
  wakeWordSensitivity: number;
  hapticFeedback: boolean;
  
  setSettings: (settings: Partial<SettingsStore>) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  groqApiKey: '',
  nvidiaApiKey: '',
  openaiApiKey: '',
  vpsServerUrl: 'http://localhost:8000',
  defaultModelProvider: 'groq',
  modelName: 'llama-3.3-70b-versatile',
  speculativePipeliningEnabled: true,
  visionFallbackEnabled: true,
  wakeWordSensitivity: 0.7,
  hapticFeedback: true,

  setSettings: (updates) => set((state) => ({ ...state, ...updates })),
}));
