import { ToolDefinition, ToolResult } from './types';
import { RootControlModule } from '../native/RootControlModule';

const PACKAGE_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
const PERMISSION_REGEX = /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)+$/;

export const elevatedTapTool: ToolDefinition = {
  name: 'elevated_tap',
  description: 'Perform an elevated hardware touch tap at exact screen coordinates (x, y) via Shizuku/Root (bypassing accessibility and overlay touch restrictions).',
  parameters: {
    type: 'object',
    properties: {
      x: {
        type: 'number',
        description: 'The horizontal screen coordinate (pixel X).',
      },
      y: {
        type: 'number',
        description: 'The vertical screen coordinate (pixel Y).',
      },
    },
    required: ['x', 'y'],
  },
  execute: async (params: { x: number; y: number }): Promise<ToolResult> => {
    if (
      params.x === undefined ||
      params.y === undefined ||
      typeof params.x !== 'number' ||
      typeof params.y !== 'number' ||
      isNaN(params.x) ||
      isNaN(params.y) ||
      !Number.isFinite(params.x) ||
      !Number.isFinite(params.y) ||
      params.x < 0 ||
      params.y < 0 ||
      params.x > 10000 ||
      params.y > 10000
    ) {
      return { success: false, error: 'Parameters "x" and "y" must be valid non-negative finite numbers for elevated_tap.' };
    }
    const ok = await RootControlModule.inputTap(params.x, params.y);
    if (ok) {
      return { success: true, data: { x: Math.round(params.x), y: Math.round(params.y), action: 'elevated_tap' } };
    }
    return { success: false, error: 'Failed to execute elevated tap. Shizuku/Root privileges unavailable or command failed.' };
  },
};

export const elevatedTextTool: ToolDefinition = {
  name: 'elevated_text',
  description: 'Type text directly via elevated Shizuku/Root shell input into the currently focused input field.',
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'The text string to type into the focused element.',
      },
    },
    required: ['text'],
  },
  execute: async (params: { text: string }): Promise<ToolResult> => {
    if (params.text === undefined || params.text === null || typeof params.text !== 'string') {
      return { success: false, error: 'Parameter "text" is required for elevated_text.' };
    }
    const ok = await RootControlModule.inputText(params.text);
    if (ok) {
      return { success: true, data: { text: params.text, action: 'elevated_text' } };
    }
    return { success: false, error: 'Failed to execute elevated text input. Shizuku/Root privileges unavailable or command failed.' };
  },
};

export const elevatedKeyTool: ToolDefinition = {
  name: 'elevated_key',
  description: 'Send an elevated hardware Android key event code (e.g., 3 for HOME, 4 for BACK, 66 for ENTER, 24 for VOLUME_UP, 25 for VOLUME_DOWN, 26 for POWER).',
  parameters: {
    type: 'object',
    properties: {
      keyCode: {
        type: 'number',
        description: 'Android KeyEvent code (e.g. 3 = HOME, 4 = BACK, 66 = ENTER, 24 = VOLUME_UP, 25 = VOLUME_DOWN).',
      },
    },
    required: ['keyCode'],
  },
  execute: async (params: { keyCode: number | string }): Promise<ToolResult> => {
    const numericCode = typeof params.keyCode === 'string' ? parseInt(params.keyCode, 10) : params.keyCode;
    if (
      numericCode === undefined ||
      numericCode === null ||
      typeof numericCode !== 'number' ||
      isNaN(numericCode) ||
      !Number.isFinite(numericCode) ||
      numericCode < 0 ||
      numericCode > 1000
    ) {
      return { success: false, error: 'Parameter "keyCode" must be a valid non-negative integer key code for elevated_key.' };
    }
    const ok = await RootControlModule.inputKey(numericCode);
    if (ok) {
      return { success: true, data: { keyCode: numericCode, action: 'elevated_key' } };
    }
    return { success: false, error: `Failed to execute elevated keyevent ${params.keyCode}. Privileges unavailable or command failed.` };
  },
};

export const killAppSilentTool: ToolDefinition = {
  name: 'kill_app_silent',
  description: 'Silently force-stop a foreground or background application package via elevated ADB/Root (am force-stop).',
  parameters: {
    type: 'object',
    properties: {
      packageName: {
        type: 'string',
        description: 'Android package name to kill (e.g. com.google.android.youtube).',
      },
    },
    required: ['packageName'],
  },
  execute: async (params: { packageName: string }): Promise<ToolResult> => {
    if (!params.packageName || typeof params.packageName !== 'string' || !PACKAGE_NAME_REGEX.test(params.packageName.trim())) {
      return { success: false, error: 'Parameter "packageName" must be a valid Android package name (e.g. com.example.app).' };
    }
    const cleanPackage = params.packageName.trim();
    const ok = await RootControlModule.killProcess(cleanPackage);
    if (ok) {
      return { success: true, data: { packageName: cleanPackage, killed: true } };
    }
    return { success: false, error: `Failed to force-stop package "${cleanPackage}". Elevated privileges unavailable or command failed.` };
  },
};

export const checkElevatedStatusTool: ToolDefinition = {
  name: 'check_elevated_status',
  description: 'Check whether Shizuku (Tier 1) or true Root (Tier 2) elevated privileges are available and authorized on this device.',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async (): Promise<ToolResult> => {
    const status = await RootControlModule.getElevatedStatus();
    return {
      success: true,
      data: status,
    };
  },
};

export const executeElevatedShellTool: ToolDefinition = {
  name: 'execute_elevated_shell',
  description: 'Execute an arbitrary non-destructive shell command via Shizuku (Tier 1) or Root (Tier 2).',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute.',
      },
    },
    required: ['command'],
  },
  execute: async (params: { command: string }): Promise<ToolResult> => {
    if (!params.command || typeof params.command !== 'string' || params.command.trim().length === 0) {
      return { success: false, error: 'Parameter "command" is required for execute_elevated_shell.' };
    }
    const result = await RootControlModule.executeElevatedShell(params.command);
    return {
      success: result.success,
      data: result,
      error: result.error,
    };
  },
};

export const grantRuntimePermissionTool: ToolDefinition = {
  name: 'grant_runtime_permission',
  description: 'Grant a dangerous runtime permission to a package via elevated ADB/Root (pm grant).',
  parameters: {
    type: 'object',
    properties: {
      packageName: {
        type: 'string',
        description: 'Target package name.',
      },
      permission: {
        type: 'string',
        description: 'Android permission string (e.g. android.permission.RECORD_AUDIO).',
      },
    },
    required: ['packageName', 'permission'],
  },
  execute: async (params: { packageName: string; permission: string }): Promise<ToolResult> => {
    if (
      !params.packageName ||
      !params.permission ||
      typeof params.packageName !== 'string' ||
      typeof params.permission !== 'string' ||
      !PACKAGE_NAME_REGEX.test(params.packageName.trim()) ||
      !PERMISSION_REGEX.test(params.permission.trim())
    ) {
      return { success: false, error: 'Parameters "packageName" and "permission" must be valid Android package and permission identifiers.' };
    }
    const cleanPackage = params.packageName.trim();
    const cleanPermission = params.permission.trim();
    const ok = await RootControlModule.grantPermission(cleanPackage, cleanPermission);
    if (ok) {
      return { success: true, data: { packageName: cleanPackage, permission: cleanPermission, granted: true } };
    }
    return { success: false, error: `Failed to grant permission "${cleanPermission}" to "${cleanPackage}". Privileges unavailable or command failed.` };
  },
};
