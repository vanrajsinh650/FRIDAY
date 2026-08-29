import { WorldModel } from '../src/world/WorldModel';
import { SystemControlModule } from '../src/native/SystemControlModule';
import { AccessibilityModule } from '../src/native/AccessibilityModule';

describe('WorldModel Subsystem', () => {
  test('snapshots real-time device, foreground, and system state', async () => {
    const world = await WorldModel.snapshot(true);

    expect(world).toHaveProperty('device');
    expect(world).toHaveProperty('foreground');
    expect(world).toHaveProperty('screen');
    expect(world).toHaveProperty('notifications');
    expect(world).toHaveProperty('calendar');
    expect(world).toHaveProperty('permissions');
    expect(world).toHaveProperty('privilegeLevel');

    expect(world.device.batteryLevel).toBeGreaterThanOrEqual(0);
    expect(typeof world.device.isCharging).toBe('boolean');
    expect(world.permissions).toHaveProperty('accessibilityGranted');
  });

  test('formats world state into compact markdown summary for LLM reasoning', async () => {
    const world = await WorldModel.snapshot(true);
    const summary = WorldModel.formatForPrompt(world);

    expect(summary).toContain('LIVE ANDROID ENVIRONMENT & WORLD STATE');
    expect(summary).toContain('Time & Date');
    expect(summary).toContain('Device Hardware');
    expect(summary).toContain('Foreground Surface');
  });

  test('accurately classifies Android foreground surfaces', () => {
    expect(WorldModel.classifySurface('com.bbk.launcher2')).toBe('LAUNCHER');
    expect(WorldModel.classifySurface('com.friday')).toBe('LAUNCHER');
    expect(WorldModel.classifySurface('com.android.settings')).toBe('SETTINGS');
    expect(WorldModel.classifySurface('com.android.systemui')).toBe('SYSTEM_UI');
    expect(WorldModel.classifySurface('com.whatsapp')).toBe('APP');
    expect(WorldModel.classifySurface('com.android.keyguard')).toBe('KEYGUARD');
  });
});
