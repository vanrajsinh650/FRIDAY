import { useTelemetryStore } from '../state/telemetryStore';
import { TelemetryLogger } from '../utils/telemetry';

export enum VoiceErrorType {
  WAKE_MISSED = 'WAKE_MISSED',
  WAKE_FALSE_POSITIVE = 'WAKE_FALSE_POSITIVE',
  MIC_CAPTURE_ERROR = 'MIC_CAPTURE_ERROR',
  VAD_CUTOFF = 'VAD_CUTOFF',
  ENDPOINT_TOO_EARLY = 'ENDPOINT_TOO_EARLY',
  ENDPOINT_TOO_LATE = 'ENDPOINT_TOO_LATE',
  STT_ERROR = 'STT_ERROR',
  STT_LOW_CONFIDENCE = 'STT_LOW_CONFIDENCE',
  ENTITY_MISRECOGNITION = 'ENTITY_MISRECOGNITION',
  LLM_INTENT_ERROR = 'LLM_INTENT_ERROR',
  TTS_ERROR = 'TTS_ERROR',
  TTS_PRONUNCIATION_ERROR = 'TTS_PRONUNCIATION_ERROR',
  AUDIO_FOCUS_ERROR = 'AUDIO_FOCUS_ERROR',
  BARGE_IN_FAILURE = 'BARGE_IN_FAILURE',
}

export interface VoiceDiagnostics {
  wakeState: string;
  wakeConfidence: number;
  audioRms: number;
  noiseFloor: number;
  vadState: boolean;
  speechDuration: number;
  partialTranscript: string;
  stableTranscript: string;
  finalTranscript: string;
  sttProvider: string;
  sttLatency: number;
  endpointReason: string;
  llmFirstTokenLatency: number;
  firstActionLatency: number;
  ttsProvider: string;
  ttsFirstAudioLatency: number;
  ttsDuration: number;
  interruptLatency: number;
  conversationTurn: number;
  errorClassification: VoiceErrorType | null;
}

export interface VoiceTurnMetrics {
  turnNumber: number;
  timestamps: {
    speechEnd: number;
    finalTranscriptReady: number;
    firstModelDecision: number;
    firstAndroidAction: number;
    firstSpokenResponse: number;
    ttsFirstAudio: number;
    ttsDone: number;
  };
  latencies: {
    sttLatencyMs: number;           // speechEnd -> finalTranscript
    llmFirstTokenMs: number;        // finalTranscript -> firstModelDecision
    firstActionMs: number;          // speechEnd -> firstAndroidAction
    firstResponseMs: number;        // speechEnd -> firstSpokenResponse
    ttsFirstAudioMs: number;        // speak call -> first audio chunk
    totalTurnMs: number;            // speechEnd -> ttsDone
  };
  transcript: {
    raw: string;
    corrected: string;
    corrections: Array<{ original: string; corrected: string }>;
    wordCount: number;
  };
  endpointReason: string;
  errorType: VoiceErrorType | null;
}

class VoiceTelemetryClass {
  private currentDiagnostics: VoiceDiagnostics = this.createEmptyDiagnostics();
  private turnMetrics: VoiceTurnMetrics[] = [];
  private currentTurnNumber = 0;
  private listeners: Array<(diagnostics: VoiceDiagnostics) => void> = [];

  private createEmptyDiagnostics(): VoiceDiagnostics {
    return {
      wakeState: 'UNKNOWN',
      wakeConfidence: 0,
      audioRms: 0,
      noiseFloor: -60,
      vadState: false,
      speechDuration: 0,
      partialTranscript: '',
      stableTranscript: '',
      finalTranscript: '',
      sttProvider: 'android-speech-recognizer',
      sttLatency: 0,
      endpointReason: '',
      llmFirstTokenLatency: 0,
      firstActionLatency: 0,
      ttsProvider: 'android-tts',
      ttsFirstAudioLatency: 0,
      ttsDuration: 0,
      interruptLatency: 0,
      conversationTurn: 0,
      errorClassification: null,
    };
  }

  updateDiagnostic(field: keyof VoiceDiagnostics, value: any): void {
    (this.currentDiagnostics as any)[field] = value;
    this.notifyListeners();
  }

  updateMultiple(updates: Partial<VoiceDiagnostics>): void {
    Object.assign(this.currentDiagnostics, updates);
    this.notifyListeners();
  }

  getDiagnostics(): VoiceDiagnostics {
    return { ...this.currentDiagnostics };
  }

  startNewTurn(): void {
    this.currentTurnNumber++;
    this.currentDiagnostics.conversationTurn = this.currentTurnNumber;
    this.currentDiagnostics.partialTranscript = '';
    this.currentDiagnostics.stableTranscript = '';
    this.currentDiagnostics.finalTranscript = '';
    this.currentDiagnostics.errorClassification = null;
    this.currentDiagnostics.endpointReason = '';
  }

  recordTranscriptTurn(turn: {
    rawTranscript: string;
    correctedTranscript: string;
    corrections: Array<{ original: string; corrected: string }>;
    endpointReason: string;
    durationMs: number;
    confidence: number;
  }): void {
    this.currentDiagnostics.finalTranscript = turn.rawTranscript;
    this.currentDiagnostics.sttLatency = turn.durationMs;
    this.currentDiagnostics.endpointReason = turn.endpointReason;
    this.notifyListeners();
  }

  recordError(errorType: VoiceErrorType, details?: string): void {
    this.currentDiagnostics.errorClassification = errorType;
    TelemetryLogger.recordEvent('TASK_FAILED', {
      type: 'VOICE_ERROR',
      errorType,
      details,
      turn: this.currentTurnNumber,
    });
    this.notifyListeners();
  }

  recordLatency(field: 'sttLatency' | 'llmFirstTokenLatency' | 'firstActionLatency' | 'ttsFirstAudioLatency' | 'ttsDuration' | 'interruptLatency', valueMs: number): void {
    this.currentDiagnostics[field] = valueMs;
    this.notifyListeners();
  }

  getTurnMetrics(): VoiceTurnMetrics[] {
    return [...this.turnMetrics];
  }

  onDiagnosticsUpdate(listener: (diagnostics: VoiceDiagnostics) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    const snapshot = { ...this.currentDiagnostics };
    for (const listener of this.listeners) {
      try { listener(snapshot); } catch (_) {}
    }
  }

  reset(): void {
    this.currentDiagnostics = this.createEmptyDiagnostics();
    this.currentTurnNumber = 0;
    this.turnMetrics = [];
  }
}

export const VoiceTelemetry = new VoiceTelemetryClass();
