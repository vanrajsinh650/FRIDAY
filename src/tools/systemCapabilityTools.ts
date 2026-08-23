import { ToolDefinition } from './types';
import { SystemCapabilityModule } from '../native/SystemCapabilityModule';

export const toggleWifiTool: ToolDefinition = {
  name: 'toggle_wifi',
  description: 'Enables or disables Wi-Fi, or opens the Wi-Fi quick control panel if restricted by modern Android in normal app mode.',
  parameters: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', description: 'True to turn on Wi-Fi, False to turn off' },
    },
    required: ['enabled'],
  },
  execute: async ({ enabled }) => {
    const res = await SystemCapabilityModule.toggleWifi(enabled);
    let summary = '';
    if (res.directToggle && res.success) {
      summary = `Wi-Fi is now turned ${enabled ? 'on' : 'off'}.`;
    } else {
      summary = enabled
        ? 'Opened the Wi-Fi settings panel for you.'
        : 'Opened the Wi-Fi panel where you can turn off Wi-Fi.';
    }
    return {
      success: res.success,
      data: {
        ...res,
        targetState: enabled,
        summary,
      },
    };
  },
};

export const getWifiStatusTool: ToolDefinition = {
  name: 'get_wifi_status',
  description: 'Gets current Wi-Fi state (enabled, connected, SSID).',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const state = await SystemCapabilityModule.getWifiState();
    const summary = state.connected
      ? `Wi-Fi is connected to "${state.ssid}".`
      : state.enabled
      ? 'Wi-Fi is on, but not currently connected to any network.'
      : 'Wi-Fi is currently turned off.';
    return {
      success: true,
      data: { ...state, summary },
    };
  },
};

export const toggleBluetoothTool: ToolDefinition = {
  name: 'toggle_bluetooth',
  description: 'Enables or disables Bluetooth, or opens the Bluetooth quick panel if restricted by modern Android in normal app mode.',
  parameters: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', description: 'True to turn on Bluetooth, False to turn off' },
    },
    required: ['enabled'],
  },
  execute: async ({ enabled }) => {
    const res = await SystemCapabilityModule.toggleBluetooth(enabled);
    let summary = '';
    if (res.directToggle && res.success) {
      summary = `Bluetooth is now turned ${enabled ? 'on' : 'off'}.`;
    } else {
      summary = enabled
        ? 'Opened the prompt to enable Bluetooth.'
        : 'Opened the Bluetooth settings panel.';
    }
    return {
      success: res.success,
      data: {
        ...res,
        targetState: enabled,
        summary,
      },
    };
  },
};

export const getBluetoothStatusTool: ToolDefinition = {
  name: 'get_bluetooth_status',
  description: 'Gets current Bluetooth state.',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const state = await SystemCapabilityModule.getBluetoothState();
    const summary = state.enabled ? 'Bluetooth is enabled.' : 'Bluetooth is currently turned off.';
    return {
      success: true,
      data: { ...state, summary },
    };
  },
};

export const toggleHotspotTool: ToolDefinition = {
  name: 'toggle_hotspot',
  description: 'Opens the Hotspot / Tethering configuration panel.',
  parameters: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', description: 'Target state for hotspot' },
    },
    required: ['enabled'],
  },
  execute: async ({ enabled }) => {
    const res = await SystemCapabilityModule.toggleHotspot(enabled);
    return {
      success: res.success,
      data: {
        ...res,
        summary: 'Hotspot and tethering settings opened.',
      },
    };
  },
};

export const getDeviceCapabilitiesTool: ToolDefinition = {
  name: 'get_device_capabilities',
  description: 'Returns the live runtime hardware and permission capabilities of this Android device.',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const caps = await SystemCapabilityModule.getCapabilities();
    return {
      success: true,
      data: {
        capabilities: caps,
        summary: `Device running Android API ${caps.androidApiLevel}. Accessibility is ${caps.accessibility ? 'active' : 'inactive'}. Device Owner is ${caps.deviceOwner ? 'active' : 'inactive'}.`,
      },
    };
  },
};
