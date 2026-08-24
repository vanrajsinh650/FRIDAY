import { NativeModules } from 'react-native';
import { ScheduledTask } from './types';

const { FridaySchedulerNative } = NativeModules;

export class SchedulerModule {
  private static mockAlarms: Map<string, ScheduledTask> = new Map();
  private static mockWork: Map<string, number> = new Map();

  /**
   * Schedule an exact wakeup alarm using Android AlarmManager (setExactAndAllowWhileIdle).
   */
  static async scheduleExactAlarm(task: ScheduledTask): Promise<boolean> {
    this.mockAlarms.set(task.id, { ...task });
    if (FridaySchedulerNative?.scheduleExactAlarm) {
      try {
        return await FridaySchedulerNative.scheduleExactAlarm(
          task.id,
          task.targetTimestamp,
          task.title,
          task.payloadJson || '{}'
        );
      } catch (err) {
        console.warn('[SchedulerModule] Failed to schedule exact native alarm:', err);
        return false;
      }
    }
    return true;
  }

  /**
   * Cancel an exact alarm by task ID.
   */
  static async cancelAlarm(taskId: string): Promise<boolean> {
    this.mockAlarms.delete(taskId);
    if (FridaySchedulerNative?.cancelAlarm) {
      try {
        return await FridaySchedulerNative.cancelAlarm(taskId);
      } catch (err) {
        console.warn('[SchedulerModule] Failed to cancel native alarm:', err);
        return false;
      }
    }
    return true;
  }

  /**
   * Schedule periodic background work using Android WorkManager.
   */
  static async schedulePeriodicWork(workName: string, intervalMinutes: number): Promise<boolean> {
    this.mockWork.set(workName, intervalMinutes);
    if (FridaySchedulerNative?.schedulePeriodicWork) {
      try {
        return await FridaySchedulerNative.schedulePeriodicWork(workName, intervalMinutes);
      } catch (err) {
        console.warn('[SchedulerModule] Failed to schedule periodic native work:', err);
        return false;
      }
    }
    return true;
  }

  /**
   * Cancel periodic background work by name.
   */
  static async cancelWork(workName: string): Promise<boolean> {
    this.mockWork.delete(workName);
    if (FridaySchedulerNative?.cancelWork) {
      try {
        return await FridaySchedulerNative.cancelWork(workName);
      } catch (err) {
        console.warn('[SchedulerModule] Failed to cancel native work:', err);
        return false;
      }
    }
    return true;
  }

  /**
   * Check if exact alarms can be scheduled (Android 12+ permission).
   */
  static async canScheduleExactAlarms(): Promise<boolean> {
    if (FridaySchedulerNative?.canScheduleExactAlarms) {
      try {
        return await FridaySchedulerNative.canScheduleExactAlarms();
      } catch {
        return true;
      }
    }
    return true;
  }

  /**
   * Open Android system settings to grant exact alarm scheduling permission.
   */
  static async openExactAlarmSettings(): Promise<boolean> {
    if (FridaySchedulerNative?.openExactAlarmSettings) {
      try {
        return await FridaySchedulerNative.openExactAlarmSettings();
      } catch {
        return false;
      }
    }
    return true;
  }

  /**
   * Get all currently scheduled in-memory/mock alarms (useful for tests and verification).
   */
  static getMockAlarms(): ScheduledTask[] {
    return Array.from(this.mockAlarms.values());
  }

  /**
   * Clear in-memory mock alarms and work.
   */
  static clearMockState(): void {
    this.mockAlarms.clear();
    this.mockWork.clear();
  }
}
