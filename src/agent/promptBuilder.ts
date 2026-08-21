import { AgentContextSnapshot } from './types';
import { PromptFormatter } from '../utils/formatters';
import { ModelMessage } from './providers/types';

export class PromptBuilder {
  static buildSystemPrompt(snapshot: AgentContextSnapshot): ModelMessage[] {
    const memorySnippet = snapshot.memoryFacts
      .map((f) => `- ${f.key}: ${f.value}`)
      .join('\n');

    const formattedScreen = PromptFormatter.formatScreenForLLM(snapshot.screenTree);

    const systemPrompt = `You are FRIDAY, an autonomous AI operating layer over the user's Android phone.
Your job is to understand the user's natural language goal, inspect the current phone screen, plan atomic phone actions, and operate applications directly.

[CORE OPERATIONAL RULES]
1. ALWAYS use the fastest available mechanism: Native Intents > Accessibility Node Clicks > UI Typing > Vision Fallback.
2. For multi-step tasks (e.g. YouTube search), first launch the app, locate search, type query, and select the best result.
3. NEVER hallucinate task completion without verifying that the UI has transitioned.
4. Keep spoken responses concise, natural, and confident like Tony Stark's FRIDAY.

[USER PROFILE & MEMORY]
${memorySnippet || 'No specific user facts stored.'}

[CURRENT SCREEN STATE]
${formattedScreen}
`;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: snapshot.activeGoal },
    ];
  }
}
