export interface AudioChunk {
  pcmData: Int16Array;
  sampleRate: number;
  channels: number;
  rms: number;
  timestamp: number;
}

export interface STTResult {
  transcript: string;
  isFinal: boolean;
  confidence: number;
  latencyMs: number;
}

export interface TTSRequest {
  text: string;
  voice?: string;
  speed?: number;
  onAudioChunk?: (pcmChunk: ArrayBuffer) => void;
}
