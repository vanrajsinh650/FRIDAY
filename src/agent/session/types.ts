import { ScreenTree } from '../../native/types';
import { MemoryFact } from '../../memory/types';

export type TaskEventType =
  | 'TASK_STARTED'
  | 'TURN_STARTED'
  | 'USER_MESSAGE'
  | 'SCREEN_OBSERVED'
  | 'AGENT_REASONED'
  | 'PLAN_CREATED'
  | 'ACTION_REQUESTED'
  | 'ACTION_STARTED'
  | 'ACTION_COMPLETED'
  | 'ACTION_FAILED'
  | 'VERIFICATION_STARTED'
  | 'VERIFICATION_PASSED'
  | 'VERIFICATION_FAILED'
  | 'TASK_STEERED'
  | 'TASK_CANCELLED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED';

export interface TaskEvent {
  id: string;
  type: TaskEventType;
  timestamp: number;
  taskId?: string;
  sessionId?: string;
  payload?: Record<string, any>;
}

export interface SessionTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  targetApp?: string;
  entities?: Record<string, string>;
  actionStepCount?: number;
}

export interface FridaySession {
  sessionId: string;
  conversationId: string;
  currentTaskId: string | null;
  currentGoal: string | null;
  currentApp: string | null;
  currentScreenFingerprint: string | null;
  turns: SessionTurn[];
  recentActions: string[];
  pendingInput: string | null;
  isCancelled: boolean;
  isPaused: boolean;
  createdAt: number;
  updatedAt: number;
}
