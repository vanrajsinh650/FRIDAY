import { NativeModules, NativeEventEmitter } from 'react-native';
import { useVoiceStore } from '../state/voiceStore';
import { TelemetryLogger } from '../utils/telemetry';
import { TTSRequest } from './types';

const { FridayTTSNative } = NativeModules;

export class PocketTTSEngine {
  private static eventEmitter: NativeEventEmitter | null = null;

  private static getEmitter(): NativeEventEmitter | null {
    if (!this.eventEmitter && FridayTTSNative) {
      this.eventEmitter = new NativeEventEmitter(FridayTTSNative);
    }
    return this.eventEmitter;
  }

  static async speak(request: TTSRequest): Promise<void> {
    const startTime = Date.now();
    useVoiceStore.getState().setSpeaking(true);
    TelemetryLogger.recordEvent('TASK_STARTED', { type: 'TTS_STREAM_STARTED', text: request.text });

    if (FridayTTSNative?.speak) {
      return new Promise<void>((resolve, reject) => {
        const emitter = this.getEmitter();
        let startSub: any = null;
        let doneSub: any = null;
        let errorSub: any = null;

        const cleanup = () => {
          startSub?.remove();
          doneSub?.remove();
          errorSub?.remove();
        };

        if (emitter) {
          startSub = emitter.addListener('onTTSStart', () => {
            TelemetryLogger.recordEvent('TASK_STARTED', {
              type: 'TTS_FIRST_AUDIO_CHUNK',
              latencyMs: Date.now() - startTime,
            });
          });

          doneSub = emitter.addListener('onTTSDone', () => {
            cleanup();
            useVoiceStore.getState().setSpeaking(false);
            resolve();
          });

          errorSub = emitter.addListener('onTTSError', () => {
            cleanup();
            useVoiceStore.getState().setSpeaking(false);
            resolve(); // Fallback gracefully on audio end
          });
        }

        FridayTTSNative.speak(request.text, request.speed || 1.0, 1.0).catch((err: any) => {
          cleanup();
          useVoiceStore.getState().setSpeaking(false);
          resolve();
        });
      });
    }

    // Dev/Test Fallback
    return new Promise((resolve) => {
      useVoiceStore.getState().setSpeaking(false);
      resolve();
    });
  }

  static stop(): void {
    if (FridayTTSNative?.stop) {
      FridayTTSNative.stop();
    }
    useVoiceStore.getState().setSpeaking(false);
  }
}
