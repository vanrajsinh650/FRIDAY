import { useVoiceStore } from '../state/voiceStore';

export class AudioManager {
  private static isDucked = false;

  static startRecording(onChunk: (rms: number) => void): void {
    useVoiceStore.getState().setRecording(true);
    // Simulate real-time microphone RMS level stream in dev
    const interval = setInterval(() => {
      if (!useVoiceStore.getState().isRecording) {
        clearInterval(interval);
        return;
      }
      const fakeRms = Math.min(1.0, Math.max(0.05, Math.random() * 0.8));
      useVoiceStore.getState().setRmsLevel(fakeRms);
      onChunk(fakeRms);
    }, 80);
  }

  static stopRecording(): void {
    useVoiceStore.getState().setRecording(false);
    useVoiceStore.getState().setRmsLevel(0);
  }

  static duckMediaAudio(duck: boolean): void {
    this.isDucked = duck;
  }

  static stopAllAudio(): void {
    this.stopRecording();
    useVoiceStore.getState().setSpeaking(false);
  }
}
