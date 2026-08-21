import { ScreenTree } from '../native/types';
import { MemoryFact } from '../memory/types';

export interface AgentGoal {
  rawTranscript: string;
  normalizedIntent: string;
  targetApp?: string;
  isMultiStep: boolean;
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

export interface AgentContextSnapshot {
  activeGoal: string;
  screenTree: ScreenTree;
  memoryFacts: MemoryFact[];
  recentActionHistory: string[];
}
