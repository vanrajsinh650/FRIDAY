import { AccessibilityModule } from '../native/AccessibilityModule';
import { ScopedMemoryRetriever } from '../memory/retriever';
import { AgentContextSnapshot } from './types';

export class ContextManager {
  static async assembleContext(goal: string, recentHistory: string[] = []): Promise<AgentContextSnapshot> {
    const screenTree = await AccessibilityModule.inspectScreen();
    const memoryFacts = ScopedMemoryRetriever.retrieveRelevantFacts(goal, screenTree.activePackage);

    return {
      activeGoal: goal,
      screenTree,
      memoryFacts,
      recentActionHistory: recentHistory,
    };
  }
}
