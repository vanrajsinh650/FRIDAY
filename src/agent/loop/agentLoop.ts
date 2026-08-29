// src/agent/loop/agentLoop.ts

import { TaskState } from '../task/types';
import { TaskManager } from '../task/taskManager';
import { SessionManager } from '../session/sessionManager';
import { StepExecutor } from './stepExecutor';
import { Planner } from '../planner';
import { ContextManager } from '../context';
import { RecoveryManager } from '../recovery';
import { AccessibilityModule } from '../../native/AccessibilityModule';
import { SystemControlModule } from '../../native/SystemControlModule';
import { FloatingOverlayModule } from '../../native/FloatingOverlayModule';
import { useAgentStore } from '../../state/agentStore';

export class AgentLoop {
  private planner: Planner;

  constructor() {
    this.planner = new Planner();
  }

  private sleep(ms: number): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return Promise.resolve();
    }
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async run(task: TaskState): Promise<{ success: boolean; spokenResponse: string; stepsExecuted: number }> {
    const taskStartTime = Date.now();
    const history: string[] = [];
    let finalSpokenResponse = '';
    let lastExecutedTool = '';
    let lastToolResultData: any = null;

    await FloatingOverlayModule.showOverlay('Planning next move...', 'PLANNING');

    while (!task.verified && task.stepCount < task.maxSteps) {
      if (SessionManager.isCancelled()) {
        task.status = 'CANCELLED';
        SessionManager.emitEvent('TASK_CANCELLED', { taskId: task.id, reason: 'Session cancelled' });
        await FloatingOverlayModule.updateOverlay('Task stopped', 'IDLE');
        return { success: false, spokenResponse: 'Task stopped as requested, Boss.', stepsExecuted: task.stepCount };
      }

      task.stepCount++;

      // 1. OBSERVE LIVE SCREEN
      useAgentStore.getState().setAgentState('PLANNING');
      const snapshot = await ContextManager.assembleContext(task, history);
      const currentFingerprint = AccessibilityModule.computeFingerprint(snapshot.screenTree);
      SessionManager.updateScreenFingerprint(currentFingerprint);
      SessionManager.emitEvent('SCREEN_OBSERVED', { activePackage: snapshot.screenTree.activePackage, fingerprint: currentFingerprint });

      // 2. REASON
      const plannedAction = await this.planner.planNextAction(snapshot);
      SessionManager.emitEvent('AGENT_REASONED', { action: plannedAction.toolName, params: plannedAction.parameters });

      if (plannedAction.toolName === 'none' || plannedAction.toolName === 'speak_response') {
        if (task.actionHistory.length === 0) {
          finalSpokenResponse =
            plannedAction.parameters?.reply ||
            plannedAction.description ||
            'All set, Boss.';
        }
        task.verified = true;
        task.status = 'COMPLETED';
        break;
      }

      // 3. ACT
      useAgentStore.getState().setAgentState('EXECUTING');
      await FloatingOverlayModule.showOverlay(plannedAction.description || `Executing ${plannedAction.toolName}...`, 'EXECUTING');

      const stepRecord = await StepExecutor.executeStep(plannedAction);
      lastExecutedTool = plannedAction.toolName;
      task.actionHistory.push(stepRecord);
      SessionManager.addRecentAction(`${plannedAction.toolName}: ${stepRecord.success ? 'OK' : 'FAIL'}`);

      // Capture tool result from store
      const allSteps = useAgentStore.getState().steps;
      if (allSteps.length > 0) {
        lastToolResultData = allSteps[allSteps.length - 1]?.result;
      }

      // 4. STATE-AWARE WAIT: Allow animations to settle
      if (
        plannedAction.toolName === 'launch_app' ||
        plannedAction.toolName === 'click_first_result' ||
        plannedAction.toolName === 'click_send_button' ||
        plannedAction.toolName === 'play_media' ||
        plannedAction.toolName === 'enter_fullscreen'
      ) {
        await this.sleep(1200);
      } else {
        await this.sleep(300);
      }

      // 5. POST-ACTION OBSERVATION & FINGERPRINT COMPARISON
      useAgentStore.getState().setAgentState('VERIFYING');
      await FloatingOverlayModule.updateOverlay('Verifying action...', 'VERIFYING');
      const updatedScreen = await AccessibilityModule.inspectScreen();
      const newFingerprint = AccessibilityModule.computeFingerprint(updatedScreen);

      if (newFingerprint === currentFingerprint && plannedAction.toolName.startsWith('click')) {
        task.retryCount++;
        SessionManager.emitEvent('VERIFICATION_FAILED', { retryCount: task.retryCount, action: plannedAction.toolName });
        if (task.retryCount >= 2) {
          await RecoveryManager.attemptRecovery(plannedAction, task.retryCount);
        }
      } else {
        task.retryCount = 0;
        history.push(`Step ${task.stepCount}: ${plannedAction.toolName} -> OK`);
      }

      // 6. POST-ACTION TERMINAL CONDITION VERIFICATION
      const updatedIsPlaying = await SystemControlModule.isMediaPlaying();
      if (TaskManager.isTerminalConditionMet(task, updatedScreen, updatedIsPlaying, lastExecutedTool)) {
        task.verified = true;
        task.status = 'COMPLETED';
        SessionManager.emitEvent('VERIFICATION_PASSED', { taskId: task.id });
        break;
      }
    }

    // 7. SYNTHESIZE FINAL SPOKEN CONFIRMATION
    if (!finalSpokenResponse) {
      const lastAction = task.actionHistory[task.actionHistory.length - 1];
      const tool = lastAction?.toolName;

      if (tool === 'get_memory_facts') {
        const facts = lastToolResultData?.data?.facts || lastToolResultData?.facts || [];
        if (facts.length > 0) {
          const factText = facts.map((f: any) => `${f.key}: ${f.value}`).join(', ');
          finalSpokenResponse = `Here is what I have on record, Boss: ${factText}.`;
        } else {
          finalSpokenResponse = "I don't have any saved facts stored for that yet, Boss.";
        }
      } else if (tool === 'get_current_time') {
        const timeObj = await SystemControlModule.getCurrentTime();
        finalSpokenResponse = `It is currently ${timeObj.time} on ${timeObj.date}, Boss.`;
      } else if (tool === 'get_battery_status') {
        const bm = await SystemControlModule.getBatteryStatus();
        finalSpokenResponse = `Your battery is at ${bm.level || 50}%, Boss ${bm.isCharging ? 'and currently charging' : ''}.`;
      } else if (tool === 'toggle_wifi' || tool === 'get_wifi_status') {
        finalSpokenResponse = lastToolResultData?.data?.summary || lastToolResultData?.summary || 'Wi-Fi settings updated, Boss.';
      } else if (tool === 'toggle_bluetooth' || tool === 'get_bluetooth_status') {
        finalSpokenResponse = lastToolResultData?.data?.summary || lastToolResultData?.summary || 'Bluetooth settings updated, Boss.';
      } else if (tool === 'toggle_hotspot') {
        finalSpokenResponse = lastToolResultData?.data?.summary || lastToolResultData?.summary || 'Hotspot settings opened, Boss.';
      } else if (tool === 'get_device_capabilities') {
        finalSpokenResponse = lastToolResultData?.data?.summary || lastToolResultData?.summary || 'Device capabilities retrieved, Boss.';
      } else if (tool === 'read_notifications') {
        finalSpokenResponse = lastToolResultData?.data?.summary || lastToolResultData?.summary || 'You have no new notifications, Boss.';
      } else if (tool === 'set_flashlight') {
        const enabled = lastAction?.parameters?.enabled;
        finalSpokenResponse = enabled ? 'Flashlight is on, Boss.' : 'Flashlight is off, Boss.';
      } else if (tool === 'set_volume') {
        const vol = lastAction?.parameters?.percentage;
        finalSpokenResponse = `Volume set to ${vol}%, Boss.`;
      } else if (tool === 'set_brightness') {
        const br = lastAction?.parameters?.percentage;
        finalSpokenResponse = `Brightness set to ${br}%, Boss.`;
      } else if (tool === 'set_ringer_mode') {
        const mode = lastAction?.parameters?.mode;
        finalSpokenResponse = `Ringer mode set to ${mode}, Boss.`;
      } else if (tool === 'set_alarm') {
        finalSpokenResponse = lastToolResultData?.data?.summary || lastToolResultData?.summary || 'Your alarm has been set, Boss.';
      } else if (tool === 'dismiss_alarm') {
        finalSpokenResponse = 'Alarm dismissed, Boss.';
      } else if (tool === 'show_alarms') {
        finalSpokenResponse = 'Clock and alarms opened, Boss.';
      } else if (tool === 'close_background_apps') {
        finalSpokenResponse = 'Background apps cleared, Boss.';
      } else if (tool === 'close_current_app' || tool === 'close_app') {
        finalSpokenResponse = 'App closed, Boss.';
      } else if (tool === 'kill_app_silent') {
        const pkg = lastAction?.parameters?.packageName || 'app';
        finalSpokenResponse = `Force stopped ${pkg}, Boss.`;
      } else if (tool === 'check_elevated_status') {
        const status = lastToolResultData?.data || lastToolResultData;
        const tier = status?.activeTier || 'NONE';
        if (tier === 'SHIZUKU') {
          finalSpokenResponse = 'Shizuku privileged control is active and authorized, Boss.';
        } else if (tier === 'ROOT') {
          finalSpokenResponse = 'Root elevated control is active and authorized, Boss.';
        } else {
          finalSpokenResponse = 'No elevated privileges are currently active, Boss.';
        }
      } else if (task.goalType === 'MEDIA_PLAYBACK') {
        finalSpokenResponse = 'Playing that for you now, Boss.';
      } else if (task.goalType === 'MESSAGING') {
        finalSpokenResponse = 'Your message has been sent, Boss.';
      } else if (tool === 'launch_app') {
        const rawApp = lastAction?.parameters?.packageNameOrName || lastAction?.parameters?.packageName || 'app';
        const cleanApp = rawApp.replace('com.google.android.apps.', '').replace('com.google.android.', '').replace('com.', '');
        const formattedApp = cleanApp.charAt(0).toUpperCase() + cleanApp.slice(1);
        finalSpokenResponse = `Opened ${formattedApp}, Boss. What's next?`;
      } else {
        finalSpokenResponse = 'Task completed, Boss.';
      }
    }

    // Honesty gate: only announce success when the task actually verified.
    if (task.verified) {
      useAgentStore.getState().setAgentState('SUCCESS');
      useAgentStore.getState().setLastResponse(finalSpokenResponse);
      await FloatingOverlayModule.updateOverlay('Verified ✓', 'SUCCESS');
      if (process.env.NODE_ENV !== 'test') {
        setTimeout(() => {
          FloatingOverlayModule.updateOverlay("What's next, Boss?", 'IDLE');
          useAgentStore.getState().setAgentState('IDLE');
        }, 2500);
      }
    } else {
      if (task.goalType === 'MEDIA_PLAYBACK') {
        finalSpokenResponse = "I opened YouTube, but couldn't verify if the video started playing, Boss.";
      } else if (task.goalType === 'MESSAGING') {
        finalSpokenResponse = "I opened WhatsApp, but couldn't verify if the message was sent, Boss.";
      } else {
        finalSpokenResponse = "I couldn't fully complete that, Boss. Want me to try again?";
      }
      useAgentStore.getState().setLastResponse(finalSpokenResponse);
      useAgentStore.getState().setError(finalSpokenResponse);
      await FloatingOverlayModule.updateOverlay('Action unverified', 'ERROR');
    }
    SessionManager.emitEvent('TASK_COMPLETED', {
      taskId: task.id,
      steps: task.stepCount,
      durationMs: Date.now() - taskStartTime,
      verified: task.verified,
    });

    return {
      success: task.verified,
      spokenResponse: finalSpokenResponse,
      stepsExecuted: task.stepCount,
    };
  }
}
