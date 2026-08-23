import { AgentLoop } from './loop/agentLoop';
import { TaskManager } from './task/taskManager';
import { ReferenceResolver } from './memory/referenceResolver';
import { SessionManager } from './session/sessionManager';
import { AccessibilityModule } from '../native/AccessibilityModule';
import { useAgentStore } from '../state/agentStore';
import { TelemetryLogger } from '../utils/telemetry';
import { SemanticLayer } from './semanticLayer';
import { ActionSafetyGuard } from '../voice/actionSafetyGuard';
import { ProviderFactory } from './providers/providerFactory';
import { ModelMessage, ModelProvider } from './providers/types';
import { MemoryStore } from '../memory/store';
import { ScopedMemoryRetriever } from '../memory/retriever';
import { ConversationManager } from './conversationManager';
import { resolveIntent } from './providers/intentFastPath';

export class FridayAgent {
  private loop: AgentLoop;
  private provider: ModelProvider;

  constructor() {
    this.loop = new AgentLoop();
    this.provider = ProviderFactory.createDefault();
  }

  async executeGoal(rawGoal: string): Promise<string> {
    const taskStartTime = Date.now();
    const cleanGoal = (rawGoal || '').trim();

    // 0. PREFLIGHT SAFETY GUARD — Reject Noise & Incomplete Commands before touch/launch
    const evalResult = ActionSafetyGuard.evaluate(cleanGoal);

    if (evalResult.type === 'NOISE') {
      const fallback = "I didn't quite catch that, Boss. Say again?";
      useAgentStore.getState().setAgentState('IDLE');
      useAgentStore.getState().setLastResponse(fallback);
      return fallback;
    }

    if (evalResult.type === 'INCOMPLETE_ACTION') {
      const prompt = evalResult.clarificationPrompt || "What's the play, Boss?";
      useAgentStore.getState().setAgentState('IDLE');
      useAgentStore.getState().setLastResponse(prompt);
      SessionManager.addTurn('assistant', prompt, undefined);
      return prompt;
    }

    useAgentStore.getState().setActiveGoal(cleanGoal);
    TelemetryLogger.recordEvent('AGENT_STARTED', { goal: cleanGoal });

    try {
      const semantic = SemanticLayer.process(cleanGoal, { activeApp: undefined, recentSearch: undefined });
      TelemetryLogger.recordEvent('SEMANTIC_PROCESSED', { 
        original: rawGoal, 
        corrected: semantic.correctedTranscript,
        language: 'en' 
      });

      // 1. Resolve references against conversation & active screen
      const currentPkg = await AccessibilityModule.getForegroundPackage();
      const { resolvedGoal, resolvedApp, entities } = ReferenceResolver.resolveUserGoal(semantic.correctedTranscript, currentPkg);

      // 1.2 TIER-0 DETERMINISTIC INTENTS (Instantaneous offline replies for wake, greetings, status)
      const fastIntent = resolveIntent(resolvedGoal.toLowerCase().trim()) || resolveIntent(cleanGoal.toLowerCase().trim());
      if (fastIntent && fastIntent.toolName === 'none' && fastIntent.rawReply) {
        const spokenAnswer = fastIntent.rawReply;
        SessionManager.addTurn('user', rawGoal, undefined, { ...entities, correctedTranscript: semantic.correctedTranscript });
        SessionManager.addTurn('assistant', spokenAnswer, undefined);
        ConversationManager.addTurn('user', rawGoal);
        ConversationManager.addTurn('assistant', spokenAnswer);
        useAgentStore.getState().setAgentState('SUCCESS');
        useAgentStore.getState().setLastResponse(spokenAnswer);
        TelemetryLogger.recordEvent('TASK_COMPLETED', {
          goal: rawGoal,
          durationMs: Date.now() - taskStartTime,
        });
        return spokenAnswer;
      }

      // 1.5 CONVERSATIONAL / Q&A / TRIVIA DIRECT PATH
      if (this.isDirectConversationalQuery(resolvedGoal, evalResult.type)) {
        useAgentStore.getState().setAgentState('THINKING');
        SessionManager.addTurn('user', rawGoal, undefined, { ...entities, correctedTranscript: semantic.correctedTranscript });

        const spokenAnswer = await this.executeConversationalQuery(resolvedGoal);

        SessionManager.addTurn('assistant', spokenAnswer, undefined);
        useAgentStore.getState().setAgentState('SUCCESS');
        useAgentStore.getState().setLastResponse(spokenAnswer);

        TelemetryLogger.recordEvent('TASK_COMPLETED', {
          goal: rawGoal,
          durationMs: Date.now() - taskStartTime,
        });
        return spokenAnswer;
      }

      // Record User Turn for Device Automation
      SessionManager.addTurn('user', rawGoal, resolvedApp, { ...entities, correctedTranscript: semantic.correctedTranscript });

      // 2. Create canonical TaskState
      const task = TaskManager.createTask(resolvedGoal, resolvedApp, entities);

      // 2.5 PREFLIGHT — Accessibility gate for screen control
      const needsScreenControl = task.goalType === 'MEDIA_PLAYBACK' || task.goalType === 'MESSAGING';
      if (needsScreenControl && !(await AccessibilityModule.isServiceEnabled())) {
        AccessibilityModule.openAccessibilitySettings();
        const reply = "I need Accessibility access to control the interface, Boss. I've opened settings — please enable FRIDAY in the list.";
        useAgentStore.getState().setAgentState('ERROR');
        useAgentStore.getState().setLastResponse(reply);
        useAgentStore.getState().setError(reply);
        SessionManager.addTurn('assistant', reply, task.currentApp);
        TelemetryLogger.recordEvent('TASK_BLOCKED', { reason: 'accessibility_disabled', goalType: task.goalType });
        return reply;
      }

      // 3. Run the Iterative Agent Loop
      const result = await this.loop.run(task);

      // Record Assistant Turn
      SessionManager.addTurn('assistant', result.spokenResponse, task.currentApp);

      TelemetryLogger.recordEvent('TASK_COMPLETED', {
        goal: rawGoal,
        stepsExecuted: result.stepsExecuted,
        durationMs: Date.now() - taskStartTime,
        verified: result.success,
      });

      return result.spokenResponse;
    } catch (err: any) {
      useAgentStore.getState().setAgentState('ERROR');
      TelemetryLogger.recordEvent('TASK_FAILED', { error: err.message });
      const errorReply = "I ran into an unexpected issue, Boss. Could you repeat that?";
      useAgentStore.getState().setLastResponse(errorReply);
      return errorReply;
    }
  }

  private isDirectConversationalQuery(goal: string, evalType: string): boolean {
    const lower = goal.toLowerCase();

    // Explicit action patterns must go to TaskManager/AgentLoop
    const actionKeywords = /\b(open|launch|play|send|message|call|dial|turn on|turn off|set volume|set brightness|set alarm|close|flashlight|torch|bluetooth|wifi|hotspot)\b/i;
    if (actionKeywords.test(lower)) {
      return false;
    }

    if (evalType === 'CONVERSATIONAL') return true;

    // Knowledge / Trivia / Chat indicators
    const isQn = /^(who|what|why|how|when|where|tell me|explain|can you|could you)\b/i.test(lower);
    return isQn;
  }

  private async executeConversationalQuery(query: string): Promise<string> {
    try {
      await MemoryStore.initialize();
      const memoryFacts = ScopedMemoryRetriever.retrieveRelevantFacts(query, 'conversational');
      const conversationState = ConversationManager.getState();

      const conversationHistory: ModelMessage[] = conversationState.turns.slice(-6).map((t) => ({
        role: t.role === 'assistant' ? 'assistant' : 'user',
        content: t.content,
      }));

      const memoryContext = memoryFacts.map((f) => `- ${f.key}: ${f.value}`).join('\n');

      const systemPrompt: ModelMessage = {
        role: 'system',
        content: `You are F.R.I.D.A.Y. (Female Replacement Intelligent Digital Assistant Youth), Tony Stark's / Boss's ultra-intelligent, tactical AI assistant (voiced by Kerry Condon).
[VOICE & CONVERSATION RULES]
1. Speak exclusively in clear, natural English.
2. ALWAYS address the user as "Boss" in every interaction naturally.
3. Be tactical, crisp, witty, intelligent, and unflappable. Provide direct answers to questions.
4. Keep spoken responses concise (2 to 4 sentences max) and optimized for audio text-to-speech. Never output robotic error dumps or raw JSON leaks.
5. Do NOT use markdown symbols (no asterisks, backticks, hashes, or bullet points).
${memoryContext ? `\n[KNOWN USER FACTS]\n${memoryContext}` : ''}`,
      };

      ConversationManager.addTurn('user', query);
      const messages: ModelMessage[] = [systemPrompt, ...conversationHistory, { role: 'user', content: query }];
      const textResponse = await this.provider.generateText(messages);
      const cleanResponse = textResponse?.trim() || "All systems nominal, Boss. How can I assist?";
      ConversationManager.addTurn('assistant', cleanResponse);

      return cleanResponse;
    } catch (_err) {
      return "I'm having a little trouble pulling that up right now, Boss.";
    }
  }
}
