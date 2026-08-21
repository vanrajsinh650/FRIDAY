# FRIDAY — Observability & Telemetry Architecture

---

## 1. Structured Internal Event Flow

Every action taken by FRIDAY emits structured telemetry events for real-time debugging and performance tracking:

```typescript
export type TelemetryEventType =
  | 'TASK_STARTED'
  | 'VOICE_DETECTED'
  | 'STT_RESULT'
  | 'AGENT_PLAN_CREATED'
  | 'ACTION_DISPATCHED'
  | 'ACTION_COMPLETED'
  | 'SCREEN_OBSERVED'
  | 'VERIFICATION_STARTED'
  | 'VERIFICATION_PASSED'
  | 'RECOVERY_TRIGGERED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED';

export interface TelemetryEvent {
  type: TelemetryEventType;
  timestamp: number;
  taskId: string;
  payload: Record<string, any>;
  durationMs?: number;
}
```

---

## 2. React Native Debug HUD Overlay

A built-in developer overlay accessible via three-finger tap displays:
- Real-time active task ID and state machine status.
- Live pruned accessibility tree with clickable bounds highlighted.
- Real-time latency gauges: STT latency, Groq TTFT, TTS first-audio latency, and total task execution time.
- Sanitized log stream (all personal user data and PII automatically redacted).