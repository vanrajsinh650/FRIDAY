import { ToolDefinition, ToolResult } from './types';
import { scheduler } from '../agent/proactive/scheduler';
import {
  executeMorningBriefing,
  executeBatteryAlert,
  executeNotificationDigest,
} from '../agent/proactive/routines';

/**
 * Tool: schedule_alarm
 * Schedule an exact one-shot alarm or reminder at a specific timestamp, relative delay, or time string.
 */
export const scheduleAlarmTool: ToolDefinition = {
  name: 'schedule_alarm',
  description: 'Schedule an exact one-shot alarm or reminder for Boss at a target timestamp or after a relative delay in minutes.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Title or reminder message for the alarm (e.g. "Check flight prices", "Call Tony").',
      },
      delayMinutes: {
        type: 'number',
        description: 'Relative delay in minutes from the current time to trigger the alarm (e.g. 15 for in 15 minutes).',
      },
      timestamp: {
        type: 'number',
        description: 'Exact Unix epoch timestamp in milliseconds when the alarm should trigger.',
      },
      timeString: {
        type: 'string',
        description: 'Time string (e.g. "8:00 AM", "14:30") to schedule for the current/next day.',
      },
    },
    required: ['title'],
  },
  execute: async (params: {
    title: string;
    delayMinutes?: number;
    timestamp?: number;
    timeString?: string;
  }): Promise<ToolResult> => {
    try {
      let targetTimestamp = params.timestamp;

      if (!targetTimestamp && params.delayMinutes !== undefined && params.delayMinutes > 0) {
        targetTimestamp = Date.now() + params.delayMinutes * 60 * 1000;
      } else if (!targetTimestamp && params.timeString) {
        const parsed = parseTimeStringToTimestamp(params.timeString);
        if (parsed) {
          targetTimestamp = parsed;
        }
      }

      if (!targetTimestamp || isNaN(targetTimestamp)) {
        // Default to 10 minutes from now if no time specified
        targetTimestamp = Date.now() + 10 * 60 * 1000;
      }

      const task = await scheduler.scheduleOneShotAlarm(params.title, targetTimestamp);
      const dateStr = new Date(task.targetTimestamp).toLocaleString('en-US');

      return {
        success: true,
        data: {
          taskId: task.id,
          title: task.title,
          targetTimestamp: task.targetTimestamp,
          formattedTime: dateStr,
          message: `Scheduled alarm "${task.title}" for ${dateStr}.`,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to schedule alarm.' };
    }
  },
};

/**
 * Tool: schedule_routine
 * Schedule a recurring proactive routine using a cron expression.
 */
export const scheduleRoutineTool: ToolDefinition = {
  name: 'schedule_routine',
  description: 'Schedule a recurring proactive routine using a standard 5-part cron expression (e.g., "0 8 * * *" for morning briefing at 8:00 AM daily).',
  parameters: {
    type: 'object',
    properties: {
      routineName: {
        type: 'string',
        description: 'Name of the routine (e.g. "MORNING_BRIEFING", "NOTIFICATION_DIGEST", "BATTERY_CHECK").',
      },
      cronExpression: {
        type: 'string',
        description: 'Standard 5-part cron expression (minute hour dayOfMonth month dayOfWeek).',
      },
      title: {
        type: 'string',
        description: 'Optional human-readable title for the routine.',
      },
    },
    required: ['routineName', 'cronExpression'],
  },
  execute: async (params: {
    routineName: string;
    cronExpression: string;
    title?: string;
  }): Promise<ToolResult> => {
    try {
      const task = await scheduler.scheduleCronRoutine(
        params.routineName,
        params.cronExpression,
        params.title
      );

      return {
        success: true,
        data: {
          taskId: task.id,
          routineName: params.routineName,
          cronExpression: task.recurringCron,
          title: task.title,
          message: `Scheduled recurring routine "${task.title}" with cron expression "${task.recurringCron}".`,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to schedule recurring routine.' };
    }
  },
};

/**
 * Tool: cancel_scheduled_task
 * Cancel a scheduled alarm, reminder, or recurring routine by task ID.
 */
export const cancelScheduledTaskTool: ToolDefinition = {
  name: 'cancel_scheduled_task',
  description: 'Cancel an active scheduled alarm, reminder, or proactive routine by task ID.',
  parameters: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'Unique task ID to cancel.',
      },
    },
    required: ['taskId'],
  },
  execute: async (params: { taskId: string }): Promise<ToolResult> => {
    try {
      const cancelled = await scheduler.cancelTask(params.taskId);
      if (!cancelled) {
        return {
          success: false,
          error: `Task with ID "${params.taskId}" was not found or already cancelled.`,
        };
      }

      return {
        success: true,
        data: {
          taskId: params.taskId,
          cancelled: true,
          message: `Successfully cancelled scheduled task "${params.taskId}".`,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to cancel scheduled task.' };
    }
  },
};

/**
 * Tool: list_scheduled_tasks
 * List all active scheduled alarms, reminders, and recurring proactive routines.
 */
export const listScheduledTasksTool: ToolDefinition = {
  name: 'list_scheduled_tasks',
  description: 'List all scheduled alarms, reminders, and recurring proactive routines registered in the system.',
  parameters: {
    type: 'object',
    properties: {
      activeOnly: {
        type: 'boolean',
        description: 'If true, only returns active/untriggered tasks.',
      },
    },
  },
  execute: async (params: { activeOnly?: boolean }): Promise<ToolResult> => {
    try {
      const tasks = scheduler.listTasks(params?.activeOnly ?? true);
      return {
        success: true,
        data: {
          count: tasks.length,
          tasks: tasks.map((t) => ({
            id: t.id,
            type: t.taskType,
            title: t.title,
            targetTimestamp: t.targetTimestamp,
            recurringCron: t.recurringCron,
            isActive: t.isActive !== false,
            lastExecutedAt: t.lastExecutedAt,
          })),
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to list scheduled tasks.' };
    }
  },
};

/**
 * Tool: run_proactive_routine
 * Immediately trigger a proactive routine on demand.
 */
export const runProactiveRoutineTool: ToolDefinition = {
  name: 'run_proactive_routine',
  description: 'Immediately execute a proactive routine on demand (morning_briefing, battery_alert, or notification_digest).',
  parameters: {
    type: 'object',
    properties: {
      routineName: {
        type: 'string',
        enum: ['morning_briefing', 'battery_alert', 'notification_digest'],
        description: 'The name of the proactive routine to execute.',
      },
      batteryLevel: {
        type: 'number',
        description: 'Battery level percentage for battery_alert (optional, default: 14).',
      },
    },
    required: ['routineName'],
  },
  execute: async (params: {
    routineName: 'morning_briefing' | 'battery_alert' | 'notification_digest' | string;
    batteryLevel?: number;
  }): Promise<ToolResult> => {
    try {
      const name = (params.routineName || '').toLowerCase().trim();
      let result: any = null;

      if (name === 'morning_briefing' || name === 'morning') {
        result = await executeMorningBriefing();
      } else if (name === 'battery_alert' || name === 'battery') {
        result = await executeBatteryAlert(params.batteryLevel ?? 14);
      } else if (name === 'notification_digest' || name === 'notifications') {
        result = await executeNotificationDigest();
      } else {
        return {
          success: false,
          error: `Unknown routine "${params.routineName}". Valid routines: morning_briefing, battery_alert, notification_digest.`,
        };
      }

      return {
        success: true,
        data: result,
      };
    } catch (err: any) {
      return { success: false, error: err.message || `Failed to run routine "${params.routineName}".` };
    }
  },
};

/**
 * Helper to parse human time string (e.g. "8:00 AM", "14:30") to epoch timestamp.
 */
function parseTimeStringToTimestamp(timeStr: string): number | null {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([aApP][mM]))?$/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3]?.toUpperCase();

  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;

  const target = new Date();
  target.setHours(hours, minutes, 0, 0);

  // If time is in the past for today, schedule for tomorrow
  if (target.getTime() <= Date.now()) {
    target.setDate(target.getDate() + 1);
  }

  return target.getTime();
}
