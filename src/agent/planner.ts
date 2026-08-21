import { AgentGoal, PlannedAction } from './types';
import { GroqProvider } from './providers/groqProvider';
import { ModelProvider } from './providers/types';
import { PromptBuilder } from './promptBuilder';
import { AgentContextSnapshot } from './types';
import { ToolRegistry } from '../tools/registry';

export class Planner {
  private provider: ModelProvider;

  constructor(provider?: ModelProvider) {
    this.provider = provider || new GroqProvider();
  }

  async createPlan(snapshot: AgentContextSnapshot): Promise<PlannedAction[]> {
    const query = snapshot.activeGoal.toLowerCase();
    const plan: PlannedAction[] = [];

    // Dynamic multi-step app search & play workflow decomposition
    const appSearchMatch = query.match(/(?:open|launch)\s+([a-zA-Z0-9_\s]+?)\s+(?:and\s+)?search\s+(?:for\s+)?(.+?)(?:\s+(?:and\s+play|and\s+watch|play|watch)\s*(.*))?$/i);
    
    if (appSearchMatch) {
      const targetApp = appSearchMatch[1].trim();
      const searchQuery = appSearchMatch[2].trim();

      plan.push({
        id: 'step_launch_app',
        toolName: 'launch_app',
        parameters: { packageNameOrName: targetApp },
        description: `Launch ${targetApp}`,
      });
      plan.push({
        id: 'step_open_search',
        toolName: 'click_node',
        parameters: { nodeId: 'search_button' },
        description: `Tap search in ${targetApp}`,
        verificationRule: { expectedElementId: 'search_edit_text' },
      });
      plan.push({
        id: 'step_type_query',
        toolName: 'type_text',
        parameters: { text: searchQuery, clearFirst: true },
        description: `Type search query "${searchQuery}"`,
      });
      plan.push({
        id: 'step_select_result',
        toolName: 'click_node',
        parameters: { nodeId: 'video_card_1' },
        description: `Select and open top result for "${searchQuery}"`,
      });
      return plan;
    }

    // Single step LLM tool planning fallback
    const messages = PromptBuilder.buildSystemPrompt(snapshot);
    const toolCall = await this.provider.generateToolCall(messages, ToolRegistry.getToolSchemas());

    plan.push({
      id: `step_${Date.now()}`,
      toolName: toolCall.toolName,
      parameters: toolCall.parameters,
      description: `Execute ${toolCall.toolName}`,
    });

    return plan;
  }
}
