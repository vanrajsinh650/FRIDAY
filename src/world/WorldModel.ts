import { WorldState, PrivilegeLevel } from './types';
import { SystemControlModule } from '../native/SystemControlModule';
import { AccessibilityModule } from '../native/AccessibilityModule';
import { RootControlModule } from '../native/RootControlModule';
import { scheduler } from '../agent/proactive/scheduler';
import { useVoiceStore } from '../state/voiceStore';

export class WorldModel {
  private static cachedState: WorldState | null = null;
  private static lastSnapshotTime = 0;
  private static readonly CACHE_TTL_MS = 800; // 800ms fresh snapshot window

  static async snapshot(forceFresh = false): Promise<WorldState> {
    const now = Date.now();
    if (!forceFresh && this.cachedState && (now - this.lastSnapshotTime < this.CACHE_TTL_MS)) {
      return this.cachedState;
    }

    // 1. Gather in parallel from device native layers
    const [
      battery,
      stats,
      isAccessEnabled,
      isDefaultLauncher,
      screenTree,
      rootAvailable,
      shizukuAvailable,
      notifications,
    ] = await Promise.all([
      SystemControlModule.getBatteryStatus().catch(() => ({ level: 100, isCharging: false })),
      SystemControlModule.getDeviceStats().catch(() => null),
      AccessibilityModule.isServiceEnabled().catch(() => false),
      SystemControlModule.isDefaultLauncher().catch(() => false),
      AccessibilityModule.inspectScreen().catch(() => null),
      RootControlModule.isRootAvailable().catch(() => false),
      RootControlModule.isShizukuAvailable().catch(() => false),
      SystemControlModule.getActiveNotifications().catch(() => []),
    ]);

    // 2. Evaluate Screen & Accessibility
    const activePackage = screenTree?.activePackage || 'com.friday';
    const surfaceCategory = this.classifySurface(activePackage);
    const interactiveCount = screenTree?.nodes?.filter((n) => n.isClickable || n.isEditable).length || 0;
    const scrollableCount = screenTree?.nodes?.filter((n) => n.isScrollable).length || 0;

    // 3. Evaluate Privilege Level
    let privilegeLevel: PrivilegeLevel = 'NORMAL';
    if (rootAvailable) {
      privilegeLevel = 'ROOT';
    } else if (shizukuAvailable) {
      privilegeLevel = 'DEVICE_OWNER';
    } else if (isAccessEnabled) {
      privilegeLevel = 'ACCESSIBILITY';
    }

    // 4. Evaluate Calendar & Time
    const dateObj = new Date();
    const activeTasks = scheduler.listTasks(true);
    const upcoming = activeTasks.map((t) => {
      const timeStr = t.targetTimestamp > 0
        ? new Date(t.targetTimestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        : t.recurringCron || 'Recurring';
      return `"${t.title}" (${timeStr})`;
    });

    const isSpeaking = useVoiceStore.getState().isSpeaking;
    const isMicActive = useVoiceStore.getState().isAssistantEnabled;

    const recentNotifs = Array.isArray(notifications) ? notifications : [];

    const state: WorldState = {
      device: {
        batteryLevel: battery.level,
        isCharging: battery.isCharging,
        batteryHealth: ('batteryHealth' in battery ? battery.batteryHealth : 'GOOD') || 'GOOD',
        volume: {
          media: 70,
          alarm: 80,
          ring: 80,
        },
        brightness: 65,
        isTorchOn: false,
        storage: {
          freeBytes: (stats?.freeStorageGb || 32) * 1e9,
          totalBytes: (stats?.totalStorageGb || 128) * 1e9,
          usedPercentage: stats ? Math.round(((stats.totalStorageGb - stats.freeStorageGb) / (stats.totalStorageGb || 1)) * 100) : 75,
        },
        ram: {
          freeMb: stats?.availRamMb || 2048,
          totalMb: stats?.totalRamMb || 8192,
        },
      },
      foreground: {
        packageName: activePackage,
        activityName: screenTree?.activeActivity,
        surfaceCategory,
        windowTitle: undefined,
      },
      screen: {
        isScreenOn: true,
        isLocked: activePackage.includes('keyguard') || activePackage.includes('lockscreen'),
        orientation: 'PORTRAIT',
        focusedElementText: undefined,
        interactiveElementsCount: interactiveCount,
        scrollableElementsCount: scrollableCount,
        treeSummary: screenTree?.nodes?.slice(0, 10).map((e: any) => `[${e.className || 'node'}: "${e.text || e.contentDescription || ''}"]`).join(' ') || 'No interactive elements detected',
      },
      audio: {
        isMediaPlaying: false,
        isMicActive,
        isFridaySpeaking: isSpeaking,
      },
      notifications: {
        activeCount: recentNotifs.length,
        recentNotifications: recentNotifs.slice(0, 5).map((n: any, idx: number) => ({
          id: String(n.id || idx),
          packageName: n.packageName || 'unknown',
          appName: n.packageName,
          title: n.title || '',
          text: n.text || '',
          postTime: Date.now(),
          category: undefined,
        })),
      },
      network: {
        isConnected: true,
        type: 'WIFI',
        isInternetReachable: true,
      },
      location: {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
        locale: 'en-IN',
      },
      calendar: {
        currentTime: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        currentDate: dateObj.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
        dayOfWeek: dateObj.toLocaleDateString([], { weekday: 'long' }),
        activeRemindersCount: activeTasks.length,
        upcomingReminders: upcoming,
      },
      permissions: {
        accessibilityGranted: isAccessEnabled,
        notificationListenerGranted: recentNotifs.length > 0,
        overlayGranted: true,
        audioRecordGranted: true,
        installPackagesGranted: true,
        isDefaultLauncher,
        isDefaultAssistant: false,
      },
      privilegeLevel,
      timestamp: now,
    };

    this.cachedState = state;
    this.lastSnapshotTime = now;
    return state;
  }

  static formatForPrompt(world: WorldState): string {
    const lines: string[] = [
      '### [LIVE ANDROID ENVIRONMENT & WORLD STATE]',
      `- **Time & Date**: ${world.calendar.currentTime}, ${world.calendar.currentDate} (${world.calendar.dayOfWeek}) [Timezone: ${world.location.timezone}]`,
      `- **Device Hardware**: Battery ${world.device.batteryLevel}% ${world.device.isCharging ? '(Charging ⚡)' : ''}, Media Vol ${world.device.volume.media}%, Brightness ${world.device.brightness}%, Free Storage ${(world.device.storage.freeBytes / 1e9).toFixed(1)} GB / Free RAM ${world.device.ram.freeMb} MB`,
      `- **Foreground Surface**: \`${world.foreground.packageName}\` (${world.foreground.surfaceCategory}) ${world.foreground.windowTitle ? `"${world.foreground.windowTitle}"` : ''}`,
      `- **Screen Perception**: ${world.screen.interactiveElementsCount} interactive UI elements, ${world.screen.scrollableElementsCount} scrollable surfaces`,
      `- **Active Notifications**: ${world.notifications.activeCount > 0 ? world.notifications.recentNotifications.map((n) => `[${n.packageName}: "${n.title}" - ${n.text}]`).join('; ') : 'None'}`,
      `- **Scheduled Tasks**: ${world.calendar.activeRemindersCount > 0 ? world.calendar.upcomingReminders.join(', ') : 'None'}`,
      `- **System Privilege**: ${world.privilegeLevel} (Accessibility: ${world.permissions.accessibilityGranted ? 'ENABLED' : 'DISABLED'}, Default Home: ${world.permissions.isDefaultLauncher ? 'YES' : 'NO'})`,
    ];
    return lines.join('\n');
  }

  static classifySurface(packageName: string): 'SYSTEM_UI' | 'LAUNCHER' | 'APP' | 'SETTINGS' | 'KEYGUARD' | 'OVERLAY' | 'UNKNOWN' {
    const lower = (packageName || '').toLowerCase();
    if (!lower || lower === 'unknown') return 'UNKNOWN';
    if (lower.includes('launcher') || lower.includes('home') || lower === 'com.friday') return 'LAUNCHER';
    if (lower.includes('systemui') || lower.includes('system.ui')) return 'SYSTEM_UI';
    if (lower.includes('keyguard') || lower.includes('lockscreen')) return 'KEYGUARD';
    if (lower.includes('setting')) return 'SETTINGS';
    return 'APP';
  }
}
