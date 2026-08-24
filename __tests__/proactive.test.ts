import {
  isCronMatch,
  matchCronField,
  ProactiveScheduler,
  scheduler,
} from '../src/agent/proactive/scheduler';
import {
  executeMorningBriefing,
  executeBatteryAlert,
  executeNotificationDigest,
  filterPriorityNotifications,
  PRIORITY_NOTIFICATION_PACKAGES,
} from '../src/agent/proactive/routines';
import { SchedulerModule } from '../src/native/SchedulerModule';
import { NotificationModule } from '../src/native/NotificationModule';
import { SystemControlModule } from '../src/native/SystemControlModule';
import { ToolRegistry } from '../src/tools/registry';
import { ScheduledTask, NotificationItem } from '../src/native/types';

describe('PHASE 8: Autonomous Scheduled & Proactive Workflows (ADR-008, ADR-017)', () => {
  beforeAll(() => {
    ToolRegistry.initialize();
  });

  beforeEach(() => {
    SchedulerModule.clearMockState();
    scheduler.stop();
  });

  afterEach(() => {
    scheduler.stop();
  });

  // ==========================================================================
  // 1. CRON PARSER & EVALUATOR
  // ==========================================================================
  describe('Cron Parser & Evaluator', () => {
    test('matchCronField handles wildcard, single values, lists, ranges, and steps', () => {
      expect(matchCronField('*', 15)).toBe(true);
      expect(matchCronField('?', 15)).toBe(true);
      expect(matchCronField('15', 15)).toBe(true);
      expect(matchCronField('15', 20)).toBe(false);

      // Comma list
      expect(matchCronField('0,15,30,45', 30)).toBe(true);
      expect(matchCronField('0,15,30,45', 20)).toBe(false);

      // Range
      expect(matchCronField('1-5', 3)).toBe(true);
      expect(matchCronField('1-5', 6)).toBe(false);

      // Step
      expect(matchCronField('*/15', 0)).toBe(true);
      expect(matchCronField('*/15', 15)).toBe(true);
      expect(matchCronField('*/15', 45)).toBe(true);
      expect(matchCronField('*/15', 10)).toBe(false);
    });

    test('isCronMatch correctly matches 8:00 AM daily morning briefing ("0 8 * * *")', () => {
      // 2026-08-24 08:00:00 (Monday)
      const matchingDate = new Date(2026, 7, 24, 8, 0, 0);
      expect(isCronMatch('0 8 * * *', matchingDate)).toBe(true);

      // 2026-08-24 08:01:00 -> false
      const nonMatchingMin = new Date(2026, 7, 24, 8, 1, 0);
      expect(isCronMatch('0 8 * * *', nonMatchingMin)).toBe(false);

      // 2026-08-24 09:00:00 -> false
      const nonMatchingHour = new Date(2026, 7, 24, 9, 0, 0);
      expect(isCronMatch('0 8 * * *', nonMatchingHour)).toBe(false);
    });

    test('isCronMatch correctly matches weekday-only schedule ("30 7 * * 1-5")', () => {
      // Monday 7:30 AM (dow = 1)
      const monday = new Date(2026, 7, 24, 7, 30, 0);
      expect(isCronMatch('30 7 * * 1-5', monday)).toBe(true);

      // Sunday 7:30 AM (dow = 0)
      const sunday = new Date(2026, 7, 23, 7, 30, 0);
      expect(isCronMatch('30 7 * * 1-5', sunday)).toBe(false);
    });

    test('isCronMatch handles periodic step expressions ("*/10 * * * *")', () => {
      const min20 = new Date(2026, 7, 24, 14, 20, 0);
      expect(isCronMatch('*/10 * * * *', min20)).toBe(true);

      const min25 = new Date(2026, 7, 24, 14, 25, 0);
      expect(isCronMatch('*/10 * * * *', min25)).toBe(false);
    });

    test('isCronMatch returns false on invalid cron expression', () => {
      expect(isCronMatch('', new Date())).toBe(false);
      expect(isCronMatch('0 8 *', new Date())).toBe(false);
      expect(isCronMatch('invalid syntax test', new Date())).toBe(false);
    });
  });

  // ==========================================================================
  // 2. NATIVE SCHEDULER MODULE BRIDGE
  // ==========================================================================
  describe('SchedulerModule Native Bridge', () => {
    test('schedules exact alarm with AlarmManager and tracks in mock state', async () => {
      const task: ScheduledTask = {
        id: 'test_alarm_1',
        taskType: 'ALARM',
        title: 'Morning wake alarm',
        targetTimestamp: Date.now() + 60000,
      };

      const result = await SchedulerModule.scheduleExactAlarm(task);
      expect(result).toBe(true);

      const alarms = SchedulerModule.getMockAlarms();
      expect(alarms.length).toBe(1);
      expect(alarms[0].id).toBe('test_alarm_1');
      expect(alarms[0].title).toBe('Morning wake alarm');
    });

    test('cancels alarm from AlarmManager and removes from mock state', async () => {
      const task: ScheduledTask = {
        id: 'test_alarm_2',
        taskType: 'ALARM',
        title: 'Cancelable alarm',
        targetTimestamp: Date.now() + 120000,
      };

      await SchedulerModule.scheduleExactAlarm(task);
      expect(SchedulerModule.getMockAlarms().length).toBe(1);

      const cancelResult = await SchedulerModule.cancelAlarm('test_alarm_2');
      expect(cancelResult).toBe(true);
      expect(SchedulerModule.getMockAlarms().length).toBe(0);
    });

    test('schedules and cancels periodic background work with WorkManager', async () => {
      const scheduleWorkRes = await SchedulerModule.schedulePeriodicWork('telemetry_sync', 15);
      expect(scheduleWorkRes).toBe(true);

      const cancelWorkRes = await SchedulerModule.cancelWork('telemetry_sync');
      expect(cancelWorkRes).toBe(true);
    });

    test('checks exact alarm capability and opens settings', async () => {
      const canSchedule = await SchedulerModule.canScheduleExactAlarms();
      expect(typeof canSchedule).toBe('boolean');

      const settingsRes = await SchedulerModule.openExactAlarmSettings();
      expect(typeof settingsRes).toBe('boolean');
    });
  });

  // ==========================================================================
  // 3. PROACTIVE ROUTINES (MORNING BRIEFING, BATTERY, NOTIFICATIONS)
  // ==========================================================================
  describe('Proactive Routines (ADR-017 Iron Man Persona)', () => {
    test('executeMorningBriefing formats Boss persona status report with battery, time, alarms, weather', async () => {
      const briefing = await executeMorningBriefing(false);

      expect(briefing).toBeDefined();
      expect(briefing.batteryLevel).toBeGreaterThanOrEqual(0);
      expect(briefing.spokenText).toContain('Boss');
      expect(briefing.spokenText).toMatch(/Good morning, Boss/i);
      expect(briefing.spokenText).toContain(String(briefing.batteryLevel));
      expect(briefing.weather).toBeDefined();
      expect(briefing.weather.tempCelsius).toBe(24);

      // Verify strict spoken format rules: no markdown symbols
      expect(briefing.spokenText).not.toContain('**');
      expect(briefing.spokenText).not.toContain('##');
      expect(briefing.spokenText).not.toContain('```');
      expect(briefing.spokenText).not.toContain('`');
    });

    test('executeBatteryAlert creates critical power announcement addressing Boss', async () => {
      const alert = await executeBatteryAlert(12, false);

      expect(alert.alertTriggered).toBe(true);
      expect(alert.batteryLevel).toBe(12);
      expect(alert.spokenText).toContain('Boss');
      expect(alert.spokenText).toContain('12%');
      expect(alert.spokenText).toMatch(/Power levels critical, Boss/i);

      // No markdown
      expect(alert.spokenText).not.toContain('**');
    });

    test('filterPriorityNotifications correctly filters communication and messaging apps', () => {
      const sampleNotifications: NotificationItem[] = [
        {
          id: '1',
          packageName: 'com.whatsapp',
          appName: 'WhatsApp',
          title: 'Mom',
          text: 'Call me back',
          timestamp: Date.now(),
        },
        {
          id: '2',
          packageName: 'com.google.android.gm',
          appName: 'Gmail',
          title: 'Stark Industries',
          text: 'Project update',
          timestamp: Date.now(),
        },
        {
          id: '3',
          packageName: 'com.android.chrome',
          appName: 'Chrome',
          title: 'News article',
          text: 'Random web news',
          timestamp: Date.now(),
        },
        {
          id: '4',
          packageName: 'com.spotify.music',
          appName: 'Spotify',
          title: 'New album release',
          text: 'Listen now',
          timestamp: Date.now(),
        },
      ];

      const priority = filterPriorityNotifications(sampleNotifications);
      expect(priority.length).toBe(2);
      expect(priority.map((n) => n.appName)).toEqual(['WhatsApp', 'Gmail']);
    });

    test('executeNotificationDigest formats priority communications for Boss', async () => {
      const digest = await executeNotificationDigest(false);

      expect(digest).toBeDefined();
      expect(digest.spokenText).toContain('Boss');
      expect(digest.priorityCount).toBeGreaterThanOrEqual(0);
      expect(digest.totalCount).toBeGreaterThanOrEqual(digest.priorityCount);
    });
  });

  // ==========================================================================
  // 4. PROACTIVE SCHEDULER ENGINE
  // ==========================================================================
  describe('ProactiveScheduler Engine', () => {
    test('schedules one-shot alarm and registers with SchedulerModule', async () => {
      const targetTime = Date.now() + 5000;
      const task = await scheduler.scheduleOneShotAlarm('Check flight prices', targetTime, {
        flight: 'AI-101',
      });

      expect(task.id).toBeDefined();
      expect(task.title).toBe('Check flight prices');
      expect(task.taskType).toBe('ALARM');
      expect(task.isActive).toBe(true);

      const found = scheduler.getTask(task.id);
      expect(found).toBeDefined();
      expect(found?.title).toBe('Check flight prices');

      const mockAlarms = SchedulerModule.getMockAlarms();
      expect(mockAlarms.some((a) => a.id === task.id)).toBe(true);
    });

    test('schedules recurring cron routine', async () => {
      const task = await scheduler.scheduleCronRoutine(
        'NOTIFICATION_DIGEST',
        '*/15 * * * *',
        'Quarterly Digest',
        'routine_notif_digest_test'
      );

      expect(task.id).toBe('routine_notif_digest_test');
      expect(task.recurringCron).toBe('*/15 * * * *');
      expect(task.taskType).toBe('ROUTINE');
      expect(task.isActive).toBe(true);

      const tasks = scheduler.listTasks(true);
      expect(tasks.some((t) => t.id === 'routine_notif_digest_test')).toBe(true);
    });

    test('cancels scheduled task and cleans up native alarm', async () => {
      const targetTime = Date.now() + 10000;
      const task = await scheduler.scheduleOneShotAlarm('Temporary Alarm', targetTime, {}, 'temp_alarm_1');

      expect(scheduler.getTask('temp_alarm_1')).toBeDefined();

      const cancelSuccess = await scheduler.cancelTask('temp_alarm_1');
      expect(cancelSuccess).toBe(true);
      expect(scheduler.getTask('temp_alarm_1')).toBeUndefined();

      const mockAlarms = SchedulerModule.getMockAlarms();
      expect(mockAlarms.some((a) => a.id === 'temp_alarm_1')).toBe(false);
    });

    test('tick() triggers elapsed one-shot alarm and deactivates it', async () => {
      const pastTime = Date.now() - 1000;
      await scheduler.scheduleOneShotAlarm('Elapsed Alarm', pastTime, {}, 'elapsed_alarm_1');

      const results = await scheduler.tick(new Date());
      expect(results.length).toBeGreaterThan(0);

      const alarmResult = results.find((r) => r.taskId === 'elapsed_alarm_1');
      expect(alarmResult).toBeDefined();
      expect(alarmResult?.result.spokenText).toContain('Elapsed Alarm');

      // Should be deactivated
      const taskAfter = scheduler.getTask('elapsed_alarm_1');
      expect(taskAfter?.isActive).toBe(false);
    });

    test('tick() triggers cron routine on matching time and prevents duplicate in same minute', async () => {
      // Register test routine at 8:00 AM
      await scheduler.scheduleCronRoutine(
        'MORNING_BRIEFING',
        '0 8 * * *',
        'Daily Morning Briefing Test',
        'test_morning_cron'
      );

      const test8AM = new Date(2026, 7, 24, 8, 0, 0);

      // First tick at 8:00 AM triggers the routine
      const results1 = await scheduler.tick(test8AM);
      const triggered1 = results1.find((r) => r.taskId === 'test_morning_cron');
      expect(triggered1).toBeDefined();
      expect(triggered1?.result.spokenText).toMatch(/Good morning, Boss/i);

      // Second tick within the same minute should NOT re-trigger
      const test8AMAgain = new Date(2026, 7, 24, 8, 0, 30);
      const results2 = await scheduler.tick(test8AMAgain);
      const triggered2 = results2.find((r) => r.taskId === 'test_morning_cron');
      expect(triggered2).toBeUndefined();
    });

    test('battery monitor alerts on low battery (< 15%) when discharging and debounces', async () => {
      // Low battery test (12%, discharging)
      const res1 = await scheduler.checkBatteryLevel(12, false);
      expect(res1.alerted).toBe(true);
      expect(res1.level).toBe(12);
      expect(res1.message).toContain('12%');

      // Immediate same level check should be debounced
      const res2 = await scheduler.checkBatteryLevel(12, false);
      expect(res2.alerted).toBe(false);

      // Level drops further to 9% -> alerts again
      const res3 = await scheduler.checkBatteryLevel(9, false);
      expect(res3.alerted).toBe(true);
      expect(res3.level).toBe(9);

      // While charging -> should NOT alert
      const resCharging = await scheduler.checkBatteryLevel(10, true);
      expect(resCharging.alerted).toBe(false);

      // Above threshold (e.g. 50%) -> should NOT alert
      const resHigh = await scheduler.checkBatteryLevel(50, false);
      expect(resHigh.alerted).toBe(false);
    });

    test('direct handleAlarmTrigger processes morning briefing and notification digest triggers', async () => {
      const briefingResult = await scheduler.handleAlarmTrigger('test_task', JSON.stringify({ routine: 'MORNING_BRIEFING' }));
      expect(briefingResult.spokenText).toMatch(/Good morning, Boss/i);

      const digestResult = await scheduler.handleAlarmTrigger('test_task_2', JSON.stringify({ routine: 'NOTIFICATION_DIGEST' }));
      expect(digestResult.spokenText).toContain('Boss');
    });

    test('start() and stop() manage lifecycle cleanly', () => {
      expect(scheduler.isSchedulerRunning()).toBe(false);
      scheduler.start(5000);
      expect(scheduler.isSchedulerRunning()).toBe(true);
      scheduler.stop();
      expect(scheduler.isSchedulerRunning()).toBe(false);
    });
  });

  // ==========================================================================
  // 5. SCHEDULER TOOLS (TOOL REGISTRY INTEGRATION)
  // ==========================================================================
  describe('Scheduler Tools Integration', () => {
    test('ToolRegistry includes all Phase 8 scheduler tools', () => {
      const allTools = ToolRegistry.getAllTools();
      const names = allTools.map((t) => t.name);

      expect(names).toContain('schedule_alarm');
      expect(names).toContain('schedule_routine');
      expect(names).toContain('cancel_scheduled_task');
      expect(names).toContain('list_scheduled_tasks');
      expect(names).toContain('run_proactive_routine');
    });

    test('executes schedule_alarm tool with delayMinutes', async () => {
      const result = await ToolRegistry.executeTool('schedule_alarm', {
        title: 'Check server logs',
        delayMinutes: 5,
      });

      expect(result.success).toBe(true);
      expect(result.data.title).toBe('Check server logs');
      expect(result.data.taskId).toBeDefined();
      expect(result.data.targetTimestamp).toBeGreaterThan(Date.now());
    });

    test('executes schedule_alarm tool with timeString ("8:30 AM")', async () => {
      const result = await ToolRegistry.executeTool('schedule_alarm', {
        title: 'Standup Meeting',
        timeString: '8:30 AM',
      });

      expect(result.success).toBe(true);
      expect(result.data.title).toBe('Standup Meeting');
      expect(result.data.formattedTime).toBeDefined();
    });

    test('executes schedule_routine tool for custom cron routine', async () => {
      const result = await ToolRegistry.executeTool('schedule_routine', {
        routineName: 'NOTIFICATION_DIGEST',
        cronExpression: '*/30 * * * *',
        title: 'Half-hourly notification sweep',
      });

      expect(result.success).toBe(true);
      expect(result.data.routineName).toBe('NOTIFICATION_DIGEST');
      expect(result.data.cronExpression).toBe('*/30 * * * *');
    });

    test('executes list_scheduled_tasks tool', async () => {
      const result = await ToolRegistry.executeTool('list_scheduled_tasks', {
        activeOnly: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.count).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(result.data.tasks)).toBe(true);
    });

    test('executes cancel_scheduled_task tool', async () => {
      // First schedule a task
      const scheduleRes = await ToolRegistry.executeTool('schedule_alarm', {
        title: 'Task to cancel',
        delayMinutes: 10,
      });
      const taskId = scheduleRes.data.taskId;

      // Cancel it
      const cancelRes = await ToolRegistry.executeTool('cancel_scheduled_task', { taskId });
      expect(cancelRes.success).toBe(true);
      expect(cancelRes.data.cancelled).toBe(true);

      // Canceling again should return error
      const doubleCancelRes = await ToolRegistry.executeTool('cancel_scheduled_task', { taskId });
      expect(doubleCancelRes.success).toBe(false);
    });

    test('executes run_proactive_routine tool for morning briefing, battery alert, and notification digest', async () => {
      const morningRes = await ToolRegistry.executeTool('run_proactive_routine', {
        routineName: 'morning_briefing',
      });
      expect(morningRes.success).toBe(true);
      expect(morningRes.data.spokenText).toMatch(/Good morning, Boss/i);

      const batteryRes = await ToolRegistry.executeTool('run_proactive_routine', {
        routineName: 'battery_alert',
        batteryLevel: 10,
      });
      expect(batteryRes.success).toBe(true);
      expect(batteryRes.data.spokenText).toMatch(/Power levels critical, Boss/i);

      const notifRes = await ToolRegistry.executeTool('run_proactive_routine', {
        routineName: 'notification_digest',
      });
      expect(notifRes.success).toBe(true);
      expect(notifRes.data.spokenText).toContain('Boss');
    });

    test('run_proactive_routine tool returns error for invalid routine name', async () => {
      const invalidRes = await ToolRegistry.executeTool('run_proactive_routine', {
        routineName: 'invalid_routine_name',
      });
      expect(invalidRes.success).toBe(false);
      expect(invalidRes.error).toContain('Unknown routine');
    });
  });

  // ==========================================================================
  // 6. PHASE 8 DEEP AUDIT & EDGE CASES
  // ==========================================================================
  describe('6. Phase 8 Deep Audit & Edge Cases', () => {
    test('Cron: correctly handles leap years (Feb 29 on leap vs non-leap year)', () => {
      // 2024 is a leap year (Feb 29 exists)
      const leapDay2024 = new Date(2024, 1, 29, 12, 0, 0); // Feb 29 2024
      expect(isCronMatch('0 12 29 2 *', leapDay2024)).toBe(true);

      // 2026 is NOT a leap year (Feb 28 is last day)
      const feb28_2026 = new Date(2026, 1, 28, 12, 0, 0);
      expect(isCronMatch('0 12 29 2 *', feb28_2026)).toBe(false);
    });

    test('Cron: handles month boundaries (1-12) and month name abbreviations (JAN-DEC)', () => {
      // August 24 -> month = 8
      const augDate = new Date(2026, 7, 24, 10, 0, 0); // month index 7 = August (month 8)
      expect(isCronMatch('0 10 24 8 *', augDate)).toBe(true);
      expect(isCronMatch('0 10 24 AUG *', augDate)).toBe(true);
      expect(isCronMatch('0 10 24 JUL *', augDate)).toBe(false);
    });

    test('Cron: handles day-of-week 0-7, 1-7, Sunday as 0 and 7, and day names (MON-FRI)', () => {
      // Sunday 2026-08-23 (dow = 0)
      const sunday = new Date(2026, 7, 23, 10, 0, 0);
      expect(isCronMatch('0 10 * * 0', sunday)).toBe(true);
      expect(isCronMatch('0 10 * * 7', sunday)).toBe(true);
      expect(isCronMatch('0 10 * * SUN', sunday)).toBe(true);
      expect(isCronMatch('0 10 * * 0-7', sunday)).toBe(true);
      expect(isCronMatch('0 10 * * 1-7', sunday)).toBe(true);
      expect(isCronMatch('0 10 * * 1-5', sunday)).toBe(false);

      // Monday 2026-08-24 (dow = 1)
      const monday = new Date(2026, 7, 24, 10, 0, 0);
      expect(isCronMatch('0 10 * * MON-FRI', monday)).toBe(true);
      expect(isCronMatch('0 10 * * 1-7', monday)).toBe(true);
      expect(isCronMatch('0 10 * * 0-7', monday)).toBe(true);
    });

    test('Cron: guards against division by zero in step expressions (*/0, 0-30/0, */-5)', () => {
      const sampleDate = new Date(2026, 7, 24, 10, 0, 0);
      expect(isCronMatch('*/0 * * * *', sampleDate)).toBe(false);
      expect(isCronMatch('0-30/0 * * * *', sampleDate)).toBe(false);
      expect(isCronMatch('*/-5 * * * *', sampleDate)).toBe(false);
      expect(isCronMatch('*/abc * * * *', sampleDate)).toBe(false);
    });

    test('Routines: handles device stats errors gracefully without throwing', async () => {
      // executeMorningBriefing with normal parameters
      const briefing = await executeMorningBriefing(false);
      expect(briefing).toBeDefined();
      expect(briefing.batteryLevel).toBeGreaterThanOrEqual(0);
      expect(briefing.spokenText).toContain('Boss');

      // executeBatteryAlert with negative or >100 level
      const alertNeg = await executeBatteryAlert(-5, false);
      expect(alertNeg.batteryLevel).toBe(0);

      const alertOver = await executeBatteryAlert(150, false);
      expect(alertOver.batteryLevel).toBe(100);

      // filterPriorityNotifications with malformed input
      expect(filterPriorityNotifications(null as any)).toEqual([]);
      expect(filterPriorityNotifications([null, undefined, {}] as any)).toEqual([]);
    });
  });
});
