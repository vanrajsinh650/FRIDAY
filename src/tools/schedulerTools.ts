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
        description: 'Time string (e.g. "8:00 AM", "14:30", "9:50", "10:00 a.m.") to schedule for the current/next day.',
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
      let title = params.title || 'Scheduled Reminder';
      let targetTimestamp = params.timestamp;

      // Auto-extract timeString from title if not explicitly passed
      if (!targetTimestamp && !params.delayMinutes && !params.timeString) {
        const extractedTime = parseTimeStringToTimestamp(title);
        if (extractedTime) {
          targetTimestamp = extractedTime;
        }
      } else if (!targetTimestamp && params.timeString) {
        const parsed = parseTimeStringToTimestamp(params.timeString);
        if (parsed) {
          targetTimestamp = parsed;
        }
      } else if (!targetTimestamp && params.delayMinutes !== undefined && params.delayMinutes > 0) {
        targetTimestamp = Date.now() + params.delayMinutes * 60 * 1000;
      }

      // Clean command prefixes from title
      title = title
        .replace(/^(remind me to|remind me|set a reminder to|set a reminder for|set reminder for|set reminder to|schedule alarm for|set alarm for)\s+/i, '')
        .replace(/\b(at|for|by)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?\b/gi, '')
        .trim();
      if (!title || title.length === 0) {
        title = 'Scheduled Reminder';
      }

      if (!targetTimestamp || isNaN(targetTimestamp)) {
        // Default to 10 minutes from now if no time specified
        targetTimestamp = Date.now() + 10 * 60 * 1000;
      }

      const task = await scheduler.scheduleOneShotAlarm(title, targetTimestamp);
      const dateStr = new Date(task.targetTimestamp).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      return {
        success: true,
        data: {
          taskId: task.id,
          title: task.title,
          targetTimestamp: task.targetTimestamp,
          formattedTime: dateStr,
          message: `Scheduled reminder "${task.title}" for ${dateStr}, Boss.`,
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
      const formattedTasks = tasks.map((t) => {
        const timeStr = t.targetTimestamp > 0
          ? new Date(t.targetTimestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
          : t.recurringCron || 'Recurring';
        return {
          id: t.id,
          type: t.taskType,
          title: t.title,
          targetTimestamp: t.targetTimestamp,
          formattedTime: timeStr,
          recurringCron: t.recurringCron,
          isActive: t.isActive !== false,
          lastExecutedAt: t.lastExecutedAt,
        };
      });

      const summary = formattedTasks.length > 0
        ? `You have ${formattedTasks.length} active reminder${formattedTasks.length > 1 ? 's' : ''}, Boss: ${formattedTasks.map((t) => `"${t.title}" at ${t.formattedTime}`).join(', ')}.`
        : 'You have no scheduled reminders or alarms set at this time, Boss.';

      return {
        success: true,
        data: {
          count: tasks.length,
          tasks: formattedTasks,
          summary,
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
 * Helper to parse human time string (e.g. "8:00 AM", "14:30", "9:50", "10:00 a.m.") to epoch timestamp.
 */
export function parseTimeStringToTimestamp(timeStr: string): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const raw = timeStr.trim().toLowerCase();

  // 1. Relative delay check: "in X minutes", "in X hours", "in X mins"
  const relMatch = raw.match(/\bin\s+(\d+)\s*(mins?|minutes?|hours?|hrs?|seconds?|secs?)\b/i);
  if (relMatch) {
    const amount = parseInt(relMatch[1], 10);
    const unit = relMatch[2].toLowerCase();
    if (!isNaN(amount) && amount > 0) {
      if (unit.startsWith('hour') || unit.startsWith('hr')) {
        return Date.now() + amount * 60 * 60 * 1000;
      }
      if (unit.startsWith('sec')) {
        return Date.now() + amount * 1000;
      }
      return Date.now() + amount * 60 * 1000;
    }
  }

  // 2. Clean prepositions and normalize dots in a.m. / p.m.
  const cleaned = raw
    .replace(/\b(at|for|by|around|approx|scheduled for|tomorrow at|today at)\s+/gi, '')
    .replace(/a\.m\./gi, 'am')
    .replace(/p\.m\./gi, 'pm')
    .replace(/o'clock/gi, '')
    .trim();

  const isTomorrow = raw.includes('tomorrow');
  const isNightOrEve = raw.includes('night') || raw.includes('evening') || raw.includes('pm') || raw.includes('p.m.');
  const isMorning = raw.includes('morning') || raw.includes('am') || raw.includes('a.m.');

  // Check "H:M" or "H:M am/pm"
  const colonMatch = cleaned.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (colonMatch) {
    let hours = parseInt(colonMatch[1], 10);
    const minutes = parseInt(colonMatch[2], 10);
    const ampm = (colonMatch[3] || (isNightOrEve ? 'pm' : isMorning ? 'am' : '')).toLowerCase();

    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;

    const target = new Date();
    target.setHours(hours, minutes, 0, 0);

    if (isTomorrow) {
      target.setDate(target.getDate() + 1);
    } else if (target.getTime() <= Date.now()) {
      // If no am/pm was specified and adding 12 hours makes it in the future today, choose PM
      if (!colonMatch[3] && !isMorning && hours < 12) {
        const pmTarget = new Date(target.getTime());
        pmTarget.setHours(hours + 12);
        if (pmTarget.getTime() > Date.now()) {
          return pmTarget.getTime();
        }
      }
      target.setDate(target.getDate() + 1);
    }
    return target.getTime();
  }

  // Check standalone hour "H am/pm" or "H"
  const hourMatch = cleaned.match(/\b(\d{1,2})\s*(am|pm)?\b/i);
  if (hourMatch) {
    let hours = parseInt(hourMatch[1], 10);
    const minutes = 0;
    const ampm = (hourMatch[2] || (isNightOrEve ? 'pm' : isMorning ? 'am' : '')).toLowerCase();

    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;

    const target = new Date();
    target.setHours(hours, minutes, 0, 0);

    if (isTomorrow) {
      target.setDate(target.getDate() + 1);
    } else if (target.getTime() <= Date.now()) {
      if (!hourMatch[2] && !isMorning && hours < 12) {
        const pmTarget = new Date(target.getTime());
        pmTarget.setHours(hours + 12);
        if (pmTarget.getTime() > Date.now()) {
          return pmTarget.getTime();
        }
      }
      target.setDate(target.getDate() + 1);
    }
    return target.getTime();
  }

  return null;
}
