import { ToolDefinition } from './types';
import { SystemControlModule } from '../native/SystemControlModule';

export const launchAppTool: ToolDefinition = {
  name: 'launch_app',
  description: 'Launches an installed Android application by package name or common app name (e.g. YouTube, WhatsApp, Maps).',
  parameters: {
    type: 'object',
    properties: {
      packageNameOrName: {
        type: 'string',
        description: 'Android package name (e.g. com.google.android.youtube) or app name (e.g. YouTube)',
      },
    },
    required: ['packageNameOrName'],
  },
  execute: async ({ packageNameOrName }) => {
    const startTime = Date.now();
    const pkgMap: Record<string, string> = {
      youtube: 'com.google.android.youtube',
      whatsapp: 'com.whatsapp',
      chrome: 'com.android.chrome',
      maps: 'com.google.android.apps.maps',
      spotify: 'com.spotify.music',
      clock: 'com.google.android.deskclock',
      settings: 'com.android.settings',
    };

    const targetPkg = pkgMap[packageNameOrName.toLowerCase()] || packageNameOrName;
    const ok = await SystemControlModule.launchApp(targetPkg);
    return {
      success: ok,
      data: { launchedPackage: targetPkg },
      durationMs: Date.now() - startTime,
    };
  },
};

export const openUrlTool: ToolDefinition = {
  name: 'open_url',
  description: 'Opens a web URL or deep link in the default browser.',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Web URL or intent deep link (e.g. https://google.com)' },
    },
    required: ['url'],
  },
  execute: async ({ url }) => {
    const startTime = Date.now();
    const ok = await SystemControlModule.openUrl(url);
    return { success: ok, data: { url }, durationMs: Date.now() - startTime };
  },
};
