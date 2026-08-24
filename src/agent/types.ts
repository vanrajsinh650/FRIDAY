import { ScreenTree, UINode } from '../native/types';
import { MemoryFact } from '../memory/types';
export * from './task/types';
import { GoalType, TaskState } from './task/types';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  targetApp?: string;
  entities?: Record<string, string>;
}

export interface ConversationState {
  turns: ConversationTurn[];
  activeApp?: string;
  activeEntity?: string;
  recentSearchQuery?: string;
  recentContact?: string;
}

export interface PlannedAction {
  id: string;
  toolName: string;
  parameters: Record<string, any>;
  description: string;
  verificationRule?: {
    expectedPackage?: string;
    expectedTextSnippet?: string;
    expectedElementId?: string;
  };
}

export interface VisualContextSnapshot {
  isSparse: boolean;
  screenshotBase64?: string;
  elementsSummary?: string;
}

export interface AgentContextSnapshot {
  activeGoal: string;
  goalType: GoalType;
  screenTree: ScreenTree;
  memoryFacts: MemoryFact[];
  recentActionHistory: string[];
  conversationHistory: ConversationTurn[];
  activeTask?: TaskState;
  visualContext?: VisualContextSnapshot;
}
