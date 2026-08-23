import { ToolDefinition } from './types';
import { SystemControlModule } from '../native/SystemControlModule';

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
  execute: async ({ url }: { url: string }) => {
    const startTime = Date.now();
    const ok = await SystemControlModule.openUrl(url);
    return { success: ok, data: { url }, durationMs: Date.now() - startTime };
  },
};

export const closeAppTool: ToolDefinition = {
  name: 'close_app',
  description: 'Closes and dismisses a specific running application by name (e.g. YouTube, WhatsApp, Instagram).',
  parameters: {
    type: 'object',
    properties: {
      appName: { type: 'string', description: 'Name of the app to close' },
    },
    required: ['appName'],
  },
  execute: async ({ appName }: { appName: string }) => {
    const { AccessibilityModule } = await import('../native/AccessibilityModule');
    const ok = await AccessibilityModule.closeSpecificApp(appName);
    return {
      success: ok,
      data: {
        appName,
        summary: `Closed ${appName} for you, Boss.`,
      },
    };
  },
};

export const closeCurrentAppTool: ToolDefinition = {
  name: 'close_current_app',
  description: 'Closes and exits the currently active foreground application and returns to home screen.',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const { AccessibilityModule } = await import('../native/AccessibilityModule');
    const ok = await AccessibilityModule.closeCurrentApp();
    return {
      success: ok,
      data: {
        summary: 'Closed the current application for you, Boss.',
      },
    };
  },
};
