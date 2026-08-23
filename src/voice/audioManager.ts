import { useVoiceStore } from '../state/voiceStore';
import { PocketTTSEngine } from './tts';

export class AudioManager {
  private static isRecording = false;

  static startRecording(): void {
    this.isRecording = true;
    useVoiceStore.getState().setRecording(true);
  }

  static stopRecording(): void {
    this.isRecording = false;
    useVoiceStore.getState().setRecording(false);
    useVoiceStore.getState().setRmsLevel(0);
  }

  /**
   * Audio ducking is managed cleanly at the HAL level by Android AudioFocus
   * (AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK) inside TTSTurboModule.
   * We do NOT mutate the user's master STREAM_MUSIC hardware volume.
   */
  static async duckMediaAudio(_duck: boolean): Promise<void> {
    // Intentionally no-op to protect the user's system volume settings
  }

  static stopAllAudio(): void {
    this.stopRecording();
  }

  static forceStop(): void {
    this.stopRecording();
    PocketTTSEngine.stop();
    useVoiceStore.getState().setSpeaking(false);
  }
}

