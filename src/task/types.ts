export type GoalCategory =
  | 'DEVICE_CONTROL'
  | 'INFORMATION_RETRIEVAL'
  | 'COMMUNICATION'
  | 'MEDIA_ENTERTAINMENT'
  | 'SCHEDULING'
  | 'NAVIGATION'
  | 'SYSTEM_MAINTENANCE'
  | 'CONVERSATION';

export interface Goal {
  id: string;
  rawInput: string;
  objective: string;
  category: GoalCategory;
  constraints: string[];
  entities: Record<string, any>;
  expectedOutcome: string;
  confirmationRequired: boolean;
  createdAt: number;
}

export type TaskStatus =
  | 'CREATED'
  | 'UNDERSTANDING'
  | 'PLANNING'
  | 'EXECUTING'
  | 'OBSERVING'
  | 'VERIFYING'
  | 'RECOVERING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface ActionRecord {
  actionId: string;
  capabilityName: string;
  parameters: any;
  expectedOutcome?: string;
  success: boolean;
  resultData?: any;
  errorMessage?: string;
  executionDurationMs: number;
  timestamp: number;
}

export interface VerificationEvidence {
  source: 'NATIVE_STATE' | 'ACCESSIBILITY_TREE' | 'NOTIFICATION' | 'MEDIA' | 'SCREEN_VISION' | 'USER_CONFIRMATION';
  description: string;
  verified: boolean;
  timestamp: number;
}

export interface FridayTask {
  taskId: string;
  goal: Goal;
  status: TaskStatus;
  currentStepIndex: number;
  maxSteps: number;
  observations: string[];
  actions: ActionRecord[];
  evidence: VerificationEvidence[];
  retries: number;
  recoveryCount: number;
  createdAt: number;
  updatedAt: number;
}
