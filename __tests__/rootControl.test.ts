import { RootControlModule } from '../src/native/RootControlModule';
import { ToolRegistry } from '../src/tools/registry';
import { StepExecutor } from '../src/agent/loop/stepExecutor';
import { FridayAgent } from '../src/agent/agent';
import { useAgentStore } from '../src/state/agentStore';
import { SafetyGuard } from '../src/agent/safetyGuard';

describe('RootControl & Elevated Privileges Engine (ADR-014)', () => {
  beforeEach(() => {
    RootControlModule.resetMockState();
    useAgentStore.getState().reset();
    ToolRegistry.initialize();
  });

  afterEach(() => {
    RootControlModule.resetMockState();
  });

  describe('RootControlModule Status & Tiers', () => {
    test('reports ELEVATED_UNAVAILABLE when neither Shizuku nor Root is active (Tier 3)', async () => {
      RootControlModule.setMockStatus({
        shizukuAvailable: false,
        shizukuPermission: false,
        rootAvailable: false,
      });

      const status = await RootControlModule.getElevatedStatus();
      expect(status.elevatedAvailable).toBe(false);
      expect(status.activeTier).toBe('NONE');

      const result = await RootControlModule.executeElevatedShell('echo test');
      expect(result.success).toBe(false);
      expect(result.error).toBe('ELEVATED_UNAVAILABLE');
    });

    test('prioritizes Shizuku as Tier 1 when authorized', async () => {
      RootControlModule.setMockStatus({
        shizukuAvailable: true,
        shizukuPermission: true,
        rootAvailable: true, // both true, Shizuku must win
      });

      const status = await RootControlModule.getElevatedStatus();
      expect(status.shizukuPermission).toBe(true);
      expect(status.elevatedAvailable).toBe(true);
      expect(status.activeTier).toBe('SHIZUKU');

      const result = await RootControlModule.executeElevatedShell('getprop ro.build.version.release');
      expect(result.success).toBe(true);
      expect(RootControlModule.getExecutedCommands()).toContain('getprop ro.build.version.release');
    });

    test('uses True Root as Tier 2 opportunistic fallback when Shizuku is unauthorized', async () => {
      RootControlModule.setMockStatus({
        shizukuAvailable: false,
        shizukuPermission: false,
        rootAvailable: true,
      });

      const status = await RootControlModule.getElevatedStatus();
      expect(status.shizukuPermission).toBe(false);
      expect(status.rootAvailable).toBe(true);
      expect(status.elevatedAvailable).toBe(true);
      expect(status.activeTier).toBe('ROOT');

      const result = await RootControlModule.executeElevatedShell('id');
      expect(result.success).toBe(true);
    });

    test('handles requestShizukuPermission flow correctly', async () => {
      RootControlModule.setMockStatus({
        shizukuAvailable: true,
        shizukuPermission: false,
      });

      const granted = await RootControlModule.requestShizukuPermission();
      expect(granted).toBe(true);
      expect(await RootControlModule.hasShizukuPermission()).toBe(true);
    });
  });

  describe('Elevated Actions (Tap, Text, Key, Kill, Permission)', () => {
    beforeEach(() => {
      RootControlModule.setMockStatus({
        shizukuAvailable: true,
        shizukuPermission: true,
      });
    });

    test('inputTap executes input tap command with rounded coordinates', async () => {
      const ok = await RootControlModule.inputTap(540.6, 960.2);
      expect(ok).toBe(true);
      expect(RootControlModule.getExecutedCommands()).toContain('input tap 541 960');
    });

    test('inputTap rejects negative, NaN, infinite, or out-of-bounds coordinates', async () => {
      expect(await RootControlModule.inputTap(-10, 500)).toBe(false);
      expect(await RootControlModule.inputTap(500, -10)).toBe(false);
      expect(await RootControlModule.inputTap(NaN, 500)).toBe(false);
      expect(await RootControlModule.inputTap(500, Infinity)).toBe(false);
      expect(await RootControlModule.inputTap(20000, 500)).toBe(false);
    });

    test('inputText executes input text command with proper single-quote escaping and newline sanitization', async () => {
      const ok = await RootControlModule.inputText("Iron Man's armor");
      expect(ok).toBe(true);
      expect(RootControlModule.getExecutedCommands()).toContain("input text 'Iron Man'\\''s armor'");

      const okInjection = await RootControlModule.inputText("Hello\nrm -rf /");
      expect(okInjection).toBe(true);
      // Newline sanitized to space so it cannot break out of shell single quotes
      expect(RootControlModule.getExecutedCommands()).toContain("input text 'Hello rm -rf /'");
    });

    test('inputKey executes input keyevent with integer or string keycode', async () => {
      const okHome = await RootControlModule.inputKey(3);
      expect(okHome).toBe(true);
      expect(RootControlModule.getExecutedCommands()).toContain('input keyevent 3');

      const okEnter = await RootControlModule.inputKey('66');
      expect(okEnter).toBe(true);
      expect(RootControlModule.getExecutedCommands()).toContain('input keyevent 66');

      expect(await RootControlModule.inputKey(-1)).toBe(false);
      expect(await RootControlModule.inputKey(NaN)).toBe(false);
    });

    test('killProcess executes am force-stop command on valid package name', async () => {
      const ok = await RootControlModule.killProcess('com.spotify.music');
      expect(ok).toBe(true);
      expect(RootControlModule.getExecutedCommands()).toContain('am force-stop com.spotify.music');
    });

    test('killProcess rejects shell injection in package name', async () => {
      const bad1 = await RootControlModule.killProcess('com.spotify.music; rm -rf /');
      expect(bad1).toBe(false);

      const bad2 = await RootControlModule.killProcess('com.spotify.music | reboot');
      expect(bad2).toBe(false);

      const bad3 = await RootControlModule.killProcess('`reboot`');
      expect(bad3).toBe(false);
    });

    test('grantPermission executes pm grant command on valid package and permission', async () => {
      const ok = await RootControlModule.grantPermission('com.friday', 'android.permission.RECORD_AUDIO');
      expect(ok).toBe(true);
      expect(RootControlModule.getExecutedCommands()).toContain('pm grant com.friday android.permission.RECORD_AUDIO');
    });

    test('grantPermission rejects shell injection in permission or package', async () => {
      const bad1 = await RootControlModule.grantPermission('com.friday', 'android.permission.CAMERA; reboot');
      expect(bad1).toBe(false);

      const bad2 = await RootControlModule.grantPermission('com.friday; id', 'android.permission.CAMERA');
      expect(bad2).toBe(false);
    });
  });

  describe('ToolRegistry Elevated Tools Integration', () => {
    beforeEach(() => {
      RootControlModule.setMockStatus({
        shizukuAvailable: true,
        shizukuPermission: true,
      });
    });

    test('executes elevated_tap tool successfully', async () => {
      const res = await ToolRegistry.executeTool('elevated_tap', { x: 300, y: 700 });
      expect(res.success).toBe(true);
      expect(res.data.action).toBe('elevated_tap');
      expect(RootControlModule.getExecutedCommands()).toContain('input tap 300 700');
    });

    test('elevated_tap tool rejects invalid coordinates', async () => {
      const res1 = await ToolRegistry.executeTool('elevated_tap', { x: -5, y: 700 });
      expect(res1.success).toBe(false);
      expect(res1.error).toContain('non-negative finite numbers');

      const res2 = await ToolRegistry.executeTool('elevated_tap', { x: NaN, y: 700 });
      expect(res2.success).toBe(false);

      const res3 = await ToolRegistry.executeTool('elevated_tap', {});
      expect(res3.success).toBe(false);
    });

    test('executes elevated_text tool successfully', async () => {
      const res = await ToolRegistry.executeTool('elevated_text', { text: 'Friday AI' });
      expect(res.success).toBe(true);
      expect(res.data.text).toBe('Friday AI');
      expect(RootControlModule.getExecutedCommands()).toContain("input text 'Friday AI'");
    });

    test('executes elevated_key tool successfully', async () => {
      const res = await ToolRegistry.executeTool('elevated_key', { keyCode: 4 });
      expect(res.success).toBe(true);
      expect(res.data.keyCode).toBe(4);
      expect(RootControlModule.getExecutedCommands()).toContain('input keyevent 4');
    });

    test('executes kill_app_silent tool successfully', async () => {
      const res = await ToolRegistry.executeTool('kill_app_silent', { packageName: 'com.google.android.youtube' });
      expect(res.success).toBe(true);
      expect(res.data.killed).toBe(true);
      expect(RootControlModule.getExecutedCommands()).toContain('am force-stop com.google.android.youtube');
    });

    test('kill_app_silent rejects malicious package names', async () => {
      const res = await ToolRegistry.executeTool('kill_app_silent', { packageName: 'com.pkg; rm -rf /' });
      expect(res.success).toBe(false);
      expect(res.error).toContain('valid Android package name');
    });

    test('grant_runtime_permission rejects malicious inputs', async () => {
      const res = await ToolRegistry.executeTool('grant_runtime_permission', {
        packageName: 'com.pkg',
        permission: 'android.permission.CAMERA; rm -rf /',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('valid Android package and permission');
    });

    test('executes check_elevated_status tool successfully', async () => {
      const res = await ToolRegistry.executeTool('check_elevated_status', {});
      expect(res.success).toBe(true);
      expect(res.data.elevatedAvailable).toBe(true);
      expect(res.data.activeTier).toBe('SHIZUKU');
    });
  });

  describe('StepExecutor Elevated Fallback', () => {
    test('falls back to kill_app_silent when close_app fails and elevated privileges exist', async () => {
      RootControlModule.setMockStatus({
        shizukuAvailable: true,
        shizukuPermission: true,
      });

      // Mock close_app to fail
      const originalExecute = ToolRegistry.getTool('close_app')?.execute;
      ToolRegistry.registerTool({
        name: 'close_app',
        description: 'Mock failing close_app',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ success: false, error: 'Accessibility close failed' }),
      });

      const stepRecord = await StepExecutor.executeStep({
        id: 'step_1',
        toolName: 'close_app',
        parameters: { packageName: 'com.android.chrome' },
        description: 'Close Chrome app',
      });

      expect(stepRecord.success).toBe(true);
      expect(RootControlModule.getExecutedCommands()).toContain('am force-stop com.android.chrome');

      // Restore
      if (originalExecute) {
        ToolRegistry.registerTool({
          name: 'close_app',
          description: 'Close an application by package name.',
          parameters: { type: 'object', properties: {} },
          execute: originalExecute,
        });
      }
    });

    test('falls back to elevated_text when type_text fails and elevated privileges exist', async () => {
      RootControlModule.setMockStatus({
        shizukuAvailable: true,
        shizukuPermission: true,
      });

      const originalExecute = ToolRegistry.getTool('type_text')?.execute;
      ToolRegistry.registerTool({
        name: 'type_text',
        description: 'Mock failing type_text',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ success: false, error: 'Accessibility IME blocked' }),
      });

      const stepRecord = await StepExecutor.executeStep({
        id: 'step_2',
        toolName: 'type_text',
        parameters: { text: 'Elevated input payload' },
        description: 'Type text via fallback',
      });

      expect(stepRecord.success).toBe(true);
      expect(RootControlModule.getExecutedCommands()).toContain("input text 'Elevated input payload'");

      if (originalExecute) {
        ToolRegistry.registerTool({
          name: 'type_text',
          description: 'Type text into currently focused or editable element.',
          parameters: { type: 'object', properties: {} },
          execute: originalExecute,
        });
      }
    });

    test('falls back to elevated_key when press_home fails and elevated privileges exist', async () => {
      RootControlModule.setMockStatus({
        shizukuAvailable: true,
        shizukuPermission: true,
      });

      const originalExecute = ToolRegistry.getTool('press_home')?.execute;
      ToolRegistry.registerTool({
        name: 'press_home',
        description: 'Mock failing press_home',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ success: false, error: 'Accessibility home failed' }),
      });

      const stepRecord = await StepExecutor.executeStep({
        id: 'step_home',
        toolName: 'press_home',
        parameters: {},
        description: 'Press Home button',
      });

      expect(stepRecord.success).toBe(true);
      expect(RootControlModule.getExecutedCommands()).toContain('input keyevent 3');

      if (originalExecute) {
        ToolRegistry.registerTool({
          name: 'press_home',
          description: 'Navigate to Android home screen.',
          parameters: { type: 'object', properties: {} },
          execute: originalExecute,
        });
      }
    });

    test('propagates both primary error and elevated fallback error when fallback fails', async () => {
      RootControlModule.setMockStatus({
        shizukuAvailable: true,
        shizukuPermission: true,
      });

      const originalClose = ToolRegistry.getTool('close_app')?.execute;
      ToolRegistry.registerTool({
        name: 'close_app',
        description: 'Mock failing close_app',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ success: false, error: 'A11y service disabled' }),
      });

      // Force elevated execution failure
      RootControlModule.setMockExecutionResult({
        success: false,
        error: 'Shizuku daemon exited with -1',
        exitCode: -1,
      });

      const stepRecord = await StepExecutor.executeStep({
        id: 'step_fallback_fail',
        toolName: 'close_app',
        parameters: { packageName: 'com.example.app' },
        description: 'Close app with failing fallback',
      });

      expect(stepRecord.success).toBe(false);
      expect(stepRecord.error).toContain('A11y service disabled');
      expect(stepRecord.error).toContain('Elevated fallback failed');

      if (originalClose) {
        ToolRegistry.registerTool({
          name: 'close_app',
          description: 'Close an application by package name.',
          parameters: { type: 'object', properties: {} },
          execute: originalClose,
        });
      }
    });
  });

  describe('SafetyGuard & Elevated Command Protection', () => {
    test('blocks destructive shell commands in StepExecutor', async () => {
      const stepRecord = await StepExecutor.executeStep({
        id: 'step_destructive',
        toolName: 'execute_elevated_shell',
        parameters: { command: 'rm -rf /data/data' },
        description: 'Dangerous action',
      });

      expect(stepRecord.success).toBe(false);
      expect(stepRecord.error).toContain('Safety Shield blocked');
      expect(RootControlModule.getExecutedCommands().length).toBe(0);
    });

    test('blocks factory reset keywords', () => {
      const check = SafetyGuard.isActionSafe('execute_elevated_shell', { command: 'am broadcast -a android.intent.action.FACTORY_RESET' });
      expect(check.safe).toBe(false);
      expect(check.reason).toContain('Safety Shield');
    });
  });

  describe('Agent End-to-End Elevated Fast-Path Goals', () => {
    beforeEach(() => {
      RootControlModule.setMockStatus({
        shizukuAvailable: true,
        shizukuPermission: true,
      });
    });

    test('handles silent kill / force stop goal end-to-end', async () => {
      const agent = new FridayAgent();
      const response = await agent.executeGoal('force stop com.google.android.youtube');

      expect(response.toLowerCase()).toContain('boss');
      expect(response.toLowerCase()).toContain('stopped');
      expect(useAgentStore.getState().state).toBe('SUCCESS');
      expect(RootControlModule.getExecutedCommands()).toContain('am force-stop com.google.android.youtube');
    });

    test('handles check root / elevated status goal end-to-end', async () => {
      const agent = new FridayAgent();
      const response = await agent.executeGoal('check root status');

      expect(response.toLowerCase()).toContain('boss');
      expect(response.toLowerCase()).toContain('shizuku');
      expect(useAgentStore.getState().state).toBe('SUCCESS');
    });
  });
});
