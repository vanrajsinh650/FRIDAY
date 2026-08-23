import { NativeModules, DeviceEventEmitter } from 'react-native';
import { useVoiceStore } from '../state/voiceStore';
import { useSettingsStore } from '../state/settingsStore';
import { getSecret } from '../config/secrets';
import { TelemetryLogger } from '../utils/telemetry';
import { VoiceTelemetry } from './voiceTelemetry';
import { TTSRequest } from './types';

const { FridayTTSNative } = NativeModules;

/**
 * PocketTTSEngine — Ultra-Realistic Studio-Quality Neural Voice Engine for FRIDAY.
 *
 * Synthesizes high-fidelity, natural female speech and manages playback lifecycles,
 * promise resolution, audio ducking, and telemetry.
 */
export class PocketTTSEngine {
  private static currentSpeakPromise: Promise<void> | null = null;
  private static activeUtteranceId: string | null = null;
  private static activeCleanup: (() => void) | null = null;
  private static currentResolve: (() => void) | null = null;

  static async init(): Promise<void> {
    if (FridayTTSNative?.setConfig) {
      await FridayTTSNative.setConfig('', 'en-IE-EmilyNeural', 'edge-neural');
    }
  }

  static async speak(request: TTSRequest): Promise<void> {
    const textToSpeak = (request?.text || '').trim();
    if (!textToSpeak) return Promise.resolve();

    const startTime = Date.now();
    useVoiceStore.getState().setSpeaking(true);
    TelemetryLogger.recordEvent('TASK_STARTED', { type: 'TTS_STREAM_STARTED', text: textToSpeak });

    // Clean up and resolve any prior utterance cleanly
    if (this.currentResolve) {
      const prevResolve = this.currentResolve;
      this.currentResolve = null;
      prevResolve();
    }
    if (this.activeCleanup) {
      this.activeCleanup();
      this.activeCleanup = null;
    }

    if (!FridayTTSNative?.speak) {
      useVoiceStore.getState().setSpeaking(false);
      return Promise.resolve();
    }

    if (FridayTTSNative?.setConfig) {
      FridayTTSNative.setConfig('', 'en-IE-EmilyNeural', 'edge-neural');
    }

    const speakPromise = new Promise<void>((resolve) => {
      let startSub: any = null;
      let doneSub: any = null;
      let errorSub: any = null;
      let timeoutHandle: any = null;
      let isResolved = false;

      const cleanup = () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        startSub?.remove();
        doneSub?.remove();
        errorSub?.remove();
        startSub = null;
        doneSub = null;
        errorSub = null;
        PocketTTSEngine.activeCleanup = null;
        PocketTTSEngine.currentResolve = null;
      };

      const finishUtterance = () => {
        if (isResolved) return;
        isResolved = true;
        cleanup();
        useVoiceStore.getState().setSpeaking(false);
        PocketTTSEngine.currentSpeakPromise = null;
        PocketTTSEngine.activeUtteranceId = null;
        resolve();
      };

      PocketTTSEngine.activeCleanup = cleanup;
      PocketTTSEngine.currentResolve = finishUtterance;

      // Generous max duration guard based on text length to prevent cutting off slow network neural voices
      const maxDurationMs = Math.max(8000, Math.min(60000, textToSpeak.length * 150));
      timeoutHandle = setTimeout(() => {
        finishUtterance();
      }, maxDurationMs);

      startSub = DeviceEventEmitter.addListener('onTTSStart', (data: any) => {
        const latency = Date.now() - startTime;
        TelemetryLogger.recordEvent('TASK_STARTED', {
          type: 'TTS_FIRST_AUDIO_CHUNK',
          latencyMs: latency,
        });
        VoiceTelemetry.recordLatency('ttsFirstAudioLatency', latency);
      });

      doneSub = DeviceEventEmitter.addListener('onTTSDone', (data: any) => {
        if (data?.utteranceId && PocketTTSEngine.activeUtteranceId &&
            data.utteranceId !== PocketTTSEngine.activeUtteranceId) {
          return;
        }
        const duration = Date.now() - startTime;
        VoiceTelemetry.recordLatency('ttsDuration', duration);
        finishUtterance();
      });

      errorSub = DeviceEventEmitter.addListener('onTTSError', (data: any) => {
        if (data?.utteranceId && PocketTTSEngine.activeUtteranceId &&
            data.utteranceId !== PocketTTSEngine.activeUtteranceId) {
          return;
        }
        finishUtterance();
      });

      FridayTTSNative.speak(textToSpeak, request.speed || 1.0, 1.0)
        .then((utteranceId: string) => {
          if (utteranceId) {
            PocketTTSEngine.activeUtteranceId = utteranceId;
          }
        })
        .catch(() => {
          finishUtterance();
        });
    });

    this.currentSpeakPromise = speakPromise;
    return speakPromise;
  }

  static async waitForCompletion(maxWaitMs: number = 25000): Promise<void> {
    if (this.currentSpeakPromise) {
      let timeoutHandle: any;
      await Promise.race([
        this.currentSpeakPromise,
        new Promise<void>((resolve) => {
          timeoutHandle = setTimeout(resolve, maxWaitMs);
        })
      ]).finally(() => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      });
    }
  }

  static stop(): void {
    if (FridayTTSNative?.stop) {
      FridayTTSNative.stop();
    }
    if (this.activeCleanup) {
      this.activeCleanup();
      this.activeCleanup = null;
    }
    if (this.currentResolve) {
      this.currentResolve();
      this.currentResolve = null;
    }
    this.currentSpeakPromise = null;
    this.activeUtteranceId = null;
    useVoiceStore.getState().setSpeaking(false);
  }
}
