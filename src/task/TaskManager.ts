import { FridayTask, Goal, TaskStatus, ActionRecord, VerificationEvidence } from './types';
import { useAgentStore } from '../state/agentStore';

export class TaskManager {
  private static currentTask: FridayTask | null = null;
  private static taskHistory: FridayTask[] = [];

  static createTask(goal: Goal, maxSteps = 8): FridayTask {
    const task: FridayTask = {
      taskId: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      goal,
      status: 'CREATED',
      currentStepIndex: 0,
      maxSteps,
      observations: [],
      actions: [],
      evidence: [],
      retries: 0,
      recoveryCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.currentTask = task;
    useAgentStore.getState().setActiveGoal(goal.objective);
    return task;
  }

  static getCurrentTask(): FridayTask | null {
    return this.currentTask;
  }

  static updateStatus(status: TaskStatus): void {
    if (!this.currentTask) return;
    this.currentTask.status = status;
    this.currentTask.updatedAt = Date.now();
  }

  static addObservation(observation: string): void {
    if (!this.currentTask) return;
    this.currentTask.observations.push(observation);
    this.currentTask.updatedAt = Date.now();
  }

  static recordAction(action: ActionRecord): void {
    if (!this.currentTask) return;
    this.currentTask.actions.push(action);
    this.currentTask.currentStepIndex++;
    this.currentTask.updatedAt = Date.now();
  }

  static addEvidence(evidence: VerificationEvidence): void {
    if (!this.currentTask) return;
    this.currentTask.evidence.push(evidence);
    this.currentTask.updatedAt = Date.now();
  }

  static completeTask(finalResponse?: string): void {
    if (!this.currentTask) return;
    this.currentTask.status = 'COMPLETED';
    this.currentTask.updatedAt = Date.now();
    if (finalResponse) {
      useAgentStore.getState().setLastResponse(finalResponse);
    }
    useAgentStore.getState().setAgentState('SUCCESS');
    this.taskHistory.push(this.currentTask);
    this.currentTask = null;
  }

  static failTask(errorMessage: string): void {
    if (!this.currentTask) return;
    this.currentTask.status = 'FAILED';
    this.currentTask.updatedAt = Date.now();
    useAgentStore.getState().setError(errorMessage);
    useAgentStore.getState().setAgentState('ERROR');
    this.taskHistory.push(this.currentTask);
    this.currentTask = null;
  }

  static getRecentTasks(): FridayTask[] {
    return [...this.taskHistory].slice(-10);
  }
}
