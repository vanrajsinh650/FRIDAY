import { create } from 'zustand';
import { VoiceSessionState } from '../voice/voiceStateMachine';

export interface VoiceStore {
  isWakeWordListening: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
  rmsLevel: number; // 0.0 to 1.0 audio waveform amplitude
  transcriptStream: string;
  finalTranscript: string | null;
  ttsEngine: 'pocket-tts' | 'kittentts' | 'native-fallback';
  sessionState: string;
  
  setWakeWordListening: (active: boolean) => void;
  setRecording: (active: boolean) => void;
  setSpeaking: (active: boolean) => void;
  setRmsLevel: (level: number) => void;
  setTranscriptStream: (text: string) => void;
  setFinalTranscript: (text: string | null) => void;
  setTtsEngine: (engine: 'pocket-tts' | 'kittentts' | 'native-fallback') => void;
  setSessionState: (state: string) => void;
}

export const useVoiceStore = create<VoiceStore>((set) => ({
  isWakeWordListening: false,
  isRecording: false,
  isSpeaking: false,
  rmsLevel: 0,
  transcriptStream: '',
  finalTranscript: null,
  ttsEngine: 'pocket-tts',
  sessionState: 'SLEEPING',

  setWakeWordListening: (isWakeWordListening) => set({ isWakeWordListening }),
  setRecording: (isRecording) => set({ isRecording }),
  setSpeaking: (isSpeaking) => set({ isSpeaking }),
  setRmsLevel: (rmsLevel) => set({ rmsLevel }),
  setTranscriptStream: (transcriptStream) => set({ transcriptStream }),
  setFinalTranscript: (finalTranscript) => set({ finalTranscript }),
  setTtsEngine: (ttsEngine) => set({ ttsEngine }),
  setSessionState: (sessionState) => set({ sessionState }),
}));
