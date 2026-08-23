import { useTelemetryStore } from '../state/telemetryStore';

export type TelemetryEventType =
  | 'TASK_STARTED'
  | 'VOICE_DETECTED'
  | 'STT_STARTED'
  | 'STT_RESULT'
  | 'SEMANTIC_PROCESSED'
  | 'VOICE_STATE_TRANSITION'
  | 'AGENT_STARTED'
  | 'PLAN_CREATED'
  | 'ACTION_DISPATCHED'
  | 'ACTION_COMPLETED'
  | 'SCREEN_OBSERVED'
  | 'VERIFICATION_STARTED'
  | 'VERIFICATION_PASSED'
  | 'RECOVERY_STARTED'
  | 'TASK_COMPLETED'
  | 'TASK_BLOCKED'
  | 'TASK_FAILED';

export class TelemetryLogger {
  static recordEvent(type: TelemetryEventType, payload?: Record<string, any>): void {
    const timestamp = Date.now();
    // Update live metrics
    if (payload?.latencyMs) {
      if (type === 'STT_RESULT') useTelemetryStore.getState().updateMetrics({ sttFirstTokenMs: payload.latencyMs });
      if (type === 'PLAN_CREATED') useTelemetryStore.getState().updateMetrics({ llmTimeFirstTokenMs: payload.latencyMs });
      if (type === 'ACTION_DISPATCHED' && !useTelemetryStore.getState().currentMetrics.timeToFirstActionMs) {
        useTelemetryStore.getState().updateMetrics({ timeToFirstActionMs: payload.latencyMs });
      }
    }
  }
}
