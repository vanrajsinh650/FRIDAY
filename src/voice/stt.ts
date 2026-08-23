import { NativeModules, DeviceEventEmitter } from 'react-native';
import { useVoiceStore } from '../state/voiceStore';
import { TelemetryLogger } from '../utils/telemetry';
import { STTResult } from './types';
import { TranscriptAccumulator, TranscriptTurn } from './transcriptAccumulator';
import { VoiceTelemetry } from './voiceTelemetry';
import { ActionSafetyGuard } from './actionSafetyGuard';
import { getSecret } from '../config/secrets';

const { FridaySpeechRecognizerNative } = NativeModules;

export class SpeechRecognizer {
  static accumulator = new TranscriptAccumulator();
  private static activeSessionCleanup: (() => void) | null = null;

  static async recognizeSpeech(
    onInterim: (text: string) => void,
    language: string = 'en-US'
  ): Promise<STTResult> {
    const startTime = Date.now();
    TelemetryLogger.recordEvent('STT_STARTED', { timestamp: startTime });

    // Abort any existing pending session cleanly before starting a new one
    if (this.activeSessionCleanup) {
      this.activeSessionCleanup();
      this.activeSessionCleanup = null;
    }

    if (!FridaySpeechRecognizerNative?.startListening) {
      return {
        transcript: '',
        isFinal: true,
        confidence: 0,
        latencyMs: 0,
      };
    }

    // Sync current Groq API Key to native HAL
    try {
      const groqKey = getSecret('GROQ_API_KEY');
      if (groqKey && FridaySpeechRecognizerNative?.setApiKey) {
        FridaySpeechRecognizerNative.setApiKey(groqKey).catch(() => {});
      }
    } catch (_e) {}

    return new Promise<STTResult>((resolve) => {
      let partialSub: any = null;
      let finalSub: any = null;
      let errorSub: any = null;
      let rmsSub: any = null;
      let initialSilenceTimer: any = null;
      let activityWatchdogTimer: any = null;
      let maxSessionTimer: any = null;
      let lastPartial = '';
      let accumulatedTranscript = '';
      let isResolved = false;

      this.accumulator.startTurn();

      const resetActivityWatchdog = () => {
        if (initialSilenceTimer) {
          clearTimeout(initialSilenceTimer);
          initialSilenceTimer = null;
        }
        if (activityWatchdogTimer) {
          clearTimeout(activityWatchdogTimer);
        }
        // Allow up to 3.5s pause after the most recent speech partial before endpointing
        activityWatchdogTimer = setTimeout(() => {
          finishWithTranscript(lastPartial, 'silence_after_speech');
        }, 3500);
      };

      const cleanup = () => {
        if (initialSilenceTimer) {
          clearTimeout(initialSilenceTimer);
          initialSilenceTimer = null;
        }
        if (activityWatchdogTimer) {
          clearTimeout(activityWatchdogTimer);
          activityWatchdogTimer = null;
        }
        if (maxSessionTimer) {
          clearTimeout(maxSessionTimer);
          maxSessionTimer = null;
        }
        partialSub?.remove();
        finalSub?.remove();
        errorSub?.remove();
        rmsSub?.remove();
        partialSub = null;
        finalSub = null;
        errorSub = null;
        rmsSub = null;
        SpeechRecognizer.activeSessionCleanup = null;
        useVoiceStore.getState().setRmsLevel(0);
      };

      const finishWithTranscript = (text: string, endpointReason: string = 'final_result') => {
        if (isResolved) return;
        isResolved = true;
        cleanup();
        FridaySpeechRecognizerNative?.stopListening?.().catch(() => {});

        const clean = (text || '').trim();
        const isNoise = ActionSafetyGuard.isNoiseOrArtifact(clean);
        const finalCleanText = isNoise ? '' : clean;

        useVoiceStore.getState().setFinalTranscript(finalCleanText);

        const finalConfidence = isNoise ? 0.0 : this.accumulator.getCurrentPartials().length > 2 ? 0.95 : 0.85;
        this.accumulator.finalize(finalCleanText, finalConfidence, endpointReason);
        VoiceTelemetry.recordTranscriptTurn({
          rawTranscript: clean,
          correctedTranscript: finalCleanText,
          corrections: [],
          endpointReason,
          durationMs: Date.now() - startTime,
          confidence: finalConfidence,
        });

        resolve({
          transcript: finalCleanText,
          isFinal: true,
          confidence: finalConfidence,
          latencyMs: Date.now() - startTime,
        });
      };

      // Set active cleanup reference for external cancellation or timeout
      SpeechRecognizer.activeSessionCleanup = () => {
        if (!isResolved) {
          finishWithTranscript(lastPartial, 'session_cancelled');
        }
      };

      // Wait up to 8.5s for the user to start speaking
      initialSilenceTimer = setTimeout(() => {
        finishWithTranscript(lastPartial, 'initial_silence_timeout');
      }, 8500);

      // Hard max safety limit (45s) for ultra-long speech sessions
      maxSessionTimer = setTimeout(() => {
        finishWithTranscript(lastPartial, 'max_duration_timeout');
      }, 45000);

      partialSub = DeviceEventEmitter.addListener('onSpeechPartialResult', (data: { transcript: string; isSegmentEnd?: boolean }) => {
        if (data?.transcript) {
          resetActivityWatchdog();
          if (data.isSegmentEnd) {
            accumulatedTranscript += (accumulatedTranscript ? ' ' : '') + data.transcript;
            lastPartial = accumulatedTranscript;
            onInterim(accumulatedTranscript);
            useVoiceStore.getState().setTranscriptStream(accumulatedTranscript);
            SpeechRecognizer.accumulator.addPartial(accumulatedTranscript);
          } else {
            const fullTranscript = accumulatedTranscript
              ? accumulatedTranscript + ' ' + data.transcript
              : data.transcript;
            lastPartial = fullTranscript;
            onInterim(fullTranscript);
            useVoiceStore.getState().setTranscriptStream(fullTranscript);
            SpeechRecognizer.accumulator.addPartial(fullTranscript);
          }
          TelemetryLogger.recordEvent('STT_RESULT', { interim: true, latencyMs: Date.now() - startTime });
        }
      });

      rmsSub = DeviceEventEmitter.addListener('onSpeechVolumeChanged', (data: { value: number }) => {
        if (typeof data?.value === 'number') {
          useVoiceStore.getState().setRmsLevel(data.value);
        }
      });

      finalSub = DeviceEventEmitter.addListener('onSpeechFinalResult', (data: { transcript: string }) => {
        const text = data?.transcript || lastPartial;
        finishWithTranscript(text, 'speech_final');
      });

      errorSub = DeviceEventEmitter.addListener('onSpeechError', () => {
        finishWithTranscript(lastPartial, 'speech_error');
      });

      FridaySpeechRecognizerNative.startListening(language).catch(() => {
        finishWithTranscript(lastPartial, 'native_start_failed');
      });
    });
  }

  static async stopListening(): Promise<void> {
    if (this.activeSessionCleanup) {
      this.activeSessionCleanup();
      this.activeSessionCleanup = null;
    }
    if (FridaySpeechRecognizerNative?.stopListening) {
      await FridaySpeechRecognizerNative.stopListening();
    }
  }

  static async cancelListening(): Promise<void> {
    if (this.activeSessionCleanup) {
      this.activeSessionCleanup();
      this.activeSessionCleanup = null;
    }
    if (FridaySpeechRecognizerNative?.cancelListening) {
      await FridaySpeechRecognizerNative.cancelListening();
    }
  }

  static getTranscriptHistory(): TranscriptTurn[] {
    return this.accumulator.getHistory();
  }

  static getLastTurn(): TranscriptTurn | null {
    const history = this.accumulator.getHistory();
    return history.length > 0 ? history[history.length - 1] : null;
  }
}
