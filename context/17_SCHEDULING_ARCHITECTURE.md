# FRIDAY — Scheduling & Autonomous Background Work

---

## 1. Decoupled Scheduling Architecture

The LLM is **never kept running continuously in the background** to wait for scheduled tasks. Instead, FRIDAY leverages native Android scheduling primitives:

```text
User: "Remind me at 8 AM tomorrow to check flight prices"
      │
      ▼
FRIDAY Agent parses task -> writes job record to SQLite
      │
      ▼
SchedulerModule registers exact trigger with Android AlarmManager
      │
      ▼ (Phone enters deep Doze / Idle sleep)
[Next Morning at 08:00:00]
      │
      ▼
AlarmManager BroadcastReceiver awakens FridayForegroundService
      │
      ▼
Service evaluates task:
  ├─ If simple reminder: Play local notification sound + speak via Pocket-TTS
  └─ If autonomous action (e.g. check flight): Invoke Agent Core in Headless JS
```

---

## 2. Primitives: AlarmManager vs. WorkManager

- **`AlarmManager.setExactAndAllowWhileIdle()`**: Used for time-critical, user-facing alarms and scheduled reminders that must trigger at exact seconds even in Doze mode.
- **`WorkManager`**: Used for non-exact background tasks such as memory sync, telemetry cleanup, and periodic cache refresh.
- **`BOOT_COMPLETED` Receiver**: Automatically reschedules active alarms whenever the phone reboots.