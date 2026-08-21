import { useVoiceStore } from '../state/voiceStore';
import { TelemetryLogger } from '../utils/telemetry';

export class WakeWordDetector {
  private static isListening = false;

  static startListening(onWakeDetected: () => void): void {
    this.isListening = true;
    useVoiceStore.getState().setWakeWordListening(true);
  }

  static stopListening(): void {
    this.isListening = false;
    useVoiceStore.getState().setWakeWordListening(false);
  }

  // Simulated trigger for UI / testing
  static simulateWakeWord(onWakeDetected: () => void): void {
    TelemetryLogger.recordEvent('VOICE_DETECTED', { trigger: 'SIMULATED_WAKE_WORD' });
    onWakeDetected();
  }
}
