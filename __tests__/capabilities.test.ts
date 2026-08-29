import { CapabilityRegistry } from '../src/capabilities/CapabilityRegistry';
import { WorldModel } from '../src/world/WorldModel';

describe('Capability Registry & Discovery', () => {
  beforeAll(() => {
    CapabilityRegistry.initialize();
  });

  test('registers and discovers general Android capabilities', async () => {
    const world = await WorldModel.snapshot(true);
    const snapshot = CapabilityRegistry.discover(world);

    expect(snapshot.availableCapabilities.length).toBeGreaterThan(5);
    expect(snapshot.availableCapabilities.some((c) => c.id === 'observe_device')).toBe(true);
    expect(snapshot.availableCapabilities.some((c) => c.id === 'launch_surface')).toBe(true);
    expect(snapshot.availableCapabilities.some((c) => c.id === 'set_device_setting')).toBe(true);
    expect(snapshot.availableCapabilities.some((c) => c.id === 'schedule_task')).toBe(true);
    expect(snapshot.availableCapabilities.some((c) => c.id === 'complete_goal')).toBe(true);
  });

  test('formats available capabilities for LLM prompt visibility', async () => {
    const world = await WorldModel.snapshot(true);
    const snapshot = CapabilityRegistry.discover(world);
    const formatted = CapabilityRegistry.formatCapabilitiesForPrompt(snapshot);

    expect(formatted).toContain('AVAILABLE GENERAL CAPABILITIES ON THIS DEVICE');
    expect(formatted).toContain('observe_device');
    expect(formatted).toContain('launch_surface');
  });

  test('executes capability actions safely', async () => {
    const observeCap = CapabilityRegistry.get('observe_device');
    expect(observeCap).toBeDefined();
    const result = await observeCap!.execute({});
    expect(result).toHaveProperty('battery');

    const settingCap = CapabilityRegistry.get('set_device_setting');
    expect(settingCap).toBeDefined();
    const settingResult = await settingCap!.execute({ setting: 'VOLUME', value: 80 });
    expect(settingResult).toBe(true);
  });
});
