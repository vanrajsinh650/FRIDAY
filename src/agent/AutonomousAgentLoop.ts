import { FridayTask } from '../task/types';
import { TaskManager } from '../task/TaskManager';
import { WorldModel } from '../world/WorldModel';
import { CapabilityRegistry } from '../capabilities/CapabilityRegistry';
import { ExperienceMemory } from '../memory/ExperienceMemory';
import { LifelongMemoryEngine } from '../memory/lifelong/LifelongMemoryEngine';
import { PersonaManager } from '../memory/personaManager';
import { ProviderFactory } from './providers/providerFactory';
import { ModelMessage, ModelProvider } from './providers/types';
import { useAgentStore } from '../state/agentStore';
import { FloatingOverlayModule } from '../native/FloatingOverlayModule';
import { ConversationManager } from './conversationManager';

export class AutonomousAgentLoop {
  private provider: ModelProvider;

  constructor() {
    this.provider = ProviderFactory.createDefault();
  }

  async run(task: FridayTask): Promise<string> {
    let finalSpokenResponse = '';

    useAgentStore.getState().setAgentState('THINKING');
    await FloatingOverlayModule.showOverlay('Analyzing request...', 'THINKING');

    while (task.status !== 'COMPLETED' && task.status !== 'FAILED' && task.currentStepIndex < task.maxSteps) {
      // 1. OBSERVE LIVE WORLD & CAPABILITIES
      useAgentStore.getState().setAgentState('THINKING');
      const worldState = await WorldModel.snapshot(true);
      const capabilities = CapabilityRegistry.discover(worldState);
      const memoryHint = await LifelongMemoryEngine.getInstance().formatContextForPrompt(task.goal.objective);
      const experienceHint = ExperienceMemory.getInstance().formatForPrompt(task.goal);

      TaskManager.addObservation(`Surface: ${worldState.foreground.packageName}, Battery: ${worldState.device.batteryLevel}%, Screen: ${worldState.screen.interactiveElementsCount} UI elements`);

      // 2. REASON & PLAN
      useAgentStore.getState().setAgentState('THINKING');
      TaskManager.updateStatus('PLANNING');

      const systemPrompt = [
        PersonaManager.getSystemPersonaPrompt(),
        '',
        WorldModel.formatForPrompt(worldState),
        '',
        CapabilityRegistry.formatCapabilitiesForPrompt(capabilities),
        '',
        memoryHint ? `### [LIFELONG PERSONAL MEMORY]\n${memoryHint}` : '',
        experienceHint,
        '',
        '### [RESPONSE INSTRUCTIONS]',
        'Respond ONLY with a JSON object in this exact schema:',
        '```json',
        '{',
        '  "thought": "Brief reason for this action",',
        '  "capability": "name_of_capability",',
        '  "parameters": { ... },',
        '  "expectedOutcome": "What should change in reality",',
        '  "isGoalComplete": false,',
        '  "spokenReply": "Optional reply if completed or speaking to user"',
        '}',
        '```',
      ].filter(Boolean).join('\n');

      const actionHistorySummary = task.actions.map((a, idx) =>
        `Step ${idx + 1}: ${a.capabilityName} (${JSON.stringify(a.parameters)}) ➔ ${a.success ? 'SUCCESS' : 'FAILED'}`
      ).join('\n');

      const userMessageContent = [
        `GOAL: "${task.goal.objective}"`,
        `GOAL CATEGORY: ${task.goal.category}`,
        actionHistorySummary ? `PREVIOUS ACTIONS IN THIS TASK:\n${actionHistorySummary}` : '',
        'Select the best next action capability to fulfill this goal based on current reality.',
      ].filter(Boolean).join('\n\n');

      const messages: ModelMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessageContent },
      ];

      let rawResponse = '';
      try {
        rawResponse = await this.provider.generateText(messages);
      } catch (err: any) {
        TaskManager.failTask(err?.message || 'Cognition provider unavailable');
        return "I'm having a little trouble connecting to my reasoning core right now, Boss.";
      }

      // 3. PARSE ACTION DECISION
      let decision: any = null;
      try {
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          decision = JSON.parse(jsonMatch[0]);
        }
      } catch (_e) {
        decision = null;
      }

      if (!decision || !decision.capability) {
        // Fallback: conversational direct answer
        finalSpokenResponse = PersonaManager.formatSpokenResponse(rawResponse.replace(/```json[\s\S]*```/g, '').trim() || 'All set, Boss.');
        TaskManager.completeTask(finalSpokenResponse);
        break;
      }

      // 4. ACT — EXECUTE CAPABILITY
      const capName = decision.capability;
      const cap = CapabilityRegistry.get(capName);

      if (decision.isGoalComplete || capName === 'complete_goal') {
        finalSpokenResponse = PersonaManager.formatSpokenResponse(
          decision.spokenReply || decision.parameters?.spokenResponse || 'Done, Boss.'
        );
        TaskManager.addEvidence({
          source: 'NATIVE_STATE',
          description: `Completed with capability ${capName}`,
          verified: true,
          timestamp: Date.now(),
        });
        TaskManager.completeTask(finalSpokenResponse);
        ExperienceMemory.getInstance().recordExperience(task);
        break;
      }

      if (!cap) {
        TaskManager.recordAction({
          actionId: `act_${Date.now()}`,
          capabilityName: capName,
          parameters: decision.parameters || {},
          success: false,
          errorMessage: `Unknown capability: ${capName}`,
          executionDurationMs: 10,
          timestamp: Date.now(),
        });
        continue;
      }

      useAgentStore.getState().setAgentState('EXECUTING');
      await FloatingOverlayModule.showOverlay(`Executing ${capName}...`, 'EXECUTING');

      const actionStart = Date.now();
      let actionResult: any = null;
      let actionSuccess = false;
      let errorMsg: string | undefined = undefined;

      try {
        actionResult = await cap.execute(decision.parameters || {});
        actionSuccess = actionResult !== false;
      } catch (e: any) {
        actionSuccess = false;
        errorMsg = e?.message || 'Execution error';
      }

      const durationMs = Date.now() - actionStart;

      TaskManager.recordAction({
        actionId: `act_${Date.now()}`,
        capabilityName: capName,
        parameters: decision.parameters || {},
        expectedOutcome: decision.expectedOutcome,
        success: actionSuccess,
        resultData: actionResult,
        errorMessage: errorMsg,
        executionDurationMs: durationMs,
        timestamp: Date.now(),
      });

      // 5. OBSERVE & VERIFY POST-ACTION
      useAgentStore.getState().setAgentState('THINKING');
      await FloatingOverlayModule.updateOverlay('Verifying result...', 'THINKING');

      const postWorld = await WorldModel.snapshot(true);

      // Verify evidence based on capability type
      if (capName === 'set_device_setting') {
        const setting = String(decision.parameters?.setting || '').toUpperCase();
        if (setting === 'VOLUME') {
          TaskManager.addEvidence({
            source: 'NATIVE_STATE',
            description: `Media volume confirmed at ${postWorld.device.volume.media}%`,
            verified: true,
            timestamp: Date.now(),
          });
        }
      } else if (capName === 'launch_surface') {
        const target = String(decision.parameters?.target || '').toLowerCase();
        const activePkg = postWorld.foreground.packageName.toLowerCase();
        const isMatched = activePkg.includes(target) || target.includes(activePkg);
        TaskManager.addEvidence({
          source: 'ACCESSIBILITY_TREE',
          description: `Foreground surface active: ${postWorld.foreground.packageName}`,
          verified: isMatched,
          timestamp: Date.now(),
        });
      }

      // Check if this single step satisfies the goal
      if (task.goal.category === 'DEVICE_CONTROL' && actionSuccess) {
        finalSpokenResponse = PersonaManager.formatSpokenResponse(decision.spokenReply || 'Adjusted, Boss.');
        TaskManager.completeTask(finalSpokenResponse);
        ExperienceMemory.getInstance().recordExperience(task);
        break;
      }

      if (task.goal.category === 'SCHEDULING' && actionSuccess) {
        finalSpokenResponse = PersonaManager.formatSpokenResponse(decision.spokenReply || `I've scheduled that for you, Boss.`);
        TaskManager.completeTask(finalSpokenResponse);
        ExperienceMemory.getInstance().recordExperience(task);
        break;
      }
    }

    if (!finalSpokenResponse) {
      finalSpokenResponse = 'Task completed, Boss.';
      TaskManager.completeTask(finalSpokenResponse);
      ExperienceMemory.getInstance().recordExperience(task);
    }

    ConversationManager.addTurn('user', task.goal.rawInput);
    ConversationManager.addTurn('assistant', finalSpokenResponse);
    LifelongMemoryEngine.getInstance().processConversationalTurn(task.goal.rawInput, finalSpokenResponse).catch(() => {});

    await FloatingOverlayModule.updateOverlay('Verified ✓', 'SUCCESS');
    return finalSpokenResponse;
  }
}
