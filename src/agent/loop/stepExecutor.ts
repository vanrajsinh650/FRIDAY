import { PlannedAction } from '../types';
import { ActionRecord, ToolExecutionPolicy } from '../task/types';
import { ToolRegistry } from '../../tools/registry';
import { SafetyGuard } from '../safetyGuard';
import { SessionManager } from '../session/sessionManager';
import { useAgentStore } from '../../state/agentStore';
import { TelemetryLogger } from '../../utils/telemetry';
import { RootControlModule } from '../../native/RootControlModule';
import { ToolResult } from '../../tools/types';

export class StepExecutor {
  private static getPolicy(toolName: string): ToolExecutionPolicy {
    const isUIMutating = [
      'click_node',
      'click_text',
      'click_first_result',
      'click_send_button',
      'type_text',
      'press_enter',
      'scroll_page',
      'press_back',
      'press_home',
      'close_app',
      'close_current_app',
      'close_background_apps',
      'elevated_tap',
      'elevated_text',
      'elevated_key',
      'kill_app_silent',
      'visual_tap',
    ].includes(toolName);

    return {
      parallelSafe: !isUIMutating,
      mutatesUI: isUIMutating,
      requiresForegroundApp: isUIMutating && toolName !== 'kill_app_silent',
      requiresConfirmation: ['factory_reset', 'format_disk', 'delete_all_contacts'].includes(toolName),
    };
  }

  private static async attemptElevatedFallback(action: PlannedAction): Promise<ToolResult | null> {
    try {
      const status = await RootControlModule.getElevatedStatus();
      if (!status.elevatedAvailable) {
        return null;
      }

      if (action.toolName === 'close_app' && action.parameters?.packageName) {
        return await ToolRegistry.executeTool('kill_app_silent', { packageName: action.parameters.packageName });
      }
      if (action.toolName === 'type_text' && action.parameters?.text) {
        return await ToolRegistry.executeTool('elevated_text', { text: action.parameters.text });
      }
      if (action.toolName === 'press_back') {
        return await ToolRegistry.executeTool('elevated_key', { keyCode: 4 });
      }
      if (action.toolName === 'press_home') {
        return await ToolRegistry.executeTool('elevated_key', { keyCode: 3 });
      }
      if (action.toolName === 'press_enter') {
        return await ToolRegistry.executeTool('elevated_key', { keyCode: 66 });
      }
      if (
        action.toolName === 'click_node' &&
        action.parameters?.x !== undefined &&
        action.parameters?.y !== undefined
      ) {
        return await ToolRegistry.executeTool('elevated_tap', { x: action.parameters.x, y: action.parameters.y });
      }
    } catch (_e) {
      return null;
    }
    return null;
  }

  static async executeStep(action: PlannedAction): Promise<ActionRecord> {
    const stepId = useAgentStore.getState().addStep({
      toolName: action.toolName,
      description: action.description,
    });

    useAgentStore.getState().updateStepStatus(stepId, 'running');
    SessionManager.emitEvent('ACTION_STARTED', { toolName: action.toolName, parameters: action.parameters });

    const policy = this.getPolicy(action.toolName);

    // Safety Policy Check
    const safetyCheck = SafetyGuard.isActionSafe(action.toolName, action.parameters);
    if (!safetyCheck.safe) {
      const errorMsg = safetyCheck.reason || 'Safety Shield blocked action.';
      useAgentStore.getState().updateStepStatus(stepId, 'failed', undefined, errorMsg, 0);
      SessionManager.emitEvent('ACTION_FAILED', { toolName: action.toolName, error: errorMsg });

      return {
        id: stepId,
        toolName: action.toolName,
        parameters: action.parameters,
        success: false,
        durationMs: 0,
        stateChanged: false,
        error: errorMsg,
      };
    }

    const startTime = Date.now();
    let result = await ToolRegistry.executeTool(action.toolName, action.parameters);

    // If primary standard tool fails, attempt privileged / elevated fallback (ADR-014)
    if (!result.success) {
      const fallbackResult = await this.attemptElevatedFallback(action);
      if (fallbackResult) {
        if (fallbackResult.success) {
          result = fallbackResult;
        } else {
          result = {
            success: false,
            error: `${result.error || 'Primary action failed'}. Elevated fallback failed: ${fallbackResult.error || 'Privilege execution failed'}`,
            data: fallbackResult.data || result.data,
          };
        }
      }
    }

    const duration = Date.now() - startTime;

    if (result.success) {
      useAgentStore.getState().updateStepStatus(stepId, 'success', result.data, undefined, duration);
      SessionManager.emitEvent('ACTION_COMPLETED', { toolName: action.toolName, durationMs: duration });
      TelemetryLogger.recordEvent('ACTION_COMPLETED', { toolName: action.toolName, durationMs: duration });

      return {
        id: stepId,
        toolName: action.toolName,
        parameters: action.parameters,
        success: true,
        durationMs: duration,
        stateChanged: policy.mutatesUI,
        resultData: result.data,
      };
    } else {
      useAgentStore.getState().updateStepStatus(stepId, 'failed', undefined, result.error, duration);
      SessionManager.emitEvent('ACTION_FAILED', { toolName: action.toolName, error: result.error });

      return {
        id: stepId,
        toolName: action.toolName,
        parameters: action.parameters,
        success: false,
        durationMs: duration,
        stateChanged: false,
        error: result.error,
        resultData: result.data,
      };
    }
  }
}
