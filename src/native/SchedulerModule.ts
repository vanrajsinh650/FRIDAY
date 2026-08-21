import { NativeModules } from 'react-native';
import { ScheduledTask } from './types';

const { FridaySchedulerNative } = NativeModules;

export class SchedulerModule {
  static async scheduleExactAlarm(task: ScheduledTask): Promise<boolean> {
    if (FridaySchedulerNative?.scheduleExactAlarm) {
      return await FridaySchedulerNative.scheduleExactAlarm(
        task.id,
        task.targetTimestamp,
        task.title,
        task.payloadJson || '{}'
      );
    }
    return true;
  }

  static async cancelAlarm(taskId: string): Promise<boolean> {
    if (FridaySchedulerNative?.cancelAlarm) {
      return await FridaySchedulerNative.cancelAlarm(taskId);
    }
    return true;
  }

  static async schedulePeriodicWork(workName: string, intervalMinutes: number): Promise<boolean> {
    if (FridaySchedulerNative?.schedulePeriodicWork) {
      return await FridaySchedulerNative.schedulePeriodicWork(workName, intervalMinutes);
    }
    return true;
  }
}
