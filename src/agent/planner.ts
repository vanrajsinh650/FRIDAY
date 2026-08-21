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
    const plan: PlannedAction[] = [];
    const messages = PromptBuilder.buildSystemPrompt(snapshot);
    const tools = ToolRegistry.getToolSchemas();

    // Pure LLM tool generation based on user goal and current screen state
    const toolCall = await this.provider.generateToolCall(messages, tools);

    plan.push({
      id: `step_${Date.now()}`,
      toolName: toolCall.toolName,
      parameters: toolCall.parameters,
      description: toolCall.rawReply || `Execute ${toolCall.toolName}`,
    });

    return plan;
  }
}
