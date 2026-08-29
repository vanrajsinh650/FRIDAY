import { ScreenTree } from '../../native/types';

export type GoalType =
  | 'MEDIA_PLAYBACK'
  | 'MESSAGING'
  | 'SEARCH'
  | 'SYSTEM_CONTROL'
  | 'APP_OPERATION'
  | 'CONVERSATIONAL';

export interface TerminalCondition {
  type: 'PACKAGE_ACTIVE' | 'TEXT_PRESENT' | 'PLAYBACK_ACTIVE' | 'MESSAGE_SENT' | 'SCREEN_CHANGED' | 'SINGLE_ACTION_DONE';
  expectedPackage?: string;
  expectedText?: string;
  description: string;
}

export interface ToolExecutionPolicy {
  parallelSafe: boolean;
  mutatesUI: boolean;
  requiresForegroundApp: boolean;
  requiresConfirmation: boolean;
}

export interface ActionRecord {
  id: string;
  toolName: string;
  parameters: Record<string, any>;
  description?: string;
  success: boolean;
  durationMs: number;
  observedPackage?: string;
  stateChanged: boolean;
  error?: string;
  resultData?: any;
}

export interface TaskState {
  id: string;
  sessionId: string;
  rawGoal: string;
  normalizedGoal: string;
  goalType: GoalType;
  terminalConditions: TerminalCondition[];
  currentApp?: string;
  actionHistory: ActionRecord[];
  stepCount: number;
  maxSteps: number;
  retryCount: number;
  status:
    | 'CREATED'
    | 'PLANNING'
    | 'EXECUTING'
    | 'OBSERVING'
    | 'VERIFYING'
    | 'RECOVERING'
    | 'COMPLETED'
    | 'FAILED'
    | 'CANCELLED';
  verified: boolean;
  lastFingerprint?: string;
  summary?: string;
}

export interface SteeringUpdate {
  type: 'MODIFY_TARGET' | 'CANCEL' | 'FOLLOW_UP' | 'INJECT_COMMAND';
  newGoal?: string;
  additionalContext?: string;
}
