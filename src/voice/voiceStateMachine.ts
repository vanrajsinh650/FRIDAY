import { TelemetryLogger } from '../utils/telemetry';

export enum VoiceSessionState {
  SLEEPING = 'SLEEPING',
  WAKE_LISTENING = 'WAKE_LISTENING',
  WAKE_DETECTED = 'WAKE_DETECTED',
  LISTENING = 'LISTENING',
  ENDPOINTING = 'ENDPOINTING',
  FINALIZING = 'FINALIZING',
  THINKING = 'THINKING',
  EXECUTING = 'EXECUTING',
  SPEAKING = 'SPEAKING',
  ACTIVE_CONVERSATION = 'ACTIVE_CONVERSATION',
  BARGE_IN = 'BARGE_IN',
  INTERRUPTED = 'INTERRUPTED',
  CONVERSATION_IDLE = 'CONVERSATION_IDLE',
  ERROR = 'ERROR',
}

const VALID_TRANSITIONS: Record<VoiceSessionState, VoiceSessionState[]> = {
  [VoiceSessionState.SLEEPING]: [
    VoiceSessionState.WAKE_LISTENING,
    VoiceSessionState.ACTIVE_CONVERSATION,
  ],
  [VoiceSessionState.WAKE_LISTENING]: [
    VoiceSessionState.WAKE_DETECTED,
    VoiceSessionState.THINKING,
    VoiceSessionState.SPEAKING,
    VoiceSessionState.LISTENING,
    VoiceSessionState.ACTIVE_CONVERSATION,
    VoiceSessionState.ERROR,
    VoiceSessionState.SLEEPING,
  ],
  [VoiceSessionState.WAKE_DETECTED]: [
    VoiceSessionState.LISTENING,
    VoiceSessionState.SPEAKING,
    VoiceSessionState.THINKING,
    VoiceSessionState.ACTIVE_CONVERSATION,
    VoiceSessionState.WAKE_LISTENING,
    VoiceSessionState.INTERRUPTED,
    VoiceSessionState.ERROR,
  ],
  [VoiceSessionState.LISTENING]: [
    VoiceSessionState.ENDPOINTING,
    VoiceSessionState.FINALIZING,
    VoiceSessionState.THINKING,
    VoiceSessionState.SPEAKING,
    VoiceSessionState.ACTIVE_CONVERSATION,
    VoiceSessionState.CONVERSATION_IDLE,
    VoiceSessionState.WAKE_LISTENING,
    VoiceSessionState.INTERRUPTED,
    VoiceSessionState.ERROR,
  ],
  [VoiceSessionState.ENDPOINTING]: [
    VoiceSessionState.FINALIZING,
    VoiceSessionState.LISTENING,
    VoiceSessionState.ACTIVE_CONVERSATION,
    VoiceSessionState.THINKING,
    VoiceSessionState.WAKE_LISTENING,
    VoiceSessionState.INTERRUPTED,
    VoiceSessionState.ERROR,
  ],
  [VoiceSessionState.FINALIZING]: [
    VoiceSessionState.THINKING,
    VoiceSessionState.ACTIVE_CONVERSATION,
    VoiceSessionState.WAKE_LISTENING,
    VoiceSessionState.INTERRUPTED,
    VoiceSessionState.ERROR,
  ],
  [VoiceSessionState.THINKING]: [
    VoiceSessionState.EXECUTING,
    VoiceSessionState.SPEAKING,
    VoiceSessionState.LISTENING,
    VoiceSessionState.ACTIVE_CONVERSATION,
    VoiceSessionState.WAKE_LISTENING,
    VoiceSessionState.INTERRUPTED,
    VoiceSessionState.ERROR,
  ],
  [VoiceSessionState.EXECUTING]: [
    VoiceSessionState.SPEAKING,
    VoiceSessionState.THINKING,
    VoiceSessionState.ACTIVE_CONVERSATION,
    VoiceSessionState.WAKE_LISTENING,
    VoiceSessionState.INTERRUPTED,
    VoiceSessionState.ERROR,
  ],
  [VoiceSessionState.SPEAKING]: [
    VoiceSessionState.ACTIVE_CONVERSATION,
    VoiceSessionState.LISTENING,
    VoiceSessionState.THINKING,
    VoiceSessionState.BARGE_IN,
    VoiceSessionState.CONVERSATION_IDLE,
    VoiceSessionState.WAKE_LISTENING,
    VoiceSessionState.INTERRUPTED,
    VoiceSessionState.ERROR,
  ],
  [VoiceSessionState.ACTIVE_CONVERSATION]: [
    VoiceSessionState.LISTENING,
    VoiceSessionState.THINKING,
    VoiceSessionState.SPEAKING,
    VoiceSessionState.CONVERSATION_IDLE,
    VoiceSessionState.WAKE_LISTENING,
    VoiceSessionState.BARGE_IN,
    VoiceSessionState.INTERRUPTED,
    VoiceSessionState.ERROR,
    VoiceSessionState.SLEEPING,
  ],
  [VoiceSessionState.BARGE_IN]: [
    VoiceSessionState.LISTENING,
    VoiceSessionState.INTERRUPTED,
    VoiceSessionState.ACTIVE_CONVERSATION,
    VoiceSessionState.WAKE_LISTENING,
  ],
  [VoiceSessionState.INTERRUPTED]: [
    VoiceSessionState.LISTENING,
    VoiceSessionState.ACTIVE_CONVERSATION,
    VoiceSessionState.WAKE_LISTENING,
    VoiceSessionState.SLEEPING,
  ],
  [VoiceSessionState.CONVERSATION_IDLE]: [
    VoiceSessionState.ACTIVE_CONVERSATION,
    VoiceSessionState.LISTENING,
    VoiceSessionState.WAKE_LISTENING,
    VoiceSessionState.SLEEPING,
  ],
  [VoiceSessionState.ERROR]: [
    VoiceSessionState.WAKE_LISTENING,
    VoiceSessionState.ACTIVE_CONVERSATION,
    VoiceSessionState.SLEEPING,
  ],
};

export class VoiceStateMachine {
  private state: VoiceSessionState = VoiceSessionState.SLEEPING;
  private listeners: Array<(from: VoiceSessionState, to: VoiceSessionState) => void> = [];
  private transitionLog: Array<{ from: VoiceSessionState; to: VoiceSessionState; timestamp: number }> = [];

  transition(to: VoiceSessionState): boolean {
    const from = this.state;
    if (from === to) return true;

    const allowed = VALID_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      console.warn(`[VoiceStateMachine] Invalid transition: ${from} → ${to}`);
      return false;
    }

    this.state = to;
    const entry = { from, to, timestamp: Date.now() };
    this.transitionLog.push(entry);
    if (this.transitionLog.length > 100) {
      this.transitionLog = this.transitionLog.slice(-100);
    }

    TelemetryLogger.recordEvent('VOICE_STATE_TRANSITION', { from, to, timestamp: entry.timestamp });

    for (const listener of this.listeners) {
      try {
        listener(from, to);
      } catch (_) {}
    }

    return true;
  }

  getState(): VoiceSessionState {
    return this.state;
  }

  getTransitionLog(): Array<{ from: VoiceSessionState; to: VoiceSessionState; timestamp: number }> {
    return [...this.transitionLog];
  }

  onTransition(listener: (from: VoiceSessionState, to: VoiceSessionState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  reset(): void {
    this.state = VoiceSessionState.SLEEPING;
    this.transitionLog = [];
  }
}
