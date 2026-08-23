import { AccessibilityModule } from '../native/AccessibilityModule';
import { ScopedMemoryRetriever } from '../memory/retriever';
import { MemoryStore } from '../memory/store';
import { ConversationManager } from './conversationManager';
import { AgentContextSnapshot, TaskState } from './types';

export class ContextManager {
  static async assembleContext(task: TaskState, recentHistory: string[] = []): Promise<AgentContextSnapshot> {
    await MemoryStore.initialize();
    const screenTree = await AccessibilityModule.inspectScreen();
    const memoryFacts = ScopedMemoryRetriever.retrieveRelevantFacts(task.rawGoal, screenTree.activePackage);
    const conversationState = ConversationManager.getState();

    return {
      activeGoal: task.rawGoal,
      goalType: task.goalType,
      screenTree,
      memoryFacts,
      recentActionHistory: recentHistory,
      conversationHistory: conversationState.turns,
      activeTask: task,
    };
  }
}
