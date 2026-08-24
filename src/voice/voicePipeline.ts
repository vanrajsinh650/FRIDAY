import { NativeModules, DeviceEventEmitter } from 'react-native';
import { AudioManager } from './audioManager';
import { SpeechRecognizer } from './stt';
import { PocketTTSEngine } from './tts';
import { ResponseShaper } from './responseShaper';
import { VoiceStateMachine, VoiceSessionState } from './voiceStateMachine';
import { VoiceTelemetry, VoiceErrorType } from './voiceTelemetry';
import { useVoiceStore } from '../state/voiceStore';
import { useAgentStore } from '../state/agentStore';
import { FridayAgent } from '../agent/agent';
import { SystemControlModule } from '../native/SystemControlModule';
import { FloatingOverlayModule } from '../native/FloatingOverlayModule';
import { ActionSafetyGuard } from './actionSafetyGuard';

import { useSettingsStore } from '../state/settingsStore';
import { getSecret } from '../config/secrets';

const { FridaySpeechRecognizerNative } = NativeModules;

export class VoicePipeline {
  private static isRunning = false;
  private static stateMachine = new VoiceStateMachine();
  private static wakeWordSub: any = null;
  private static notifSub: any = null;
  private static appTriggerSub: any = null;
  private static lastHandledCommand = '';
  private static lastHandledTimestamp = 0;

  static initializeWakeWordListener(): void {
    if (this.wakeWordSub) return;

    try {
      const groqKey1 = useSettingsStore.getState().groqApiKey || getSecret('GROQ_API_KEY');
      const groqKey2 = getSecret('GROQ_API_KEY_2');
      const groqKey3 = getSecret('GROQ_API_KEY_3');
      const openaiKey = getSecret('OPENAI_API_KEY');

      if (FridaySpeechRecognizerNative?.setApiKeys) {
        FridaySpeechRecognizerNative.setApiKeys(groqKey1, groqKey2, groqKey3, openaiKey).catch(() => {});
      } else if (groqKey1 && FridaySpeechRecognizerNative?.setApiKey) {
        FridaySpeechRecognizerNative.setApiKey(groqKey1).catch(() => {});
      }
    } catch (_e) {}

    this.stateMachine.onTransition((_from, to) => {
      useVoiceStore.getState().setSessionState(to);
    });
    this.stateMachine.transition(VoiceSessionState.WAKE_LISTENING);

    // 1. Hands-free Wake Word & Single-Breath Command Listener
    this.wakeWordSub = DeviceEventEmitter.addListener(
      'onWakeWordDetected',
      async (data: { wakeWord: string; command: string; fullText: string }) => {
        if (this.isRunning) return;

        const rawCmd = (data?.command || '').replace(/^[\s.,;:!?-]+|[\s.,;:!?-]+$/, '').trim();
        const hasAlphanumeric = /[a-zA-Z0-9]/.test(rawCmd);
        const validCmd = hasAlphanumeric ? rawCmd : '';
        const fullText = (data?.fullText || '').trim();
        const now = Date.now();

        // Strict Safety Gate: Verify that the transcribed audio actually addressed "Friday"
        const wakeWordRegex = /\b(?:hey|hi|ok|okay|hello|yo|aye|suno|arre|dear)?\s*(?:friday|fri\s*day|fried\s*day|fry\s*day|freeday|frida|fridays|friday's|fraiday|phriday|f\.r\.i\.d\.a\.y|vega|veega|vaga)\b/i;
        if (!wakeWordRegex.test(fullText) && !wakeWordRegex.test(validCmd)) {
          return;
        }

        // Prevent immediate duplicate bursts
        const cmdKey = (validCmd || fullText).toLowerCase();
        if (cmdKey && cmdKey === this.lastHandledCommand && now - this.lastHandledTimestamp < 3000) {
          return;
        }
        this.lastHandledCommand = cmdKey;
        this.lastHandledTimestamp = now;

        const inCall = await SystemControlModule.isCallActive();
        if (inCall) return;

        await SystemControlModule.pauseMediaPlayback();

        const evaluation = validCmd ? ActionSafetyGuard.evaluate(validCmd) : { type: 'NOISE', confidence: 0 };

        // CASE 1: FLUID SINGLE-BREATH COMMAND or INCOMPLETE ACTION ("Friday, what is the battery level", "Friday, open YouTube")
        if (validCmd && (evaluation.type === 'ACTIONABLE' || evaluation.type === 'CONVERSATIONAL' || evaluation.type === 'INCOMPLETE_ACTION')) {
          FloatingOverlayModule.showOverlay('Listening...', 'LISTENING');
          await this.startVoiceSession(validCmd);
        } else {
          // CASE 2: VERIFIED STANDALONE WAKE WORD ("Friday" / "Hey Friday" alone)
          // Speaks "Yes, Boss?" greeting and opens active window for command
          this.stateMachine.transition(VoiceSessionState.WAKE_DETECTED);
          FloatingOverlayModule.showOverlay('Listening...', 'LISTENING');
          const greeting = this.getRandomWakeAck();
          
          // Await snappy greeting (+25% speed) so the mic opens the EXACT millisecond she finishes speaking
          try {
            await PocketTTSEngine.speak({ text: greeting, speed: 1.25 });
          } catch (_e) {}
          
          await this.startVoiceSession(); // Opens query window at the exact moment she finishes speaking
        }
      }
    );

    // 2. Direct In-App Button Trigger
    if (!this.appTriggerSub) {
      this.appTriggerSub = DeviceEventEmitter.addListener(
        'onAppVoiceTrigger',
        async (data: { triggerVoice?: boolean; command?: string }) => {
          if (this.isRunning) return;
          await SystemControlModule.pauseMediaPlayback();
          const cmd = (data?.command || '').trim();
          const evaluation = ActionSafetyGuard.evaluate(cmd);
          FloatingOverlayModule.showOverlay('Listening...', 'LISTENING');
          if (evaluation.type === 'ACTIONABLE' || evaluation.type === 'CONVERSATIONAL') {
            await this.startVoiceSession(cmd);
          } else {
            this.stateMachine.transition(VoiceSessionState.WAKE_DETECTED);
            try {
              await PocketTTSEngine.speak({ text: this.getRandomWakeAck(), speed: 1.25 });
            } catch (_e) {}
            await this.startVoiceSession();
          }
        }
      );
    }

    // 3. Proactive Spoken Notification Alerts
    if (!this.notifSub) {
      this.notifSub = DeviceEventEmitter.addListener(
        'onIncomingNotification',
        async (data: { spokenAlert: string; isMediaOrCallActive?: boolean }) => {
          if (this.isRunning || !data?.spokenAlert || data?.isMediaOrCallActive) return;

          const isMedia = await SystemControlModule.isMediaPlaying();
          const inCall = await SystemControlModule.isCallActive();
          if (isMedia || inCall) return;

          this.isRunning = true;
          try {
            await PocketTTSEngine.speak({ text: data.spokenAlert });
            await PocketTTSEngine.waitForCompletion();
          } catch (_e) {
          } finally {
            this.isRunning = false;
            FridaySpeechRecognizerNative?.startContinuousWakeListening?.();
          }
        }
      );
    }

    FridaySpeechRecognizerNative?.startContinuousWakeListening?.();
  }

  /**
   * Bounded Voice Session.
   *
   * Executes initial command or waits for single turn command upon standalone wake,
   * speaks response, and immediately returns to 24/7 background standby (WAKE_LISTENING).
   */
  static async startVoiceSession(initialQuery?: string): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    const agent = new FridayAgent();

    try {
      let queryToExecute = (initialQuery || '').trim();

      // If standalone wake word ("Friday"), listen for the user's command
      if (!queryToExecute) {
        AudioManager.duckMediaAudio(true);
        useAgentStore.getState().setAgentState('LISTENING');
        this.stateMachine.transition(VoiceSessionState.LISTENING);
        FloatingOverlayModule.updateOverlay('Listening...', 'LISTENING');
        AudioManager.startRecording();

        let sttResult = { transcript: '' };
        try {
          sttResult = await SpeechRecognizer.recognizeSpeech((interim) => {
            useVoiceStore.getState().setTranscriptStream(interim);
            VoiceTelemetry.updateDiagnostic('partialTranscript', interim);
          });
        } catch (_err: any) {
          await SpeechRecognizer.stopListening();
        } finally {
          AudioManager.stopRecording();
          AudioManager.duckMediaAudio(false);
        }

        const capturedText = (sttResult.transcript || '').trim();
        const evalResult = ActionSafetyGuard.evaluate(capturedText);

        if (evalResult.type === 'NOISE' || !capturedText) {
          // Ambient noise or silence -> silently finish
          return;
        }

        if (evalResult.type === 'STOP') {
          useAgentStore.getState().setAgentState('SPEAKING');
          this.stateMachine.transition(VoiceSessionState.SPEAKING);
          FloatingOverlayModule.updateOverlay('Standing by, Boss.', 'IDLE');
          await PocketTTSEngine.speak({ text: 'Standing by, Boss.' });
          await PocketTTSEngine.waitForCompletion();
          return;
        }

        // Clean any optional leading "Friday" prefix
        const wakeWordPrefixRegex = /^(?:(?:hey|hi|ok|okay|hello|yo|aye|suno|arre|dear)\s+)?(?:friday|fri\s*day|fried\s*day|fry\s*day|freeday|frida|fridays|friday's|fraiday|phriday|f\.r\.i\.d\.a\.y|vega|veega|vaga)[\s,:]*/i;
        queryToExecute = capturedText.replace(wakeWordPrefixRegex, '').trim() || capturedText;
      }

      if (!queryToExecute) return;

      const evalResult = ActionSafetyGuard.evaluate(queryToExecute);
      if (evalResult.type === 'NOISE') return;

      if (evalResult.type === 'STOP') {
        useAgentStore.getState().setAgentState('SPEAKING');
        this.stateMachine.transition(VoiceSessionState.SPEAKING);
        FloatingOverlayModule.updateOverlay('Standing by, Boss.', 'IDLE');
        await PocketTTSEngine.speak({ text: 'Standing by, Boss.' });
        await PocketTTSEngine.waitForCompletion();
        return;
      }

      if (evalResult.type === 'INCOMPLETE_ACTION') {
        useAgentStore.getState().setAgentState('SPEAKING');
        this.stateMachine.transition(VoiceSessionState.SPEAKING);
        const prompt = evalResult.clarificationPrompt || "What's the play, Boss?";
        FloatingOverlayModule.updateOverlay(prompt, 'LISTENING');
        await PocketTTSEngine.speak({ text: prompt });
        await PocketTTSEngine.waitForCompletion();

        // Listen for clarification turn
        AudioManager.duckMediaAudio(true);
        useAgentStore.getState().setAgentState('LISTENING');
        this.stateMachine.transition(VoiceSessionState.LISTENING);
        AudioManager.startRecording();

        let clarStt = { transcript: '' };
        try {
          clarStt = await SpeechRecognizer.recognizeSpeech((interim) => {
            useVoiceStore.getState().setTranscriptStream(interim);
          });
        } catch (_e) {}
        finally {
          AudioManager.stopRecording();
          AudioManager.duckMediaAudio(false);
        }

        const clarText = (clarStt.transcript || '').trim();
        if (!clarText || ActionSafetyGuard.isNoiseOrArtifact(clarText)) {
          return;
        }
        queryToExecute = `${queryToExecute} ${clarText}`.trim();
      }

      // Execute goal
      VoiceTelemetry.startNewTurn();
      useAgentStore.getState().setAgentState('THINKING');
      this.stateMachine.transition(VoiceSessionState.THINKING);
      FloatingOverlayModule.updateOverlay('Thinking...', 'THINKING');

      const isAction = evalResult.type === 'ACTIONABLE';
      if (isAction) {
        const ack = VoicePipeline.quickAck();
        useAgentStore.getState().setAgentState('SPEAKING');
        PocketTTSEngine.speak({ text: ack });
      }

      const actionStartTime = Date.now();
      const reply = await agent.executeGoal(queryToExecute);
      VoiceTelemetry.recordLatency('firstActionLatency', Date.now() - actionStartTime);

      const shapedReply = ResponseShaper.shape(reply);
      if (shapedReply && shapedReply.trim()) {
        await PocketTTSEngine.waitForCompletion();
        useAgentStore.getState().setAgentState('SPEAKING');
        this.stateMachine.transition(VoiceSessionState.SPEAKING);
        FloatingOverlayModule.updateOverlay('Speaking...', 'SPEAKING');
        await PocketTTSEngine.speak({ text: shapedReply });
        await PocketTTSEngine.waitForCompletion();
      } else {
        await PocketTTSEngine.waitForCompletion();
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (!msg.includes('timeout') && !msg.includes('match') && !msg.includes('busy')) {
        useAgentStore.getState().setError(msg || 'Session issue');
        VoiceTelemetry.recordError(VoiceErrorType.STT_ERROR, msg);
      }
    } finally {
      AudioManager.stopAllAudio();
      await SpeechRecognizer.stopListening();
      useAgentStore.getState().setAgentState('IDLE');
      try {
        this.stateMachine.transition(VoiceSessionState.WAKE_LISTENING);
      } catch (_e) {}
      FloatingOverlayModule.updateOverlay('FRIDAY Standby', 'IDLE');
      this.isRunning = false;
      setTimeout(() => {
        FridaySpeechRecognizerNative?.startContinuousWakeListening?.();
      }, 400);
    }
  }

  static async startContinuousVoiceSession(initialQuery?: string): Promise<void> {
    return this.startVoiceSession(initialQuery);
  }

  static async handleVoiceTurn(agentExecutor?: (goal: string) => Promise<string>): Promise<void> {
    await this.startContinuousVoiceSession();
  }

  static interrupt(): void {
    this.isRunning = false;
    PocketTTSEngine.stop();
    SpeechRecognizer.cancelListening();
    AudioManager.forceStop();
    try {
      this.stateMachine.transition(VoiceSessionState.INTERRUPTED);
    } catch (_e) {}
    useAgentStore.getState().setAgentState('IDLE');
    FloatingOverlayModule.updateOverlay('Interrupted', 'IDLE');
    setTimeout(() => {
      try {
        this.stateMachine.transition(VoiceSessionState.WAKE_LISTENING);
      } catch (_e) {}
      FridaySpeechRecognizerNative?.startContinuousWakeListening?.();
    }, 200);
  }

  static getSessionState(): VoiceSessionState {
    return this.stateMachine.getState();
  }

  private static getRandomWakeAck(): string {
    const enAcks = ["Yes, Boss?", "Online and listening, Boss.", "Right here, Boss. What's the play?", "Go ahead, Boss."];
    return enAcks[Math.floor(Math.random() * enAcks.length)];
  }

  private static quickAck(): string {
    const acks = ['Right away, Boss.', 'On it, Boss.', 'Pulling that up now, Boss.', 'Executing now, Boss.'];
    return acks[Math.floor(Math.random() * acks.length)];
  }
}
