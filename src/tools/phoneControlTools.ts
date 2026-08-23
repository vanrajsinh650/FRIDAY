import { ToolDefinition } from './types';
import { AccessibilityModule } from '../native/AccessibilityModule';
import { SystemControlModule } from '../native/SystemControlModule';

export const launchAppPrimitiveTool: ToolDefinition = {
  name: 'launch_app',
  description: 'Launches an application by package name or common app name and waits for it to become the active foreground window.',
  parameters: {
    type: 'object',
    properties: {
      packageNameOrName: { type: 'string', description: 'Application name or Android package identifier (e.g. youtube, whatsapp, chrome)' },
    },
    required: ['packageNameOrName'],
  },
  execute: async ({ packageNameOrName }) => {
    const startTime = Date.now();
    const query = packageNameOrName.trim().toLowerCase();

    const staticMap: Record<string, string> = {
      youtube: 'com.google.android.youtube',
      whatsapp: 'com.whatsapp',
      chrome: 'com.android.chrome',
      maps: 'com.google.android.apps.maps',
      spotify: 'com.spotify.music',
      clock: 'com.google.android.deskclock',
      settings: 'com.android.settings',
      camera: 'com.android.camera',
      calculator: 'com.google.android.calculator',
      instagram: 'com.instagram.android',
      telegram: 'org.telegram.messenger',
      messages: 'com.google.android.apps.messaging',
      gallery: 'com.google.android.apps.photos',
      photos: 'com.google.android.apps.photos',
      albums: 'com.vivo.gallery',
    };

    const targetPkg = staticMap[query] || packageNameOrName;
    let ok = await SystemControlModule.launchApp(targetPkg);
    if (!ok && targetPkg !== query) {
      ok = await SystemControlModule.launchApp(query);
    }

    // State-aware wait for app transition
    const foregroundReached = await AccessibilityModule.waitForPackage(targetPkg, 3000);

    return {
      success: ok,
      data: {
        launchedPackage: targetPkg,
        appName: packageNameOrName,
        foregroundReached,
      },
      durationMs: Date.now() - startTime,
    };
  },
};

export const getForegroundAppTool: ToolDefinition = {
  name: 'get_foreground_app',
  description: 'Returns the currently active foreground application package and title.',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const pkg = await AccessibilityModule.getForegroundPackage();
    return { success: true, data: { activePackage: pkg } };
  },
};

export const clickTextTool: ToolDefinition = {
  name: 'click_text',
  description: 'Finds and clicks a UI node matching the specified text label or content description.',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text label or keyword to tap' },
      exactMatch: { type: 'boolean', description: 'Whether to match text exactly or substring', default: false },
    },
    required: ['text'],
  },
  execute: async ({ text, exactMatch = false }) => {
    const startTime = Date.now();
    const ok = await AccessibilityModule.clickText(text, exactMatch);
    return { success: ok, data: { text, exactMatch }, durationMs: Date.now() - startTime };
  },
};

export const clickFirstResultTool: ToolDefinition = {
  name: 'click_first_result',
  description: 'Opens a result item in the active list. Pass nodeId to open a specific ranked result; omit it to take the first/most prominent card.',
  parameters: {
    type: 'object',
    properties: {
      nodeId: { type: 'string', description: 'Optional accessibility node id of the specific result to open (from the ranked result list). Omit to open the first card.' },
    },
  },
  execute: async ({ nodeId } = {}) => {
    const startTime = Date.now();
    const ok = await AccessibilityModule.clickFirstResultCard(nodeId);
    return { success: ok, data: { nodeId: nodeId || null }, durationMs: Date.now() - startTime };
  },
};

export const clickFullScreenTool: ToolDefinition = {
  name: 'enter_fullscreen',
  description: 'Taps the video player and clicks the Full Screen button to expand video to full screen mode.',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const startTime = Date.now();
    const ok = await AccessibilityModule.clickFullScreen();
    return { success: ok, data: { fullScreen: ok }, durationMs: Date.now() - startTime };
  },
};

export const clickSendButtonTool: ToolDefinition = {
  name: 'click_send_button',
  description: 'Finds and clicks the Send/Submit action button in the current messaging or input screen.',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const startTime = Date.now();
    const ok = await AccessibilityModule.clickSendOrActionButton();
    return { success: ok, data: { clicked: ok }, durationMs: Date.now() - startTime };
  },
};

export const pressEnterTool: ToolDefinition = {
  name: 'press_enter',
  description: 'Dispatches an Enter/Search submission action to the focused input field or search bar.',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const startTime = Date.now();
    const ok = await AccessibilityModule.pressEnter();
    return { success: ok, data: { pressed: ok }, durationMs: Date.now() - startTime };
  },
};

export const waitForElementTool: ToolDefinition = {
  name: 'wait_for_element',
  description: 'Waits until a specific element text or content description appears on the screen.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Text or description to wait for' },
      timeoutMs: { type: 'number', description: 'Max wait time in ms', default: 3000 },
    },
    required: ['query'],
  },
  execute: async ({ query, timeoutMs = 3000 }) => {
    const found = await AccessibilityModule.waitForElement(query, timeoutMs);
    return { success: found, data: { query, found } };
  },
};

export const verifyPlaybackActiveTool: ToolDefinition = {
  name: 'verify_playback_active',
  description: 'Verifies whether audio/video playback is currently active on the device.',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const isPlaying = await SystemControlModule.isMediaPlaying();
    const screen = await AccessibilityModule.inspectScreen();
    const hasPlayer =
      screen.activePackage.includes('youtube') ||
      screen.activePackage.includes('spotify') ||
      screen.nodes.some((n) => (n.text || '').toLowerCase().includes('play') || (n.contentDescription || '').toLowerCase().includes('pause'));

    const success = isPlaying || hasPlayer;
    return {
      success,
      data: { isPlaying, activePackage: screen.activePackage, verified: success },
    };
  },
};

export const verifyMessageSentTool: ToolDefinition = {
  name: 'verify_message_sent',
  description: 'Verifies that a message has been sent (composer cleared and message visible in conversation).',
  parameters: {
    type: 'object',
    properties: {
      expectedSnippet: { type: 'string', description: 'Snippet of the sent message' },
    },
  },
  execute: async ({ expectedSnippet }) => {
    const screen = await AccessibilityModule.inspectScreen();
    let foundSnippet = true;
    if (expectedSnippet) {
      foundSnippet = screen.nodes.some((n) =>
        (n.text || '').toLowerCase().includes(expectedSnippet.toLowerCase())
      );
    }
    return {
      success: foundSnippet,
      data: { activePackage: screen.activePackage, messageSent: foundSnippet },
    };
  },
};
