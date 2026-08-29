import { NativeModules } from 'react-native';
import { BatteryStatus, InstalledApp } from './types';

const { FridaySystemControlNative } = NativeModules;

export class SystemControlModule {
  static async launchApp(packageName: string): Promise<boolean> {
    if (FridaySystemControlNative?.launchApp) {
      return await FridaySystemControlNative.launchApp(packageName);
    }
    const { AccessibilityModule } = await import('./AccessibilityModule');
    AccessibilityModule.setMockPackage(packageName);
    return true;
  }

  static async openUrl(url: string): Promise<boolean> {
    if (FridaySystemControlNative?.openUrl) {
      return await FridaySystemControlNative.openUrl(url);
    }
    return true;
  }

  static async exitApplication(): Promise<boolean> {
    if (FridaySystemControlNative?.exitApp) {
      return await FridaySystemControlNative.exitApp();
    }
    return true;
  }

  static async openAppSettings(packageName: string): Promise<boolean> {
    if (FridaySystemControlNative?.openAppSettings) {
      return await FridaySystemControlNative.openAppSettings(packageName);
    }
    return true;
  }

  static async uninstallApp(packageName: string): Promise<boolean> {
    if (FridaySystemControlNative?.uninstallApp) {
      return await FridaySystemControlNative.uninstallApp(packageName);
    }
    return true;
  }

  static async getBatteryStatus(): Promise<BatteryStatus> {
    if (FridaySystemControlNative?.getBatteryStatus) {
      return await FridaySystemControlNative.getBatteryStatus();
    }
    return { level: 85, isCharging: false, batteryHealth: 'GOOD' };
  }

  static async setVolume(streamType: 'MEDIA' | 'ALARM' | 'RING', percentage: number): Promise<boolean> {
    if (FridaySystemControlNative?.setVolume) {
      return await FridaySystemControlNative.setVolume(streamType, percentage);
    }
    return true;
  }

  static async setBrightness(percentage: number): Promise<boolean> {
    if (FridaySystemControlNative?.setBrightness) {
      return await FridaySystemControlNative.setBrightness(percentage);
    }
    return true;
  }

  static async setRingerMode(mode: 'NORMAL' | 'SILENT' | 'VIBRATE'): Promise<boolean> {
    if (FridaySystemControlNative?.setRingerMode) {
      return await FridaySystemControlNative.setRingerMode(mode);
    }
    return true;
  }

  static async setFlashlight(enabled: boolean): Promise<boolean> {
    if (FridaySystemControlNative?.setFlashlight) {
      return await FridaySystemControlNative.setFlashlight(enabled);
    }
    return true;
  }

  static async isDefaultLauncher(): Promise<boolean> {
    if (FridaySystemControlNative?.isDefaultLauncher) {
      return await FridaySystemControlNative.isDefaultLauncher();
    }
    return false;
  }

  static async openDefaultLauncherSettings(): Promise<boolean> {
    if (FridaySystemControlNative?.openDefaultLauncherSettings) {
      return await FridaySystemControlNative.openDefaultLauncherSettings();
    }
    return true;
  }

  static async openDefaultAssistantSettings(): Promise<boolean> {
    if (FridaySystemControlNative?.openDefaultAssistantSettings) {
      return await FridaySystemControlNative.openDefaultAssistantSettings();
    }
    return true;
  }

  static async openAccessibilitySettings(): Promise<boolean> {
    if (FridaySystemControlNative?.openAccessibilitySettings) {
      return await FridaySystemControlNative.openAccessibilitySettings();
    }
    return true;
  }

  static async getDeviceStats(): Promise<import('./types').DeviceStats> {
    if (FridaySystemControlNative?.getDeviceStats) {
      return await FridaySystemControlNative.getDeviceStats();
    }
    return {
      batteryLevel: 85,
      isCharging: false,
      totalRamMb: 6144,
      availRamMb: 2450,
      totalStorageGb: 128,
      freeStorageGb: 64,
    };
  }

  static async getInstalledApps(): Promise<InstalledApp[]> {
    if (FridaySystemControlNative?.getInstalledApps) {
      return await FridaySystemControlNative.getInstalledApps();
    }
    return [];
  }

  static async getActiveNotifications(): Promise<Array<{ id: number; packageName: string; title: string; text: string; subText?: string }>> {
    if (FridaySystemControlNative?.getActiveNotifications) {
      try {
        const jsonStr = await FridaySystemControlNative.getActiveNotifications();
        return JSON.parse(jsonStr || '[]');
      } catch (_: any) {
        return [];
      }
    }
    return [];
  }

  static async openNotificationListenerSettings(): Promise<boolean> {
    if (FridaySystemControlNative?.openNotificationListenerSettings) {
      return await FridaySystemControlNative.openNotificationListenerSettings();
    }
    return true;
  }

  static async setAlarm(hour: number, minutes: number = 0, message: string = 'Alarm', skipUi: boolean = false): Promise<boolean> {
    if (FridaySystemControlNative?.setAlarm) {
      return await FridaySystemControlNative.setAlarm(hour, minutes, message, skipUi);
    }
    return true;
  }

  static async sendWhatsAppMessage(phoneOrName: string | null, message: string): Promise<boolean> {
    if (FridaySystemControlNative?.sendWhatsAppMessage) {
      return await FridaySystemControlNative.sendWhatsAppMessage(phoneOrName, message);
    }
    return true;
  }

  static async getNextAlarmClock(): Promise<{ hasAlarm: boolean; formattedTime: string; triggerTime?: number }> {
    if (FridaySystemControlNative?.getNextAlarmClock) {
      return await FridaySystemControlNative.getNextAlarmClock();
    }
    return { hasAlarm: false, formattedTime: 'None' };
  }

  static async showAlarms(): Promise<boolean> {
    if (FridaySystemControlNative?.showAlarms) {
      return await FridaySystemControlNative.showAlarms();
    }
    return true;
  }

  static async dismissAlarm(): Promise<boolean> {
    if (FridaySystemControlNative?.dismissAlarm) {
      return await FridaySystemControlNative.dismissAlarm();
    }
    return true;
  }

  static async makePhoneCall(phoneNumber: string): Promise<boolean> {
    if (FridaySystemControlNative?.makePhoneCall) {
      return await FridaySystemControlNative.makePhoneCall(phoneNumber);
    }
    return true;
  }

  static async sendSms(phoneNumber: string, message: string): Promise<boolean> {
    if (FridaySystemControlNative?.sendSms) {
      return await FridaySystemControlNative.sendSms(phoneNumber, message);
    }
    return true;
  }

  static async openCamera(): Promise<boolean> {
    if (FridaySystemControlNative?.openCamera) {
      return await FridaySystemControlNative.openCamera();
    }
    return true;
  }

  static async getCurrentTime(): Promise<{ time: string; date: string; timestamp: number }> {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    return { time, date, timestamp: now.getTime() };
  }

  static async saveMemoryFile(content: string): Promise<boolean> {
    if (FridaySystemControlNative?.saveMemoryFile) {
      try {
        return await FridaySystemControlNative.saveMemoryFile(content);
      } catch (_: any) {
        return false;
      }
    }
    return true;
  }

  static async loadMemoryFile(): Promise<string> {
    if (FridaySystemControlNative?.loadMemoryFile) {
      try {
        return await FridaySystemControlNative.loadMemoryFile();
      } catch (_: any) {
        return '';
      }
    }
    return '';
  }

  private static mockMediaPlaying = false;

  static setMockMediaPlaying(playing: boolean): void {
    SystemControlModule.mockMediaPlaying = playing;
  }

  static async isMediaPlaying(): Promise<boolean> {
    if (FridaySystemControlNative?.isMediaPlaying) {
      try {
        return await FridaySystemControlNative.isMediaPlaying();
      } catch (_: any) {
        return false;
      }
    }
    return SystemControlModule.mockMediaPlaying;
  }

  static async isCallActive(): Promise<boolean> {
    if (FridaySystemControlNative?.isCallActive) {
      try {
        return await FridaySystemControlNative.isCallActive();
      } catch (_: any) {
        return false;
      }
    }
    return false;
  }

  static async pauseMediaPlayback(): Promise<boolean> {
    if (FridaySystemControlNative?.pauseMediaPlayback) {
      try {
        return await FridaySystemControlNative.pauseMediaPlayback();
      } catch (_: any) {
        return false;
      }
    }
    return false;
  }

  static async requestIgnoreBatteryOptimizations(): Promise<boolean> {
    if (FridaySystemControlNative?.requestIgnoreBatteryOptimizations) {
      try {
        return await FridaySystemControlNative.requestIgnoreBatteryOptimizations();
      } catch (_: any) {
        return false;
      }
    }
    return false;
  }
}
