import { FridayAgent } from '../src/agent/agent';
import { useAgentStore } from '../src/state/agentStore';
import { AccessibilityModule } from '../src/native/AccessibilityModule';

describe('FridayAgent Core Execution Engine', () => {
  beforeEach(() => {
    useAgentStore.getState().reset();
    AccessibilityModule.resetMockTree();
    // Simulate a device where the user has granted Accessibility. The agent now
    // gates screen-control goals on this being enabled (a disabled service
    // prompts the user instead of blindly relaunching apps), so the benchmark
    // must run as if the permission is already on.
    jest.spyOn(AccessibilityModule, 'isServiceEnabled').mockResolvedValue(true);
  });

  test('executes YouTube multi-step search benchmark successfully', async () => {
    const agent = new FridayAgent();
    const result = await agent.executeGoal('Open YouTube and search Taarak Mehta funny episode and play it');

    expect(result.toLowerCase()).toContain('boss');
    expect(useAgentStore.getState().state).toBe('SUCCESS');
    expect(useAgentStore.getState().steps.length).toBeGreaterThanOrEqual(4);

    const stepTools = useAgentStore.getState().steps.map((s) => s.toolName);
    expect(stepTools).toContain('launch_app');
    expect(stepTools).toContain('click_node');
    expect(stepTools).toContain('type_text');
  });

  test('executes battery status intent successfully', async () => {
    const agent = new FridayAgent();
    const result = await agent.executeGoal('What is my battery level?');

    expect(result.toLowerCase()).toContain('boss');
    expect(useAgentStore.getState().state).toBe('SUCCESS');
  });

  test('responds immediately to wake up and hey friday commands', async () => {
    const agent = new FridayAgent();
    
    const wakeUpResult = await agent.executeGoal('wake up');
    expect(wakeUpResult.toLowerCase()).toContain('boss');
    expect(wakeUpResult.toLowerCase()).toContain('ready');
    expect(useAgentStore.getState().state).toBe('SUCCESS');

    const heyFridayResult = await agent.executeGoal('hey friday');
    expect(heyFridayResult.toLowerCase()).toContain('boss');
    expect(useAgentStore.getState().state).toBe('SUCCESS');

    const uthJaoResult = await agent.executeGoal('uth jao friday');
    expect(uthJaoResult.toLowerCase()).toContain('boss');
    expect(uthJaoResult.toLowerCase()).toContain('active');
    expect(useAgentStore.getState().state).toBe('SUCCESS');
  });

  test('answers identity and conversational persona queries without network dependencies', async () => {
    const agent = new FridayAgent();
    
    const whoResult = await agent.executeGoal('who are you');
    expect(whoResult).toContain('FRIDAY');
    expect(whoResult.toLowerCase()).toContain('assistant');
    expect(useAgentStore.getState().state).toBe('SUCCESS');

    const howResult = await agent.executeGoal('how are you');
    expect(howResult.toLowerCase()).toContain('boss');
    expect(useAgentStore.getState().state).toBe('SUCCESS');

    const featuresResult = await agent.executeGoal('what can you do');
    expect(featuresResult.toLowerCase()).toContain('youtube');
    expect(featuresResult.toLowerCase()).toContain('whatsapp');
    expect(useAgentStore.getState().state).toBe('SUCCESS');
  });

  test('schedules reminders and answers reminder list queries', async () => {
    const agent = new FridayAgent();

    // 1. Schedule a reminder
    const scheduleResult = await agent.executeGoal('remind me at 9:50 to check flight status');
    expect(scheduleResult.toLowerCase()).toContain('boss');
    expect(scheduleResult.toLowerCase()).toContain('scheduled');
    expect(useAgentStore.getState().state).toBe('SUCCESS');

    // 2. Query scheduled reminders
    const listResult = await agent.executeGoal('Tell me what reminders I set');
    expect(listResult.toLowerCase()).toContain('boss');
    expect(useAgentStore.getState().state).toBe('SUCCESS');
  });
});

