import { ToolRegistry } from '../src/tools/registry';

describe('ToolRegistry & Native Android Tools', () => {
  beforeAll(() => {
    ToolRegistry.initialize();
  });

  test('lists all registered default tools', () => {
    const tools = ToolRegistry.getAllTools();
    expect(tools.length).toBeGreaterThan(5);

    const names = tools.map((t) => t.name);
    expect(names).toContain('launch_app');
    expect(names).toContain('click_node');
    expect(names).toContain('type_text');
    expect(names).toContain('get_battery_status');
    expect(names).toContain('set_brightness');
  });

  test('executes launch_app tool successfully', async () => {
    const result = await ToolRegistry.executeTool('launch_app', { packageNameOrName: 'YouTube' });
    expect(result.success).toBe(true);
    expect(result.data.launchedPackage).toBe('com.google.android.youtube');
  });

  test('executes get_battery_status tool successfully', async () => {
    const result = await ToolRegistry.executeTool('get_battery_status', {});
    expect(result.success).toBe(true);
    expect(result.data.level).toBe(85);
  });

  test('returns error for non-existent tool', async () => {
    const result = await ToolRegistry.executeTool('non_existent_tool', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});
