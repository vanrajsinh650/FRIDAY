// src/memory/lifelong/TrajectoryRecorder.ts

import { EpisodicTrajectoryRecord, UIActionStep } from './types';
import { EmbeddingProvider } from './EmbeddingProvider';

export class TrajectoryRecorder {
  private activeSteps: UIActionStep[] = [];
  private taskIntent: string = '';
  private targetPackage: string = '';
  private startTime: number = 0;

  startRecording(taskIntent: string, targetPackage: string): void {
    this.taskIntent = taskIntent;
    this.targetPackage = targetPackage;
    this.activeSteps = [];
    this.startTime = Date.now();
  }

  recordStep(step: Omit<UIActionStep, 'stepIndex'>): void {
    this.activeSteps.push({
      ...step,
      stepIndex: this.activeSteps.length + 1,
    });
  }

  finalize(success: boolean): EpisodicTrajectoryRecord | null {
    if (!success || this.activeSteps.length === 0) {
      this.activeSteps = [];
      return null;
    }

    const duration = Date.now() - this.startTime;
    const embedding = EmbeddingProvider.generateEmbedding(this.taskIntent);

    const record: EpisodicTrajectoryRecord = {
      id: `traj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      taskIntent: this.taskIntent,
      targetPackage: this.targetPackage,
      parameterSchema: {},
      actionSequence: [...this.activeSteps],
      successCount: 1,
      failureCount: 0,
      avgLatencyMs: duration,
      lastExecutedAt: Date.now(),
      createdAt: Date.now(),
      embedding,
    };

    this.activeSteps = [];
    return record;
  }
}
