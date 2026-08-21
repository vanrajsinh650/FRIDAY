import { useVoiceStore } from '../state/voiceStore';
import { TelemetryLogger } from '../utils/telemetry';
import { STTResult } from './types';

export class SpeechRecognizer {
  static async recognizeSpeech(onInterim: (text: string) => void): Promise<STTResult> {
    const startTime = Date.now();
    TelemetryLogger.recordEvent('STT_STARTED', { timestamp: startTime });

    return new Promise((resolve) => {
      let ticks = 0;
      const interimText = 'Open YouTube and search Taarak Mehta';
      
      const interval = setInterval(() => {
        ticks++;
        if (ticks === 1) {
          onInterim('Open YouTube...');
          useVoiceStore.getState().setTranscriptStream('Open YouTube...');
          TelemetryLogger.recordEvent('STT_RESULT', { interim: true, latencyMs: Date.now() - startTime });
        } else if (ticks === 2) {
          onInterim('Open YouTube and search Taarak Mehta');
          useVoiceStore.getState().setTranscriptStream('Open YouTube and search Taarak Mehta');
        } else {
          clearInterval(interval);
          const finalLatency = Date.now() - startTime;
          useVoiceStore.getState().setFinalTranscript(interimText);
          resolve({
            transcript: interimText,
            isFinal: true,
            confidence: 0.98,
            latencyMs: finalLatency,
          });
        }
      }, 100);
    });
  }
}
