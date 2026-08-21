import { ContextManager } from './context';
import { Planner } from './planner';
import { ExecutionEngine } from './executor';
import { VerificationEngine } from './verifier';
import { RecoveryManager } from './recovery';
import { useAgentStore } from '../state/agentStore';
import { TelemetryLogger } from '../utils/telemetry';

export class FridayAgent {
  private planner: Planner;

  constructor() {
    this.planner = new Planner();
  }

  async executeGoal(rawGoal: string): Promise<string> {
    const taskStartTime = Date.now();
    useAgentStore.getState().setActiveGoal(rawGoal);
    useAgentStore.getState().setAgentState('PLANNING');
    TelemetryLogger.recordEvent('AGENT_STARTED', { goal: rawGoal });

    try {
      // 1. OBSERVE: Assemble screen & memory context
      const contextSnapshot = await ContextManager.assembleContext(rawGoal);

      // 2. PLAN: Formulate atomic steps
      const plan = await this.planner.createPlan(contextSnapshot);
      TelemetryLogger.recordEvent('PLAN_CREATED', { stepCount: plan.length, latencyMs: Date.now() - taskStartTime });

      // 3. ACT & VERIFY LOOP
      useAgentStore.getState().setAgentState('EXECUTING');
      for (const step of plan) {
        let success = false;
        let retries = 0;

        while (!success && retries < 3) {
          const result = await ExecutionEngine.executeStep(step);
          if (result.success) {
            useAgentStore.getState().setAgentState('VERIFYING');
            const verified = await VerificationEngine.verifyStepOutcome(step);
            if (verified) {
              success = true;
            } else {
              retries++;
              await RecoveryManager.attemptRecovery(step, retries);
            }
          } else {
            retries++;
            await RecoveryManager.attemptRecovery(step, retries);
          }
        }

        if (!success) {
          throw new Error(`Failed to complete step: ${step.description}`);
        }
      }

      useAgentStore.getState().setAgentState('SUCCESS');
      const totalDuration = Date.now() - taskStartTime;
      TelemetryLogger.recordEvent('TASK_COMPLETED', { durationMs: totalDuration });

      const finalResponse = `Completed, boss. ${rawGoal} has been executed.`;
      useAgentStore.getState().setLastResponse(finalResponse);
      return finalResponse;
    } catch (err: any) {
      useAgentStore.getState().setError(err.message || 'Task failed');
      TelemetryLogger.recordEvent('TASK_FAILED', { error: err.message });
      return `I encountered an issue: ${err.message}`;
    }
  }
}
