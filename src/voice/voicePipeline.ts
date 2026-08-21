import { AudioManager } from './audioManager';
import { SpeechRecognizer } from './stt';
import { PocketTTSEngine } from './tts';
import { useVoiceStore } from '../state/voiceStore';
import { useAgentStore } from '../state/agentStore';

export class VoicePipeline {
  private static isRunning = false;

  static async handleVoiceTurn(onTranscriptReady: (text: string) => Promise<string>): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // 1. Duck Media Audio & Start Audio Capture
      AudioManager.duckMediaAudio(true);
      useAgentStore.getState().setAgentState('LISTENING');
      AudioManager.startRecording(() => {});

      // 2. Perform Streaming STT
      const sttResult = await SpeechRecognizer.recognizeSpeech((interim) => {
        useVoiceStore.getState().setTranscriptStream(interim);
      });
      AudioManager.stopRecording();

      // 3. Hand off goal to Agent Core
      useAgentStore.getState().setAgentState('THINKING');
      const agentReply = await onTranscriptReady(sttResult.transcript);

      // 4. Stream TTS Response Aloud
      useAgentStore.getState().setAgentState('SPEAKING');
      await PocketTTSEngine.speak({ text: agentReply });

      useAgentStore.getState().setAgentState('IDLE');
    } catch (err: any) {
      useAgentStore.getState().setError(err.message || 'Voice pipeline failure');
    } finally {
      AudioManager.duckMediaAudio(false);
      this.isRunning = false;
    }
  }

  static interrupt(): void {
    PocketTTSEngine.stop();
    AudioManager.stopAllAudio();
    useAgentStore.getState().setAgentState('IDLE');
  }
}
