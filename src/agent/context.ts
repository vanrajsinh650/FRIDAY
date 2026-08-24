import { AccessibilityModule } from '../native/AccessibilityModule';
import { ScopedMemoryRetriever } from '../memory/retriever';
import { MemoryStore } from '../memory/store';
import { ConversationManager } from './conversationManager';
import { AgentContextSnapshot, TaskState, VisualContextSnapshot } from './types';
import { VisionPerception } from './perception/visionPerception';
import { useSettingsStore } from '../state/settingsStore';

export class ContextManager {
  static async assembleContext(task: TaskState, recentHistory: string[] = []): Promise<AgentContextSnapshot> {
    await MemoryStore.initialize();
    const screenTree = await AccessibilityModule.inspectScreen();
    const memoryFacts = ScopedMemoryRetriever.retrieveRelevantFacts(task.rawGoal, screenTree.activePackage);
    const conversationState = ConversationManager.getState();

    let visualContext: VisualContextSnapshot | undefined = undefined;
    const settings = useSettingsStore.getState();
    const isSparse = VisionPerception.isTreeSparse(screenTree);

    if (isSparse && settings.visionFallbackEnabled) {
      visualContext = {
        isSparse: true,
      };
    }

    return {
      activeGoal: task.rawGoal,
      goalType: task.goalType,
      screenTree,
      memoryFacts,
      recentActionHistory: recentHistory,
      conversationHistory: conversationState.turns,
      activeTask: task,
      visualContext,
    };
  }
}
