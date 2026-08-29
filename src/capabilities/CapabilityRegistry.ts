import { Capability, CapabilityCategory, CapabilityStatus, CapabilitySnapshot } from './types';
import { WorldState } from '../world/types';
import { SystemControlModule } from '../native/SystemControlModule';
import { AccessibilityModule } from '../native/AccessibilityModule';
import { RootControlModule } from '../native/RootControlModule';
import { VisionPerception } from '../agent/perception/visionPerception';
import { scheduler } from '../agent/proactive/scheduler';
import { LifelongMemoryEngine } from '../memory/lifelong/LifelongMemoryEngine';

export class CapabilityRegistry {
  private static capabilities: Map<string, Capability> = new Map();

  static initialize(): void {
    if (this.capabilities.size > 0) return;

    // 1. OBSERVATION
    this.register({
      id: 'observe_device',
      name: 'observe_device',
      description: 'Observe real-time Android device hardware state including battery, volume, storage, memory, and connectivity.',
      category: 'OBSERVATION',
      status: 'AVAILABLE',
      riskLevel: 'LOW',
      parametersSchema: {},
      execute: async () => {
        const [battery, stats] = await Promise.all([
          SystemControlModule.getBatteryStatus().catch(() => ({ level: 100, isCharging: false })),
          SystemControlModule.getDeviceStats().catch(() => null),
        ]);
        return { battery, stats };
      },
    });

    this.register({
      id: 'observe_screen',
      name: 'observe_screen',
      description: 'Inspect the current screen UI tree, active package, focused elements, and interactive surfaces.',
      category: 'OBSERVATION',
      status: 'AVAILABLE',
      riskLevel: 'LOW',
      parametersSchema: {},
      execute: async () => {
        return await AccessibilityModule.inspectScreen();
      },
    });

    this.register({
      id: 'observe_notifications',
      name: 'observe_notifications',
      description: 'Read active system and application notifications currently posted on the phone.',
      category: 'OBSERVATION',
      status: 'AVAILABLE',
      riskLevel: 'LOW',
      parametersSchema: {},
      execute: async () => {
        return await SystemControlModule.getActiveNotifications();
      },
    });

    // 2. INTERACTION & NAVIGATION
    this.register({
      id: 'launch_surface',
      name: 'launch_surface',
      description: 'Launch any installed application by package name or search query, or open a deep link URL.',
      category: 'INTERACTION',
      status: 'AVAILABLE',
      riskLevel: 'LOW',
      parametersSchema: {
        target: { type: 'string', description: 'Application name, package name, or URL to open' },
      },
      execute: async (params: { target: string }) => {
        if (/^https?:\/\//i.test(params.target)) {
          return await SystemControlModule.openUrl(params.target);
        }
        return await SystemControlModule.launchApp(params.target);
      },
    });

    this.register({
      id: 'click_target',
      name: 'click_target',
      description: 'Click an interactive UI element by text, query, viewId, or coordinate on the active surface.',
      category: 'INTERACTION',
      status: 'AVAILABLE',
      riskLevel: 'LOW',
      parametersSchema: {
        query: { type: 'string', description: 'Text, label, or description of target element' },
        x: { type: 'number', description: 'Optional X coordinate' },
        y: { type: 'number', description: 'Optional Y coordinate' },
      },
      execute: async (params: { query?: string; x?: number; y?: number }) => {
        if (params.x !== undefined && params.y !== undefined) {
          return await AccessibilityModule.clickCoordinates(params.x, params.y);
        }
        if (params.query) {
          const success = await AccessibilityModule.clickText(params.query);
          if (!success) {
            return await VisionPerception.executeVisualTap(params.query);
          }
          return success;
        }
        return false;
      },
    });

    this.register({
      id: 'type_text',
      name: 'type_text',
      description: 'Type text into the currently active or focused input field.',
      category: 'INTERACTION',
      status: 'AVAILABLE',
      riskLevel: 'LOW',
      parametersSchema: {
        text: { type: 'string', description: 'The text string to type' },
      },
      execute: async (params: { text: string }) => {
        return await AccessibilityModule.typeText(params.text);
      },
    });

    this.register({
      id: 'scroll_surface',
      name: 'scroll_surface',
      description: 'Scroll the active screen surface UP or DOWN.',
      category: 'INTERACTION',
      status: 'AVAILABLE',
      riskLevel: 'LOW',
      parametersSchema: {
        direction: { type: 'string', enum: ['UP', 'DOWN', 'LEFT', 'RIGHT'] },
      },
      execute: async (params: { direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' }) => {
        const dir = (params.direction || 'DOWN').toUpperCase() as 'UP' | 'DOWN';
        return await AccessibilityModule.scroll(dir);
      },
    });

    this.register({
      id: 'perform_global_action',
      name: 'perform_global_action',
      description: 'Execute system navigation gesture: BACK, HOME, RECENTS, NOTIFICATIONS, TAKE_SCREENSHOT, LOCK_SCREEN.',
      category: 'INTERACTION',
      status: 'AVAILABLE',
      riskLevel: 'LOW',
      parametersSchema: {
        action: { type: 'string', enum: ['BACK', 'HOME', 'RECENTS', 'NOTIFICATIONS', 'QUICK_SETTINGS', 'TAKE_SCREENSHOT', 'LOCK_SCREEN'] },
      },
      execute: async (params: { action: any }) => {
        return await AccessibilityModule.performGlobalAction(params.action);
      },
    });

    // 3. SYSTEM & HARDWARE CONTROL
    this.register({
      id: 'set_device_setting',
      name: 'set_device_setting',
      description: 'Control system hardware settings: volume, brightness, torch/flashlight.',
      category: 'SYSTEM',
      status: 'AVAILABLE',
      riskLevel: 'LOW',
      parametersSchema: {
        setting: { type: 'string', enum: ['VOLUME', 'BRIGHTNESS', 'TORCH'] },
        value: { type: 'any', description: 'Percentage (0-100) or boolean (true/false)' },
      },
      execute: async (params: { setting: string; value: any }) => {
        const s = params.setting.toUpperCase();
        if (s === 'VOLUME') {
          return await SystemControlModule.setVolume('MEDIA', Number(params.value));
        } else if (s === 'BRIGHTNESS') {
          return await SystemControlModule.setBrightness(Number(params.value));
        } else if (s === 'TORCH' || s === 'FLASHLIGHT') {
          return await SystemControlModule.setFlashlight(Boolean(params.value));
        }
        return false;
      },
    });

    // 4. SCHEDULING & REMINDERS
    this.register({
      id: 'schedule_task',
      name: 'schedule_task',
      description: 'Schedule a proactive reminder or alarm for a specific time or recurring cron interval.',
      category: 'SCHEDULING',
      status: 'AVAILABLE',
      riskLevel: 'LOW',
      parametersSchema: {
        title: { type: 'string', description: 'Reminder description' },
        targetTimestamp: { type: 'number', description: 'Epoch ms timestamp' },
        recurringCron: { type: 'string', description: 'Optional cron pattern' },
      },
      execute: async (params: { title: string; targetTimestamp?: number; recurringCron?: string }) => {
        const task = await scheduler.scheduleOneShotAlarm(
          params.title,
          params.targetTimestamp || (Date.now() + 60000),
          { prompt: params.title }
        );
        return { scheduled: true, taskId: task.id, title: task.title };
      },
    });

    this.register({
      id: 'list_scheduled_tasks',
      name: 'list_scheduled_tasks',
      description: 'List all active scheduled reminders and alarms.',
      category: 'SCHEDULING',
      status: 'AVAILABLE',
      riskLevel: 'LOW',
      parametersSchema: {},
      execute: async () => {
        return scheduler.listTasks(true);
      },
    });

    // 5. COGNITION & MEMORY
    this.register({
      id: 'remember_fact',
      name: 'remember_fact',
      description: 'Store a permanent personal fact, preference, or habit about the user into lifelong memory.',
      category: 'COGNITION',
      status: 'AVAILABLE',
      riskLevel: 'LOW',
      parametersSchema: {
        fact: { type: 'string', description: 'The personal fact or preference to remember' },
      },
      execute: async (params: { fact: string }) => {
        await LifelongMemoryEngine.getInstance().processConversationalTurn(
          `Remember: ${params.fact}`,
          `I will remember that: ${params.fact}`
        );
        return { remembered: true, fact: params.fact };
      },
    });

    // 6. PRIVILEGED SHELL
    this.register({
      id: 'execute_elevated_command',
      name: 'execute_elevated_command',
      description: 'Execute elevated shell command via Shizuku or Root if available.',
      category: 'PRIVILEGED',
      status: 'AVAILABLE',
      riskLevel: 'HIGH',
      parametersSchema: {
        command: { type: 'string', description: 'Shell command string' },
      },
      execute: async (params: { command: string }) => {
        return await RootControlModule.executeElevatedShell(params.command);
      },
    });

    // 7. GOAL COMPLETION & SPEECH
    this.register({
      id: 'complete_goal',
      name: 'complete_goal',
      description: 'Signal that the requested user outcome has been achieved, and provide the concise spoken response.',
      category: 'COGNITION',
      status: 'AVAILABLE',
      riskLevel: 'LOW',
      parametersSchema: {
        spokenResponse: { type: 'string', description: 'Natural, concise spoken reply to the user' },
      },
      execute: async (params: { spokenResponse: string }) => {
        return { completed: true, spokenResponse: params.spokenResponse };
      },
    });
  }

  static register(capability: Capability): void {
    this.capabilities.set(capability.id, capability);
  }

  static get(id: string): Capability | undefined {
    this.initialize();
    return this.capabilities.get(id);
  }

  static discover(worldState: WorldState): CapabilitySnapshot {
    this.initialize();

    const available: Capability[] = [];
    let unavailableCount = 0;

    for (const cap of this.capabilities.values()) {
      let isAvailable = true;

      if (cap.category === 'INTERACTION' && !worldState.permissions.accessibilityGranted) {
        // Some interactions require accessibility
        if (cap.id === 'click_target' || cap.id === 'type_text' || cap.id === 'scroll_surface') {
          cap.status = 'PERMISSION_REQUIRED';
          cap.requiredPermission = 'Accessibility';
          isAvailable = false;
        }
      }

      if (cap.category === 'PRIVILEGED') {
        if (worldState.privilegeLevel !== 'ROOT' && worldState.privilegeLevel !== 'DEVICE_OWNER') {
          cap.status = 'UNAVAILABLE';
          isAvailable = false;
        }
      }

      if (isAvailable) {
        cap.status = 'AVAILABLE';
        available.push(cap);
      } else {
        unavailableCount++;
      }
    }

    return {
      timestamp: Date.now(),
      availableCapabilities: available,
      unavailableCount,
      highestPrivilege: worldState.privilegeLevel,
    };
  }

  static formatCapabilitiesForPrompt(snapshot: CapabilitySnapshot): string {
    const list = snapshot.availableCapabilities.map((c) => {
      const paramStr = Object.keys(c.parametersSchema).length > 0
        ? `(${Object.keys(c.parametersSchema).join(', ')})`
        : '()';
      return `- \`${c.name}${paramStr}\`: ${c.description}`;
    });

    return [
      '### [AVAILABLE GENERAL CAPABILITIES ON THIS DEVICE]',
      ...list,
    ].join('\n');
  }
}
