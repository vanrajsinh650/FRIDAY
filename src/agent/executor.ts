import { PlannedAction } from './types';
import { ToolRegistry } from '../tools/registry';
import { ToolResult } from '../tools/types';
import { useAgentStore } from '../state/agentStore';
import { TelemetryLogger } from '../utils/telemetry';

export class ExecutionEngine {
  static async executeStep(action: PlannedAction): Promise<ToolResult> {
    const stepId = useAgentStore.getState().addStep({
      toolName: action.toolName,
      description: action.description,
    });

    useAgentStore.getState().updateStepStatus(stepId, 'running');
    TelemetryLogger.recordEvent('ACTION_DISPATCHED', { toolName: action.toolName });

    const startTime = Date.now();
    const result = await ToolRegistry.executeTool(action.toolName, action.parameters);
    const duration = Date.now() - startTime;

    if (result.success) {
      useAgentStore.getState().updateStepStatus(stepId, 'success', result.data, undefined, duration);
      TelemetryLogger.recordEvent('ACTION_COMPLETED', { toolName: action.toolName, durationMs: duration });
    } else {
      useAgentStore.getState().updateStepStatus(stepId, 'failed', undefined, result.error, duration);
    }

    return result;
  }
}
