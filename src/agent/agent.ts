import { AgentLoop } from './loop/agentLoop';
import { TaskManager } from './task/taskManager';
import { ReferenceResolver } from './memory/referenceResolver';
import { SessionManager } from './session/sessionManager';
import { AccessibilityModule } from '../native/AccessibilityModule';
import { FloatingOverlayModule } from '../native/FloatingOverlayModule';
import { useAgentStore } from '../state/agentStore';
import { TelemetryLogger } from '../utils/telemetry';
import { SemanticLayer } from './semanticLayer';
import { ActionSafetyGuard } from '../voice/actionSafetyGuard';
import { ProviderFactory } from './providers/providerFactory';
import { ModelMessage, ModelProvider } from './providers/types';
import { MemoryStore } from '../memory/store';
import { ScopedMemoryRetriever } from '../memory/retriever';
import { PersonaManager } from '../memory/personaManager';
import { ConversationManager } from './conversationManager';
import { resolveIntent } from './providers/intentFastPath';
import { VisionPerception } from './perception/visionPerception';

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
        await FloatingOverlayModule.updateOverlay('Verified ✓', 'SUCCESS');
        TelemetryLogger.recordEvent('TASK_COMPLETED', {
          goal: rawGoal,
          durationMs: Date.now() - taskStartTime,
        });
        return spokenAnswer;
      }

      // 1.3 DIRECT SCREEN PERCEPTION QUERY ("What's on my screen?", "What is this?", "Summarize this page", "Who is this?")
      if (this.isScreenPerceptionQuery(resolvedGoal) || this.isScreenPerceptionQuery(cleanGoal)) {
        useAgentStore.getState().setAgentState('THINKING');
        SessionManager.addTurn('user', rawGoal, undefined, { ...entities, correctedTranscript: semantic.correctedTranscript });

        const spokenAnswer = await this.executeScreenPerceptionQuery(resolvedGoal);

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
        await FloatingOverlayModule.showOverlay('Thinking...', 'THINKING');
        SessionManager.addTurn('user', rawGoal, undefined, { ...entities, correctedTranscript: semantic.correctedTranscript });

        const spokenAnswer = await this.executeConversationalQuery(resolvedGoal);

        SessionManager.addTurn('assistant', spokenAnswer, undefined);
        useAgentStore.getState().setAgentState('SUCCESS');
        useAgentStore.getState().setLastResponse(spokenAnswer);
        await FloatingOverlayModule.updateOverlay('Verified ✓', 'SUCCESS');

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
        await FloatingOverlayModule.updateOverlay('Accessibility required', 'ERROR');
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
    const lower = goal.toLowerCase().trim();

    if (resolveIntent(lower)) {
      return false;
    }

    // Explicit action patterns must go to TaskManager/AgentLoop
    const actionKeywords = /\b(open|launch|play|send|message|call|dial|turn on|turn off|set volume|set brightness|set alarm|close|flashlight|torch|bluetooth|wifi|hotspot|kill|force stop|force-stop|root|shizuku|elevated|permission)\b/i;
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

      const memoryContext = ScopedMemoryRetriever.formatContext(query, 'conversational');

      const systemPrompt: ModelMessage = {
        role: 'system',
        content: `${PersonaManager.getSystemPersonaPrompt()}\n\n${memoryContext}`,
      };

      ConversationManager.addTurn('user', query);
      const messages: ModelMessage[] = [systemPrompt, ...conversationHistory, { role: 'user', content: query }];
      const textResponse = await this.provider.generateText(messages);
      const formattedResponse = PersonaManager.formatSpokenResponse(
        textResponse?.trim() || 'All systems nominal, Boss. How can I assist?'
      );
      ConversationManager.addTurn('assistant', formattedResponse);

      return formattedResponse;
    } catch (_err) {
      return "I'm having a little trouble pulling that up right now, Boss.";
    }
  }

  private isScreenPerceptionQuery(goal: string): boolean {
    const lower = (goal || '').toLowerCase().trim();
    const screenPatterns = /\b(what('?s| is) on (my |the )?screen|what am i looking at|what is this|read (this|the screen|my screen)|summarize (this|the screen|the page)|explain what is on (my )?screen|who is this|who sent this|describe (my |the )?screen|what is currently open)\b/i;
    return screenPatterns.test(lower);
  }

  private async executeScreenPerceptionQuery(query: string): Promise<string> {
    try {
      useAgentStore.getState().setAgentState('THINKING');
      await FloatingOverlayModule.showOverlay('Inspecting screen...', 'THINKING');

      const screenTree = await AccessibilityModule.inspectScreen();
      const rawPkg = screenTree?.activePackage || 'System';
      const cleanPkg = rawPkg.replace('com.google.android.', '').replace('com.', '').replace('org.', '');
      const appName = cleanPkg.charAt(0).toUpperCase() + cleanPkg.slice(1);

      // Extract prominent textual elements
      const visibleTexts = (screenTree?.nodes || [])
        .map((n) => (n.text || n.contentDescription || '').trim())
        .filter((t) => t.length > 1 && !/^(back|home|recents|battery|wifi|clock)$/i.test(t))
        .slice(0, 25)
        .join(' | ');

      let visionSummary = '';
      if (VisionPerception.isTreeSparse(screenTree)) {
        const visualAnalysis = await VisionPerception.analyzeScreen('Describe what is visible on this screen concisely.');
        if (visualAnalysis?.description) {
          visionSummary = visualAnalysis.description;
        }
      }

      const screenSummary = [
        `Active Foreground App: ${appName}`,
        visibleTexts ? `Visible UI Elements: ${visibleTexts}` : '',
        visionSummary ? `Visual Content: ${visionSummary}` : '',
      ].filter(Boolean).join('\n');

      const prompt: ModelMessage[] = [
        {
          role: 'system',
          content: `${PersonaManager.getSystemPersonaPrompt()}\n\nYou are inspecting the user's active mobile screen in real-time.\n${screenSummary}`,
        },
        {
          role: 'user',
          content: `User query: "${query}". Describe what is currently on the screen concisely in 1-2 conversational sentences. Address the user as "Boss" naturally.`,
        },
      ];

      const response = await this.provider.generateText(prompt);
      const formatted = PersonaManager.formatSpokenResponse(
        response?.trim() || `You are currently viewing ${appName}, Boss.`
      );

      await FloatingOverlayModule.updateOverlay('Screen Inspected ✓', 'SUCCESS');
      return formatted;
    } catch (_err) {
      return "I'm looking at your screen, Boss, but couldn't parse the current view clearly.";
    }
  }
}
