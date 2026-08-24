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
      const groqKey = useSettingsStore.getState().groqApiKey || getSecret('GROQ_API_KEY');
      if (groqKey && FridaySpeechRecognizerNative?.setApiKey) {
        FridaySpeechRecognizerNative.setApiKey(groqKey).catch(() => {});
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

        const rawCmd = (data?.command || '').trim();
        const fullText = (data?.fullText || '').trim();
        const now = Date.now();

        // Strict Safety Gate: Verify that the transcribed audio actually addressed "Friday"
        const wakeWordRegex = /\b(?:hey|hi|ok|okay|hello|yo|aye|suno|arre|dear)?\s*(?:friday|fri\s*day|fried\s*day|fry\s*day|freeday|frida|fridays|friday's|vega|veega|vaga)\b/i;
        if (!wakeWordRegex.test(fullText) && !wakeWordRegex.test(rawCmd)) {
          return;
        }

        // Prevent immediate duplicate bursts
        const cmdKey = (rawCmd || fullText).toLowerCase();
        if (cmdKey && cmdKey === this.lastHandledCommand && now - this.lastHandledTimestamp < 3000) {
          return;
        }
        this.lastHandledCommand = cmdKey;
        this.lastHandledTimestamp = now;

        const inCall = await SystemControlModule.isCallActive();
        if (inCall) return;

        await SystemControlModule.pauseMediaPlayback();

        const evaluation = ActionSafetyGuard.evaluate(rawCmd);

        // CASE 1: FLUID SINGLE-BREATH COMMAND or INCOMPLETE ACTION ("Friday, what is the battery level", "Friday, open")
        if (evaluation.type === 'ACTIONABLE' || evaluation.type === 'CONVERSATIONAL' || evaluation.type === 'INCOMPLETE_ACTION') {
          FloatingOverlayModule.showOverlay('Listening...', 'LISTENING');
          await this.startContinuousVoiceSession(rawCmd);
        } else {
          // CASE 2: VERIFIED STANDALONE WAKE WORD ("Friday" / "Hey Friday" alone)
          // Speaks "Yes, Boss?" greeting and opens active multi-turn window for command
          this.stateMachine.transition(VoiceSessionState.WAKE_DETECTED);
          FloatingOverlayModule.showOverlay('Listening...', 'LISTENING');
          const greeting = this.getRandomWakeAck();
          PocketTTSEngine.speak({ text: greeting }).catch(() => {});
          await new Promise(r => setTimeout(r, 200));
          await this.startContinuousVoiceSession(); // Opens follow-up window
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
            await this.startContinuousVoiceSession(cmd);
          } else {
            this.stateMachine.transition(VoiceSessionState.WAKE_DETECTED);
            PocketTTSEngine.speak({ text: this.getRandomWakeAck() }).catch(() => {});
            await new Promise(r => setTimeout(r, 200));
            await this.startContinuousVoiceSession();
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
   * Fluid Multi-Turn Continuous Voice Session.
   *
   * Executes initial command, speaks response, and then maintains an Active Follow-Up Window (8–10s)
   * where the user can ask follow-ups WITHOUT repeating "Friday" before every question.
   */
  static async startContinuousVoiceSession(initialQuery?: string): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    const agent = new FridayAgent();
    let nextQuery: string | null = initialQuery || null;

    try {
      while (this.isRunning) {
        if (nextQuery && nextQuery.trim()) {
          const evalResult = ActionSafetyGuard.evaluate(nextQuery);

          if (evalResult.type === 'NOISE') {
            nextQuery = null;
            continue;
          }

          if (evalResult.type === 'STOP') {
            useAgentStore.getState().setAgentState('SPEAKING');
            this.stateMachine.transition(VoiceSessionState.SPEAKING);
            FloatingOverlayModule.updateOverlay('Standing by, Boss.', 'IDLE');
            await PocketTTSEngine.speak({ text: 'Standing by, Boss.' });
            await PocketTTSEngine.waitForCompletion();
            break;
          }

          if (evalResult.type === 'INCOMPLETE_ACTION') {
            useAgentStore.getState().setAgentState('SPEAKING');
            this.stateMachine.transition(VoiceSessionState.SPEAKING);
            const prompt = evalResult.clarificationPrompt || "What's the play, Boss?";
            FloatingOverlayModule.updateOverlay(prompt, 'LISTENING');
            await PocketTTSEngine.speak({ text: prompt });
            await PocketTTSEngine.waitForCompletion();
            nextQuery = null;
            continue;
          }

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
          const reply = await agent.executeGoal(nextQuery);
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

          // Both device automation actions and conversational queries stay in Active Follow-Up Window
          nextQuery = null;
        }

        // --- ACTIVE MULTI-TURN FOLLOW-UP WINDOW (No "Friday" Keyword Required) ---
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
          break;
        } finally {
          AudioManager.stopRecording();
          AudioManager.duckMediaAudio(false);
        }

        if (!this.isRunning) break;

        const capturedText = (sttResult.transcript || '').trim();
        const capturedEval = ActionSafetyGuard.evaluate(capturedText);

        // If silence or empty after follow-up window, conclude session gracefully
        if (capturedEval.type === 'NOISE' || !capturedText) {
          break;
        }

        if (capturedEval.type === 'STOP') {
          useAgentStore.getState().setAgentState('SPEAKING');
          this.stateMachine.transition(VoiceSessionState.SPEAKING);
          FloatingOverlayModule.updateOverlay('Standing by, Boss.', 'IDLE');
          await PocketTTSEngine.speak({ text: 'Standing by, Boss.' });
          await PocketTTSEngine.waitForCompletion();
          break;
        }

        // Strip any optional "Friday" if user happened to say it again
        let cleanFollowUp = capturedText;
        const wakeWordPrefixRegex = /^(?:(?:hey|hi|ok|okay|hello|yo|aye|suno|arre|dear)\s+)?(?:friday|fri\s*day|fried\s*day|fry\s*day|freeday|frida|fridays|friday's|vega|veega|vaga)[\s,]+/i;
        if (wakeWordPrefixRegex.test(cleanFollowUp)) {
          cleanFollowUp = cleanFollowUp.replace(wakeWordPrefixRegex, '').trim();
        }

        nextQuery = cleanFollowUp || capturedText;
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
