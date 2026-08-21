import { ToolDefinition } from './types';
import { SystemControlModule } from '../native/SystemControlModule';

export const getBatteryStatusTool: ToolDefinition = {
  name: 'get_battery_status',
  description: 'Retrieves current battery level percentage and charging status.',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const status = await SystemControlModule.getBatteryStatus();
    return { success: true, data: status };
  },
};

export const setVolumeTool: ToolDefinition = {
  name: 'set_volume',
  description: 'Adjusts system media, alarm, or ring volume (0 to 100).',
  parameters: {
    type: 'object',
    properties: {
      streamType: { type: 'string', enum: ['MEDIA', 'ALARM', 'RING'], description: 'Audio stream type' },
      percentage: { type: 'number', description: 'Volume level 0 to 100' },
    },
    required: ['streamType', 'percentage'],
  },
  execute: async ({ streamType, percentage }) => {
    const ok = await SystemControlModule.setVolume(streamType, percentage);
    return { success: ok, data: { streamType, percentage } };
  },
};

export const setBrightnessTool: ToolDefinition = {
  name: 'set_brightness',
  description: 'Adjusts screen brightness percentage (0 to 100).',
  parameters: {
    type: 'object',
    properties: {
      percentage: { type: 'number', description: 'Brightness level 0 to 100' },
    },
    required: ['percentage'],
  },
  execute: async ({ percentage }) => {
    const ok = await SystemControlModule.setBrightness(percentage);
    return { success: ok, data: { percentage } };
  },
};

export const setFlashlightTool: ToolDefinition = {
  name: 'set_flashlight',
  description: 'Turns device flashlight on or off.',
  parameters: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', description: 'True to turn on, False to turn off' },
    },
    required: ['enabled'],
  },
  execute: async ({ enabled }) => {
    const ok = await SystemControlModule.setFlashlight(enabled);
    return { success: ok, data: { enabled } };
  },
};
