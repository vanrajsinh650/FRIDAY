import { DeviceEventEmitter } from 'react-native';
import { SchedulerModule } from '../../native/SchedulerModule';
import { SystemControlModule } from '../../native/SystemControlModule';
import { ScheduledTask } from '../../native/types';
import { MemoryStore } from '../../memory/store';
import { TelemetryLogger } from '../../utils/telemetry';
import {
  executeMorningBriefing,
  executeBatteryAlert,
  executeNotificationDigest,
  MorningBriefingResult,
  BatteryAlertResult,
  NotificationDigestResult,
} from './routines';

const DOW_NAMES: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

const MONTH_NAMES: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

function parseCronToken(token: string, isDayOfWeek: boolean = false, isMonth: boolean = false): number | null {
  const upper = token.trim().toUpperCase();
  if (isDayOfWeek && DOW_NAMES[upper] !== undefined) {
    return DOW_NAMES[upper];
  }
  if (isMonth && MONTH_NAMES[upper] !== undefined) {
    return MONTH_NAMES[upper];
  }
  const parsed = parseInt(token, 10);
  if (isNaN(parsed)) return null;
  if (isDayOfWeek && parsed === 7) return 0;
  return parsed;
}

/**
 * Match a single cron field with a current value.
 * Supports: '*', '?', numbers, comma lists '1,2,3', ranges '1-5', 'MON-FRI', steps '* /15' or '0-30/5'.
 */
export function matchCronField(
  field: string,
  val: number,
  isDayOfWeek: boolean = false,
  isMonth: boolean = false
): boolean {
  const trimmed = (field || '').trim();
  if (trimmed === '*' || trimmed === '?') return true;

  // Handle comma lists (e.g. 1,15,30 or MON,WED,FRI)
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',');
    return parts.some((p) => matchCronField(p, val, isDayOfWeek, isMonth));
  }

  // Handle step values (e.g. */15, 0-30/5)
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length !== 2) return false;
    const [rangePart, stepPart] = parts;
    const step = parseInt(stepPart, 10);
    if (isNaN(step) || step <= 0) return false;

    if (rangePart === '*' || rangePart === '' || rangePart === '?') {
      return val % step === 0;
    }
    if (rangePart.includes('-')) {
      const rangeParts = rangePart.split('-');
      if (rangeParts.length !== 2) return false;
      const start = parseCronToken(rangeParts[0], isDayOfWeek, isMonth);
      const end = parseCronToken(rangeParts[1], isDayOfWeek, isMonth);
      if (start === null || end === null) return false;
      return val >= start && val <= end && (val - start) % step === 0;
    }
    const start = parseCronToken(rangePart, isDayOfWeek, isMonth);
    return start !== null && val >= start && (val - start) % step === 0;
  }

  // Handle ranges (e.g. 1-5, 0-7, 1-7, MON-FRI)
  if (trimmed.includes('-')) {
    const rangeParts = trimmed.split('-');
    if (rangeParts.length !== 2) return false;
    const rawStart = rangeParts[0].trim();
    const rawEnd = rangeParts[1].trim();

    if (isDayOfWeek) {
      // 0-7 or 1-7 spans the entire week
      if ((rawStart === '0' || rawStart === '1') && rawEnd === '7') {
        return true;
      }
      const start = parseCronToken(rawStart, true, false);
      const end = parseCronToken(rawEnd, true, false);
      if (start === null || end === null) return false;
      const currentDay = val === 7 ? 0 : val;
      if (start <= end) {
        return currentDay >= start && currentDay <= end;
      } else {
        // e.g. Fri-Mon: 5-1 (5, 6, 0, 1)
        return currentDay >= start || currentDay <= end;
      }
    }

    const start = parseCronToken(rawStart, false, isMonth);
    const end = parseCronToken(rawEnd, false, isMonth);
    if (start === null || end === null) return false;
    return val >= start && val <= end;
  }

  // Single number or day/month name
  const target = parseCronToken(trimmed, isDayOfWeek, isMonth);
  if (target === null) return false;

  if (isDayOfWeek) {
    const normalizedTarget = target === 7 ? 0 : target;
    const currentDay = val === 7 ? 0 : val;
    return normalizedTarget === currentDay;
  }

  return target === val;
}

/**
 * Evaluates whether a standard 5-part cron expression matches the given Date.
 * Format: minute hour dayOfMonth month dayOfWeek
 */
export function isCronMatch(cronExpression: string, date: Date = new Date()): boolean {
  if (!cronExpression || typeof cronExpression !== 'string') return false;
  if (!(date instanceof Date) || isNaN(date.getTime())) return false;

  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [minField, hourField, domField, monthField, dowField] = parts;

  const min = date.getMinutes();
  const hour = date.getHours();
  const dom = date.getDate();
  const month = date.getMonth() + 1; // 1-12
  const dow = date.getDay(); // 0-6 (0 is Sunday)

  if (!matchCronField(minField, min, false, false)) return false;
  if (!matchCronField(hourField, hour, false, false)) return false;
  if (!matchCronField(domField, dom, false, false)) return false;
  if (!matchCronField(monthField, month, false, true)) return false;
  if (!matchCronField(dowField, dow, true, false)) return false;

  return true;
}

/**
 * ProactiveScheduler — Central engine for scheduled alarms, recurring cron routines,
 * and proactive system monitoring (battery drops, unread notifications).
 */
export class ProactiveScheduler {
  private static instance: ProactiveScheduler | null = null;

  private tasks: Map<string, ScheduledTask> = new Map();
  private timerHandle: any = null;
  private eventSubscription: any = null;
  private isRunning: boolean = false;

  // Battery monitoring state
  private lastBatteryAlertLevel: number | null = null;
  private lastBatteryAlertTimestamp: number = 0;
  private readonly BATTERY_ALERT_THRESHOLD = 15; // Alert when < 15%
  private readonly BATTERY_ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 mins cooldown

  constructor() {
    this.registerDefaultRoutines();
  }

  static getInstance(): ProactiveScheduler {
    if (!ProactiveScheduler.instance) {
      ProactiveScheduler.instance = new ProactiveScheduler();
    }
    return ProactiveScheduler.instance;
  }

  /**
   * Register out-of-the-box standard proactive routines.
   */
  private registerDefaultRoutines(): void {
    // Daily Morning Briefing at 8:00 AM
    this.tasks.set('routine_morning_briefing', {
      id: 'routine_morning_briefing',
      taskType: 'ROUTINE',
      targetTimestamp: 0,
      title: 'Morning Briefing',
      recurringCron: '0 8 * * *',
      payloadJson: JSON.stringify({ routine: 'MORNING_BRIEFING' }),
      isActive: true,
      createdAt: Date.now(),
    });
  }

  /**
   * Initialize scheduler: loads saved tasks from persistence and syncs future alarms.
   */
  async initialize(): Promise<void> {
    try {
      await MemoryStore.initialize();
      const savedTasksJson = MemoryStore.getFact('scheduled_tasks_store')?.value;
      if (savedTasksJson) {
        const parsed = JSON.parse(savedTasksJson);
        if (Array.isArray(parsed)) {
          for (const task of parsed) {
            if (task && task.id) {
              this.tasks.set(task.id, task);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[ProactiveScheduler] Failed to load saved tasks from memory store:', e);
    }

    // Sync all pending one-shot alarms with native AlarmManager
    const now = Date.now();
    for (const task of this.tasks.values()) {
      if (task.isActive && task.taskType === 'ALARM' && task.targetTimestamp > now) {
        await SchedulerModule.scheduleExactAlarm(task);
      }
    }
  }

  /**
   * Persist current tasks to memory store disk.
   */
  private async persistTasks(): Promise<void> {
    try {
      const taskList = Array.from(this.tasks.values());
      await MemoryStore.setFact('FACT', 'scheduled_tasks_store', JSON.stringify(taskList));
    } catch (e) {
      console.warn('[ProactiveScheduler] Failed to persist tasks to disk:', e);
    }
  }

  /**
   * Schedule an exact one-shot alarm or reminder.
   */
  async scheduleOneShotAlarm(
    title: string,
    targetTimestamp: number,
    payload?: any,
    taskId?: string
  ): Promise<ScheduledTask> {
    const id = taskId || `alarm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const task: ScheduledTask = {
      id,
      taskType: 'ALARM',
      title,
      targetTimestamp,
      payloadJson: typeof payload === 'string' ? payload : JSON.stringify(payload || {}),
      isActive: true,
      createdAt: Date.now(),
    };

    this.tasks.set(id, task);
    await SchedulerModule.scheduleExactAlarm(task);
    await this.persistTasks();

    TelemetryLogger.recordEvent('TASK_STARTED', {
      type: 'ALARM_SCHEDULED',
      id,
      targetTimestamp,
      title,
    });

    return task;
  }

  /**
   * Schedule a recurring cron routine (e.g. '0 8 * * *' for morning briefing).
   */
  async scheduleCronRoutine(
    routineName: 'MORNING_BRIEFING' | 'NOTIFICATION_DIGEST' | string,
    cronExpression: string,
    title?: string,
    taskId?: string
  ): Promise<ScheduledTask> {
    const id = taskId || `routine_${routineName.toLowerCase()}_${Date.now()}`;
    const cleanCron = cronExpression.trim();

    const task: ScheduledTask = {
      id,
      taskType: 'ROUTINE',
      title: title || `${routineName} Routine`,
      targetTimestamp: 0,
      recurringCron: cleanCron,
      payloadJson: JSON.stringify({ routine: routineName }),
      isActive: true,
      createdAt: Date.now(),
    };

    this.tasks.set(id, task);
    await this.persistTasks();

    TelemetryLogger.recordEvent('TASK_STARTED', {
      type: 'ROUTINE_SCHEDULED',
      id,
      routineName,
      cronExpression: cleanCron,
    });

    return task;
  }

  /**
   * Schedule a generic task.
   */
  async scheduleTask(taskData: Omit<ScheduledTask, 'createdAt'> & { createdAt?: number }): Promise<ScheduledTask> {
    const task: ScheduledTask = {
      ...taskData,
      isActive: taskData.isActive !== false,
      createdAt: taskData.createdAt || Date.now(),
    };

    this.tasks.set(task.id, task);

    if (task.taskType === 'ALARM' && task.targetTimestamp > Date.now()) {
      await SchedulerModule.scheduleExactAlarm(task);
    }

    await this.persistTasks();
    return task;
  }

  /**
   * Cancel a scheduled task by ID.
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.isActive = false;
    this.tasks.delete(taskId);

    if (task.taskType === 'ALARM') {
      await SchedulerModule.cancelAlarm(taskId);
    }

    await this.persistTasks();
    TelemetryLogger.recordEvent('TASK_COMPLETED', { type: 'TASK_CANCELLED', taskId });
    return true;
  }

  /**
   * Get a task by ID.
   */
  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * List all scheduled tasks.
   */
  listTasks(activeOnly: boolean = false): ScheduledTask[] {
    const all = Array.from(this.tasks.values());
    if (activeOnly) {
      return all.filter((t) => t.isActive !== false);
    }
    return all;
  }

  /**
   * Clear all scheduled tasks.
   */
  async clearAllTasks(): Promise<void> {
    for (const [id, task] of this.tasks.entries()) {
      if (task.taskType === 'ALARM') {
        await SchedulerModule.cancelAlarm(id);
      }
    }
    this.tasks.clear();
    await this.persistTasks();
  }

  /**
   * Proactive battery level checker.
   * If battery drops below threshold (< 15%) and is discharging, triggers battery alert.
   */
  async checkBatteryLevel(
    overrideLevel?: number,
    overrideIsCharging?: boolean
  ): Promise<{ alerted: boolean; level: number; message?: string }> {
    let level = overrideLevel;
    let isCharging = overrideIsCharging;

    if (level === undefined || isCharging === undefined) {
      try {
        const status = await SystemControlModule.getBatteryStatus();
        if (level === undefined) level = status.level;
        if (isCharging === undefined) isCharging = status.isCharging;
      } catch (e) {
        console.warn('[ProactiveScheduler] Failed to read battery status in monitor:', e);
        return { alerted: false, level: level ?? 100 };
      }
    }

    const now = Date.now();
    const isCritical = level < this.BATTERY_ALERT_THRESHOLD;

    if (!isCharging && isCritical) {
      const cooldownPassed = now - this.lastBatteryAlertTimestamp > this.BATTERY_ALERT_COOLDOWN_MS;
      const levelDroppedFurther = this.lastBatteryAlertLevel === null || level < this.lastBatteryAlertLevel;

      if (cooldownPassed || levelDroppedFurther) {
        this.lastBatteryAlertLevel = level;
        this.lastBatteryAlertTimestamp = now;

        const alertRes: BatteryAlertResult = await executeBatteryAlert(level);
        return {
          alerted: true,
          level,
          message: alertRes.spokenText,
        };
      }
    } else if (isCharging || level >= this.BATTERY_ALERT_THRESHOLD) {
      // Reset alert tracking when charged or above threshold
      this.lastBatteryAlertLevel = null;
    }

    return { alerted: false, level };
  }

  /**
   * Proactive unread notification checker.
   */
  async checkUnreadNotifications(): Promise<{ digested: boolean; count: number; message?: string }> {
    const res: NotificationDigestResult = await executeNotificationDigest();
    return {
      digested: true,
      count: res.priorityCount,
      message: res.spokenText,
    };
  }

  /**
   * Direct handler for alarm wakeup from native AlarmManager BroadcastReceiver.
   */
  async handleAlarmTrigger(taskId: string, payloadJson?: string): Promise<any> {
    const task = this.tasks.get(taskId);
    let payload = {};
    try {
      payload = JSON.parse(payloadJson || task?.payloadJson || '{}');
    } catch {}

    const routineName = (payload as any).routine || (task?.recurringCron ? 'ROUTINE' : 'ALARM');

    if (task) {
      task.lastExecutedAt = Date.now();
      if (task.taskType === 'ALARM') {
        task.isActive = false;
      }
      await this.persistTasks();
    }

    if (routineName === 'MORNING_BRIEFING') {
      return await executeMorningBriefing();
    } else if (routineName === 'NOTIFICATION_DIGEST') {
      return await executeNotificationDigest();
    } else {
      // Default alarm announcement
      const title = task?.title || 'Scheduled Alarm';
      const spokenText = `Boss, your scheduled alarm "${title}" is sounding now.`;
      const { PocketTTSEngine } = await import('../../voice/tts');
      await PocketTTSEngine.speak({ text: spokenText });
      return { spokenText, taskId, title };
    }
  }

  /**
   * Main evaluation tick.
   * Evaluates all active cron tasks, one-shot alarms, and proactive checks.
   */
  async tick(currentDate: Date = new Date()): Promise<Array<{ taskId: string; result: any }>> {
    const executedResults: Array<{ taskId: string; result: any }> = [];
    const nowMs = currentDate.getTime();
    const currentMinuteKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}-${currentDate.getHours()}-${currentDate.getMinutes()}`;

    for (const [id, task] of this.tasks.entries()) {
      if (!task.isActive) continue;

      // 1. One-shot Alarms
      if (task.taskType === 'ALARM' && task.targetTimestamp > 0 && nowMs >= task.targetTimestamp) {
        task.isActive = false;
        task.lastExecutedAt = nowMs;
        try {
          const result = await this.handleAlarmTrigger(id, task.payloadJson);
          executedResults.push({ taskId: id, result });
        } catch (err) {
          console.warn(`[ProactiveScheduler] Alarm execution failed for task ${id}:`, err);
        }
      }

      // 2. Cron Routines
      if (task.recurringCron) {
        if (isCronMatch(task.recurringCron, currentDate)) {
          // Prevent double-firing in the same minute
          const lastExecMinuteKey = task.lastExecutedAt
            ? (() => {
                const d = new Date(task.lastExecutedAt);
                return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
              })()
            : '';

          if (lastExecMinuteKey !== currentMinuteKey) {
            task.lastExecutedAt = nowMs;
            let payload: any = {};
            try {
              payload = JSON.parse(task.payloadJson || '{}');
            } catch {}

            try {
              let result: any = null;
              if (payload.routine === 'MORNING_BRIEFING' || id.includes('morning_briefing')) {
                result = await executeMorningBriefing();
              } else if (payload.routine === 'NOTIFICATION_DIGEST' || id.includes('notification_digest')) {
                result = await executeNotificationDigest();
              } else {
                result = await this.handleAlarmTrigger(id, task.payloadJson);
              }

              executedResults.push({ taskId: id, result });
            } catch (err) {
              console.warn(`[ProactiveScheduler] Routine execution failed for task ${id}:`, err);
            }
          }
        }
      }
    }

    // Proactive battery check
    try {
      await this.checkBatteryLevel();
    } catch (e) {
      console.warn('[ProactiveScheduler] Periodic battery check error:', e);
    }

    if (executedResults.length > 0) {
      await this.persistTasks();
    }

    return executedResults;
  }

  /**
   * Start background scheduler loop and native event listener.
   */
  start(tickIntervalMs: number = 30000): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Run first tick shortly after start
    this.tick().catch((e) => console.warn('[ProactiveScheduler] Initial tick error:', e));

    this.timerHandle = setInterval(() => {
      this.tick().catch((e) => console.warn('[ProactiveScheduler] Periodic tick error:', e));
    }, tickIntervalMs);

    // Listen for native alarm triggers from FridaySchedulerReceiver
    try {
      this.eventSubscription = DeviceEventEmitter.addListener(
        'onScheduledAlarmTrigger',
        (event: { taskId: string; title: string; payloadJson?: string }) => {
          if (event?.taskId) {
            this.handleAlarmTrigger(event.taskId, event.payloadJson).catch((e) =>
              console.warn('[ProactiveScheduler] Alarm trigger handler error:', e)
            );
          }
        }
      );
    } catch {}
  }

  /**
   * Stop background scheduler loop.
   */
  stop(): void {
    this.isRunning = false;
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
    if (this.eventSubscription) {
      this.eventSubscription.remove();
      this.eventSubscription = null;
    }
  }

  isSchedulerRunning(): boolean {
    return this.isRunning;
  }
}

export const scheduler = ProactiveScheduler.getInstance();
