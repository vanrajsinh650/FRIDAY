import { GoalType, TaskState, TerminalCondition, SteeringUpdate } from './types';
import { ScreenTree } from '../../native/types';
import { SessionManager } from '../session/sessionManager';
import { IntentValidationFilter } from '../intent/IntentValidationFilter';

class TaskManagerClass {
  private activeTask: TaskState | null = null;

  createTask(rawGoal: string, targetApp?: string, entities?: Record<string, string>): TaskState {
    const lower = rawGoal.toLowerCase();
    const validated = IntentValidationFilter.filterAndDisambiguate(rawGoal);
    let goalType: GoalType = 'APP_OPERATION';
    const terminalConditions: TerminalCondition[] = [];

    // 1. Conversational Queries & Questions (e.g. "Can you sing my song?", "What is...", "Tell me...")
    const isQuestionOrChat = /^(can you|could you|sing|tell me|who|what|why|how|when|where|explain|joke|poem)\b/i.test(lower);
    if (isQuestionOrChat && !lower.startsWith('open ') && !lower.startsWith('launch ')) {
      goalType = 'CONVERSATIONAL';
      terminalConditions.push({
        type: 'SINGLE_ACTION_DONE',
        description: 'Conversational response formulated',
      });
    } else if (
      validated.intentClass === 'NAVIGATION' ||
      ((lower.startsWith('open ') || lower.startsWith('launch ') || lower.startsWith('khol ') || lower.startsWith('chalu ')) &&
        !lower.includes(' and ') &&
        !lower.includes(' to ') &&
        !lower.includes('search') &&
        !lower.includes('play') &&
        !lower.includes('send') &&
        !lower.includes('message'))
    ) {
      goalType = 'APP_OPERATION';
      terminalConditions.push({
        type: 'PACKAGE_ACTIVE',
        expectedPackage: targetApp,
        description: 'Application successfully opened in foreground',
      });
    } else if (
      lower.includes('torch') ||
      lower.includes('flashlight') ||
      lower.includes('battery') ||
      lower.includes('brightness') ||
      lower.includes('volume') ||
      lower.includes('alarm') ||
      lower.includes('reminder') ||
      lower.includes('remind') ||
      lower.includes('schedule') ||
      lower.includes('routine') ||
      lower.includes('memory') ||
      lower.includes('remember') ||
      lower.includes('silent') ||
      lower.includes('vibrate') ||
      lower.includes('ringer') ||
      lower.includes('notification') ||
      lower.includes('time') ||
      lower.includes('wifi') ||
      lower.includes('bluetooth') ||
      lower.includes('hotspot') ||
      lower.includes('date') ||
      lower.includes('mute') ||
      lower.includes('sound') ||
      lower.includes('root') ||
      lower.includes('shizuku') ||
      lower.includes('elevated') ||
      lower.includes('force stop') ||
      lower.includes('kill')
    ) {
      goalType = 'SYSTEM_CONTROL';
      terminalConditions.push({
        type: 'SINGLE_ACTION_DONE',
        description: 'Hardware or system state modified',
      });
    } else if (
      validated.goalType === 'MEDIA_PLAYBACK' ||
      lower.startsWith('play ') ||
      (lower.includes('play') && (lower.includes('video') || lower.includes('episode') || lower.includes('song') || lower.includes('youtube') || lower.includes('music')))
    ) {
      goalType = 'MEDIA_PLAYBACK';
      terminalConditions.push({
        type: 'PLAYBACK_ACTIVE',
        expectedPackage: targetApp,
        description: 'Media playback initiated and active',
      });
    } else if (
      validated.goalType === 'MESSAGING' ||
      ((lower.startsWith('send ') || lower.startsWith('message ') || lower.startsWith('text ')) && (lower.includes('to ') || lower.includes('that ')))
    ) {
      goalType = 'MESSAGING';
      terminalConditions.push({
        type: 'MESSAGE_SENT',
        expectedPackage: targetApp,
        description: 'Message typed and sent',
      });
    } else if (lower.startsWith('search ') || lower.startsWith('find ') || lower.includes('google ')) {
      goalType = 'SEARCH';
      terminalConditions.push({
        type: 'TEXT_PRESENT',
        description: 'Search results loaded and displayed',
      });
    } else {
      goalType = 'APP_OPERATION';
      terminalConditions.push({
        type: 'SINGLE_ACTION_DONE',
        description: 'Autonomous action executed',
      });
    }

    const maxSteps = goalType === 'MEDIA_PLAYBACK' || goalType === 'MESSAGING' ? 12 : goalType === 'SEARCH' ? 8 : 6;
    const session = SessionManager.getSession();

    const task: TaskState = {
      id: `task_${Date.now()}`,
      sessionId: session.sessionId,
      rawGoal,
      normalizedGoal: rawGoal.trim(),
      goalType,
      terminalConditions,
      currentApp: targetApp,
      actionHistory: [],
      stepCount: 0,
      maxSteps,
      retryCount: 0,
      status: 'CREATED',
      verified: false,
    };

    this.activeTask = task;
    SessionManager.setCurrentTask(task.id, task.rawGoal, targetApp);
    SessionManager.emitEvent('TASK_STARTED', { taskId: task.id, goal: task.rawGoal, goalType });
    return task;
  }

  getActiveTask(): TaskState | null {
    return this.activeTask;
  }

  steer(update: SteeringUpdate): boolean {
    if (!this.activeTask) return false;

    if (update.type === 'CANCEL') {
      this.cancel('User requested cancellation (Stop)');
      return true;
    }

    if (update.type === 'MODIFY_TARGET' && update.newGoal) {
      this.activeTask.rawGoal = update.newGoal;
      this.activeTask.normalizedGoal = update.newGoal.trim();
      this.activeTask.stepCount = 0;
      this.activeTask.retryCount = 0;
      SessionManager.emitEvent('TASK_STEERED', { newGoal: update.newGoal });
      return true;
    }

    return false;
  }

  cancel(reason: string = 'Cancelled'): void {
    if (this.activeTask) {
      this.activeTask.status = 'CANCELLED';
      SessionManager.cancelActiveTask(reason);
      this.activeTask = null;
    }
  }

  isTerminalConditionMet(
    task: TaskState,
    screenTree: ScreenTree,
    isMediaPlaying: boolean,
    lastTool?: string
  ): boolean {
    if (task.terminalConditions.length === 0) return true;

    for (const condition of task.terminalConditions) {
      if (condition.type === 'SINGLE_ACTION_DONE') {
        const lastRecord = task.actionHistory[task.actionHistory.length - 1];
        if (lastRecord && lastRecord.success && lastTool && lastTool !== 'inspect_screen' && lastTool !== 'wait_for_element') {
          return true;
        }
      }

      if (condition.type === 'TEXT_PRESENT') {
        if (condition.expectedText) {
          const target = condition.expectedText.toLowerCase();
          const found = screenTree.nodes.some(
            (n) =>
              (n.text || '').toLowerCase().includes(target) ||
              (n.contentDescription || '').toLowerCase().includes(target)
          );
          if (found) return true;
        } else if (lastTool === 'search' || lastTool === 'press_enter_or_search' || lastTool === 'type_text') {
          return true;
        }
      }

      if (condition.type === 'PACKAGE_ACTIVE') {
        const lastRecord = task.actionHistory[task.actionHistory.length - 1];
        if (lastRecord && lastRecord.toolName === 'launch_app' && lastRecord.success) {
          return true;
        }
        if (condition.expectedPackage) {
          const expected = condition.expectedPackage.toLowerCase().trim();
          const active = screenTree.activePackage.toLowerCase().trim();
          if (active === expected || active.includes(expected) || expected.includes(active)) {
            return true;
          }
        } else {
          return true;
        }
      }

      if (condition.type === 'PLAYBACK_ACTIVE') {
        // Can NEVER be completed just by launching the app or searching/typing!
        if (lastTool === 'launch_app' || lastTool === 'click_node' || lastTool === 'type_text' || lastTool === 'press_enter' || !lastTool) {
          continue;
        }

        const isFullScreenRequested =
          task.rawGoal.toLowerCase().includes('full screen') ||
          task.rawGoal.toLowerCase().includes('fullscreen');

        if (isFullScreenRequested) {
          if (lastTool === 'enter_fullscreen') {
            return true;
          }
          continue;
        }

        // Clicking a result / invoking play is NOT proof of playback — an ad,
        // a load error, or a wrong tap all look identical at click time. Require
        // real evidence below (audio active, or a transport control on screen)
        // before declaring the media goal verified.
        const inYouTube = screenTree.activePackage.toLowerCase().includes('youtube');
        const hasWatchNode = screenTree.nodes.some(
          (n) =>
            (n.contentDescription || '').toLowerCase().includes('pause') ||
            (n.contentDescription || '').toLowerCase().includes('player')
        );

        if (inYouTube && (isMediaPlaying || hasWatchNode)) {
          return true;
        }
      }

      if (condition.type === 'MESSAGE_SENT') {
        // Evidence-based, mirroring PLAYBACK_ACTIVE: clicking Send is not proof.
        // We only trust the goal as complete after an explicit verify step AND a
        // visible delivery marker (or the outgoing bubble) in the thread. Absent
        // that, the loop stays unverified and reports honestly.
        const hasSentMarker = screenTree.nodes.some((n) => {
          const d = (n.contentDescription || '').toLowerCase();
          return (
            d.includes('delivered') ||
            d.includes('sent') ||
            d.includes('read') ||
            d.includes('seen')
          );
        });
        if (lastTool === 'verify_message_sent' && hasSentMarker) {
          return true;
        }
      }
    }

    return false;
  }
}

export const TaskManager = new TaskManagerClass();
