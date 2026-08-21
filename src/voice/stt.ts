import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { useVoiceStore } from '../state/voiceStore';
import { TelemetryLogger } from '../utils/telemetry';
import { STTResult } from './types';

const { FridaySpeechRecognizerNative } = NativeModules;

export class SpeechRecognizer {
  private static eventEmitter: NativeEventEmitter | null = null;

  private static getEmitter(): NativeEventEmitter | null {
    if (!this.eventEmitter && FridaySpeechRecognizerNative) {
      this.eventEmitter = new NativeEventEmitter(FridaySpeechRecognizerNative);
    }
    return this.eventEmitter;
  }

  static async recognizeSpeech(
    onInterim: (text: string) => void,
    language: string = 'en-US'
  ): Promise<STTResult> {
    const startTime = Date.now();
    TelemetryLogger.recordEvent('STT_STARTED', { timestamp: startTime });

    if (FridaySpeechRecognizerNative?.startListening) {
      return new Promise<STTResult>((resolve, reject) => {
        const emitter = this.getEmitter();
        let partialSub: any = null;
        let finalSub: any = null;
        let errorSub: any = null;
        let rmsSub: any = null;

        const cleanup = () => {
          partialSub?.remove();
          finalSub?.remove();
          errorSub?.remove();
          rmsSub?.remove();
        };

        if (emitter) {
          partialSub = emitter.addListener('onSpeechPartialResult', (data: { transcript: string }) => {
            if (data?.transcript) {
              onInterim(data.transcript);
              useVoiceStore.getState().setTranscriptStream(data.transcript);
              TelemetryLogger.recordEvent('STT_RESULT', { interim: true, latencyMs: Date.now() - startTime });
            }
          });

          rmsSub = emitter.addListener('onSpeechRmsChanged', (data: { rmsLevel: number }) => {
            if (typeof data?.rmsLevel === 'number') {
              useVoiceStore.getState().setRmsLevel(data.rmsLevel);
            }
          });

          finalSub = emitter.addListener('onSpeechFinalResult', (data: { transcript: string }) => {
            cleanup();
            const latencyMs = Date.now() - startTime;
            const transcript = data?.transcript || '';
            useVoiceStore.getState().setFinalTranscript(transcript);
            resolve({
              transcript,
              isFinal: true,
              confidence: 0.95,
              latencyMs,
            });
          });

          errorSub = emitter.addListener('onSpeechError', (data: { errorMessage: string; errorCode: number }) => {
            cleanup();
            reject(new Error(data?.errorMessage || 'Speech recognition failed'));
          });
        }

        FridaySpeechRecognizerNative.startListening(language).catch((err: any) => {
          cleanup();
          reject(err);
        });
      });
    }

    // Dev/Test Environment Fallback
    return new Promise((resolve) => {
      const fallbackText = 'Open YouTube';
      onInterim(fallbackText);
      useVoiceStore.getState().setTranscriptStream(fallbackText);
      useVoiceStore.getState().setFinalTranscript(fallbackText);
      resolve({
        transcript: fallbackText,
        isFinal: true,
        confidence: 0.9,
        latencyMs: Date.now() - startTime,
      });
    });
  }

  static async stopListening(): Promise<void> {
    if (FridaySpeechRecognizerNative?.stopListening) {
      await FridaySpeechRecognizerNative.stopListening();
    }
  }

  static async cancelListening(): Promise<void> {
    if (FridaySpeechRecognizerNative?.cancelListening) {
      await FridaySpeechRecognizerNative.cancelListening();
    }
  }
}
