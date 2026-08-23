import { FridaySession, SessionTurn, TaskEvent, TaskEventType } from './types';

class SessionManagerClass {
  private session: FridaySession;
  private events: TaskEvent[] = [];
  private eventListeners: Array<(event: TaskEvent) => void> = [];

  constructor() {
    this.session = this.createNewSession();
  }

  createNewSession(): FridaySession {
    const now = Date.now();
    return {
      sessionId: `session_${now}`,
      conversationId: `conv_${now}`,
      currentTaskId: null,
      currentGoal: null,
      currentApp: null,
      currentScreenFingerprint: null,
      turns: [],
      recentActions: [],
      pendingInput: null,
      isCancelled: false,
      isPaused: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  reset(): void {
    this.session = this.createNewSession();
    this.events = [];
  }

  getSession(): FridaySession {
    return { ...this.session };
  }

  setCurrentTask(taskId: string | null, goal: string | null, targetApp?: string): void {
    this.session.currentTaskId = taskId;
    this.session.currentGoal = goal;
    if (targetApp) this.session.currentApp = targetApp;
    this.session.isCancelled = false;
    this.session.updatedAt = Date.now();
  }

  updateScreenFingerprint(fingerprint: string): void {
    this.session.currentScreenFingerprint = fingerprint;
    this.session.updatedAt = Date.now();
  }

  addTurn(role: 'user' | 'assistant', content: string, targetApp?: string, entities?: Record<string, string>): void {
    const turn: SessionTurn = {
      id: `turn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      role,
      content,
      timestamp: Date.now(),
      targetApp,
      entities,
    };
    this.session.turns.push(turn);
    if (this.session.turns.length > 30) {
      this.session.turns = this.session.turns.slice(-30);
    }
    if (targetApp) {
      this.session.currentApp = targetApp;
    }
    this.session.updatedAt = Date.now();
    this.emitEvent('TURN_STARTED', { role, content, targetApp });
  }

  addRecentAction(actionSummary: string): void {
    this.session.recentActions.push(actionSummary);
    if (this.session.recentActions.length > 15) {
      this.session.recentActions = this.session.recentActions.slice(-15);
    }
    this.session.updatedAt = Date.now();
  }

  cancelActiveTask(reason: string = 'User requested cancellation'): void {
    this.session.isCancelled = true;
    this.emitEvent('TASK_CANCELLED', { reason, taskId: this.session.currentTaskId });
  }

  isCancelled(): boolean {
    return this.session.isCancelled;
  }

  emitEvent(type: TaskEventType, payload?: Record<string, any>): TaskEvent {
    const event: TaskEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type,
      timestamp: Date.now(),
      taskId: this.session.currentTaskId || undefined,
      sessionId: this.session.sessionId,
      payload,
    };
    this.events.push(event);
    if (this.events.length > 200) {
      this.events = this.events.slice(-200);
    }
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (_: any) {}
    }
    return event;
  }

  addEventListener(listener: (event: TaskEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter((l) => l !== listener);
    };
  }

  getRecentEvents(limit: number = 20): TaskEvent[] {
    return this.events.slice(-limit);
  }
}

export const SessionManager = new SessionManagerClass();
