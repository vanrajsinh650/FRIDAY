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
      let isGoalComplete = false;
      let stepCount = 0;
      const maxSteps = 10;
      const history: string[] = [];

      while (!isGoalComplete && stepCount < maxSteps) {
        stepCount++;

        // 1. OBSERVE: Refresh screen & memory context
        const contextSnapshot = await ContextManager.assembleContext(rawGoal, history);

        // 2. PLAN: Ask model provider for the next action based on current UI state
        useAgentStore.getState().setAgentState('PLANNING');
        const plan = await this.planner.createPlan(contextSnapshot);
        TelemetryLogger.recordEvent('PLAN_CREATED', {
          stepCount: plan.length,
          latencyMs: Date.now() - taskStartTime,
        });

        if (plan.length === 0) {
          isGoalComplete = true;
          break;
        }

        // 3. ACT: Execute the step
        useAgentStore.getState().setAgentState('EXECUTING');
        const currentStep = plan[0];
        let stepSuccess = false;
        let retries = 0;

        while (!stepSuccess && retries < 3) {
          const result = await ExecutionEngine.executeStep(currentStep);
          if (result.success) {
            useAgentStore.getState().setAgentState('VERIFYING');
            const verified = await VerificationEngine.verifyStepOutcome(currentStep);
            if (verified) {
              stepSuccess = true;
              history.push(`Executed ${currentStep.toolName}: ${JSON.stringify(currentStep.parameters)} -> Success`);
            } else {
              retries++;
              await RecoveryManager.attemptRecovery(currentStep, retries);
            }
          } else {
            retries++;
            await RecoveryManager.attemptRecovery(currentStep, retries);
          }
        }

        if (!stepSuccess) {
          throw new Error(`Failed to complete step: ${currentStep.description}`);
        }

        // Stop if action was terminal (e.g. system control / single intent)
        if (currentStep.toolName === 'get_battery_status' || currentStep.toolName === 'set_volume' || currentStep.toolName === 'set_brightness' || currentStep.toolName === 'set_flashlight') {
          isGoalComplete = true;
        } else if (stepCount >= 4) {
          // Finished standard exploration sequence
          isGoalComplete = true;
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
