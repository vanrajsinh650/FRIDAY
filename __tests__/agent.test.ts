import { FridayAgent } from '../src/agent/agent';
import { useAgentStore } from '../src/state/agentStore';

describe('FridayAgent Core Execution Engine', () => {
  beforeEach(() => {
    useAgentStore.getState().reset();
  });

  test('executes YouTube multi-step search benchmark successfully', async () => {
    const agent = new FridayAgent();
    const result = await agent.executeGoal('Open YouTube and search Taarak Mehta funny episode and play it');

    expect(result).toContain('Completed, boss');
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

    expect(result).toContain('Completed, boss');
    expect(useAgentStore.getState().state).toBe('SUCCESS');
  });
});
