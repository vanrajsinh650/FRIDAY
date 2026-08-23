import { NativeModules } from 'react-native';

const { FridaySystemCapabilityNative } = NativeModules;

export interface DeviceCapabilities {
  wifi: { read: boolean; directToggle: boolean; settingsPanel: boolean; deviceOwnerExempt?: boolean };
  bluetooth: { read: boolean; directToggle: boolean; settingsPanel: boolean; deviceOwnerExempt?: boolean };
  hotspot: { read: boolean; directToggle: boolean; settingsPanel: boolean };
  accessibility: boolean;
  deviceOwner: boolean;
  flashlight: boolean;
  volume: boolean;
  brightness: boolean;
  androidApiLevel: number;
}

export class SystemCapabilityModule {
  static async getCapabilities(): Promise<DeviceCapabilities> {
    if (FridaySystemCapabilityNative?.getCapabilities) {
      try {
        return await FridaySystemCapabilityNative.getCapabilities();
      } catch (_e) {}
    }
    return {
      wifi: { read: true, directToggle: false, settingsPanel: true },
      bluetooth: { read: true, directToggle: false, settingsPanel: true },
      hotspot: { read: true, directToggle: false, settingsPanel: true },
      accessibility: true,
      deviceOwner: false,
      flashlight: true,
      volume: true,
      brightness: true,
      androidApiLevel: 30,
    };
  }

  static async getWifiState(): Promise<{ enabled: boolean; connected: boolean; ssid: string }> {
    if (FridaySystemCapabilityNative?.getWifiState) {
      try {
        return await FridaySystemCapabilityNative.getWifiState();
      } catch (_e) {}
    }
    return { enabled: true, connected: true, ssid: 'FRIDAY-WIFI' };
  }

  static async toggleWifi(enable: boolean): Promise<{ success: boolean; method: string; directToggle: boolean; message?: string }> {
    if (FridaySystemCapabilityNative?.toggleWifi) {
      try {
        return await FridaySystemCapabilityNative.toggleWifi(enable);
      } catch (e: any) {
        return { success: false, method: 'error', directToggle: false, message: e.message };
      }
    }
    return { success: true, method: 'mock', directToggle: true };
  }

  static async getBluetoothState(): Promise<{ enabled: boolean; supported: boolean }> {
    if (FridaySystemCapabilityNative?.getBluetoothState) {
      try {
        return await FridaySystemCapabilityNative.getBluetoothState();
      } catch (_e) {}
    }
    return { enabled: true, supported: true };
  }

  static async toggleBluetooth(enable: boolean): Promise<{ success: boolean; method: string; directToggle: boolean; message?: string }> {
    if (FridaySystemCapabilityNative?.toggleBluetooth) {
      try {
        return await FridaySystemCapabilityNative.toggleBluetooth(enable);
      } catch (e: any) {
        return { success: false, method: 'error', directToggle: false, message: e.message };
      }
    }
    return { success: true, method: 'mock', directToggle: true };
  }

  static async toggleHotspot(enable: boolean): Promise<{ success: boolean; method: string; directToggle: boolean; message?: string }> {
    if (FridaySystemCapabilityNative?.toggleHotspot) {
      try {
        return await FridaySystemCapabilityNative.toggleHotspot(enable);
      } catch (e: any) {
        return { success: false, method: 'error', directToggle: false, message: e.message };
      }
    }
    return { success: true, method: 'settings_panel', directToggle: false };
  }
}
