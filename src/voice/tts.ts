import { useVoiceStore } from '../state/voiceStore';
import { TelemetryLogger } from '../utils/telemetry';
import { TTSRequest } from './types';

export class PocketTTSEngine {
  static async speak(request: TTSRequest): Promise<void> {
    const startTime = Date.now();
    useVoiceStore.getState().setSpeaking(true);
    TelemetryLogger.recordEvent('TASK_STARTED', { type: 'TTS_STREAM_STARTED', text: request.text });

    // Emulate CPU-first streaming audio chunk delivery (<150ms TTFA)
    return new Promise((resolve) => {
      setTimeout(() => {
        TelemetryLogger.recordEvent('TASK_STARTED', { type: 'TTS_FIRST_AUDIO_CHUNK', latencyMs: Date.now() - startTime });
      }, 120);

      // Duration proportional to text length
      const speechDuration = Math.max(800, request.text.length * 45);
      setTimeout(() => {
        useVoiceStore.getState().setSpeaking(false);
        resolve();
      }, speechDuration);
    });
  }

  static stop(): void {
    useVoiceStore.getState().setSpeaking(false);
  }
}
