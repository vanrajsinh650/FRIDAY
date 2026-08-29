import { GoalEngine } from '../src/task/GoalEngine';
import { TaskManager } from '../src/task/TaskManager';
import { ExperienceMemory } from '../src/memory/ExperienceMemory';
import { FridayTask } from '../src/task/types';

describe('GoalEngine, TaskManager & ExperienceMemory', () => {
  beforeEach(() => {
    ExperienceMemory.getInstance().clear();
  });

  test('GoalEngine parses natural statements into structured Goals', () => {
    const goal1 = GoalEngine.parse('Turn on the flashlight');
    expect(goal1.category).toBe('DEVICE_CONTROL');
    expect(goal1.confirmationRequired).toBe(false);

    const goal2 = GoalEngine.parse('Remind me to call Mom at 5pm');
    expect(goal2.category).toBe('SCHEDULING');

    const goal3 = GoalEngine.parse('What is my battery level');
    expect(goal3.category).toBe('INFORMATION_RETRIEVAL');

    const goal4 = GoalEngine.parse('Uninstall suspicious app');
    expect(goal4.confirmationRequired).toBe(true);
  });

  test('TaskManager creates and manages task lifecycle states', () => {
    const goal = GoalEngine.parse('Mute media volume');
    const task = TaskManager.createTask(goal);

    expect(task.status).toBe('CREATED');
    expect(task.goal.objective).toBe('Mute media volume');

    TaskManager.updateStatus('EXECUTING');
    expect(TaskManager.getCurrentTask()?.status).toBe('EXECUTING');

    TaskManager.recordAction({
      actionId: 'act_1',
      capabilityName: 'set_device_setting',
      parameters: { setting: 'VOLUME', value: 0 },
      success: true,
      executionDurationMs: 15,
      timestamp: Date.now(),
    });

    expect(TaskManager.getCurrentTask()?.actions.length).toBe(1);

    TaskManager.completeTask('Media muted, Boss.');
    expect(TaskManager.getCurrentTask()).toBeNull();
  });

  test('ExperienceMemory records verified strategies and generates self-correction hints', () => {
    const memory = ExperienceMemory.getInstance();
    const goal = GoalEngine.parse('Set volume to 50%');

    const mockTask: FridayTask = {
      taskId: 'task_exp_1',
      goal,
      status: 'COMPLETED',
      currentStepIndex: 1,
      maxSteps: 5,
      observations: ['Media volume at 70%'],
      actions: [
        {
          actionId: 'act_1',
          capabilityName: 'set_device_setting',
          parameters: { setting: 'VOLUME', value: 50 },
          success: true,
          executionDurationMs: 12,
          timestamp: Date.now(),
        },
      ],
      evidence: [
        {
          source: 'NATIVE_STATE',
          description: 'Confirmed volume at 50%',
          verified: true,
          timestamp: Date.now(),
        },
      ],
      retries: 0,
      recoveryCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    memory.recordExperience(mockTask);

    const exp = memory.findExperience(goal);
    expect(exp).toBeDefined();
    expect(exp?.successCount).toBe(1);
    expect(exp?.actionSequence).toContain('set_device_setting');

    const promptHint = memory.formatForPrompt(goal);
    expect(promptHint).toContain('EXPERIENCE MEMORY HINT');
    expect(promptHint).toContain('set_device_setting');
  });
});
