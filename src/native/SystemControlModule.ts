import { NativeModules } from 'react-native';
import { BatteryStatus, InstalledApp } from './types';

const { FridaySystemControlNative } = NativeModules;

export class SystemControlModule {
  static async launchApp(packageName: string): Promise<boolean> {
    if (FridaySystemControlNative?.launchApp) {
      return await FridaySystemControlNative.launchApp(packageName);
    }
    return true;
  }

  static async openUrl(url: string): Promise<boolean> {
    if (FridaySystemControlNative?.openUrl) {
      return await FridaySystemControlNative.openUrl(url);
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

  static async setFlashlight(enabled: boolean): Promise<boolean> {
    if (FridaySystemControlNative?.setFlashlight) {
      return await FridaySystemControlNative.setFlashlight(enabled);
    }
    return true;
  }

  static async getInstalledApps(): Promise<InstalledApp[]> {
    if (FridaySystemControlNative?.getInstalledApps) {
      return await FridaySystemControlNative.getInstalledApps();
    }
    return [
      { appName: 'YouTube', packageName: 'com.google.android.youtube' },
      { appName: 'WhatsApp', packageName: 'com.whatsapp' },
      { appName: 'Chrome', packageName: 'com.android.chrome' },
      { appName: 'Maps', packageName: 'com.google.android.apps.maps' },
      { appName: 'Clock', packageName: 'com.google.android.deskclock' },
      { appName: 'Spotify', packageName: 'com.spotify.music' },
      { appName: 'Settings', packageName: 'com.android.settings' },
      { appName: 'Gmail', packageName: 'com.google.android.gm' },
    ];
  }
}
