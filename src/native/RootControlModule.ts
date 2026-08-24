import { NativeModules } from 'react-native';
import { ElevatedStatus, ElevatedExecutionResult } from './types';

const { FridayRootControlNative } = NativeModules;

const PACKAGE_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
const PERMISSION_REGEX = /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)+$/;

interface MockElevatedState {
  shizukuAvailable: boolean;
  shizukuPermission: boolean;
  rootAvailable: boolean;
  mockExecutionResult: ElevatedExecutionResult | null;
  executedCommands: string[];
}

function getGlobalMockState(): MockElevatedState {
  if (!(global as any).__FRIDAY_MOCK_ROOT_CONTROL__) {
    (global as any).__FRIDAY_MOCK_ROOT_CONTROL__ = {
      shizukuAvailable: false,
      shizukuPermission: false,
      rootAvailable: false,
      mockExecutionResult: null,
      executedCommands: [],
    };
  }
  return (global as any).__FRIDAY_MOCK_ROOT_CONTROL__;
}

export class RootControlModule {
  // --- Test & Mock State Management ---

  static setMockStatus(status: Partial<ElevatedStatus>): void {
    const mock = getGlobalMockState();
    if (status.shizukuAvailable !== undefined) mock.shizukuAvailable = status.shizukuAvailable;
    if (status.shizukuPermission !== undefined) mock.shizukuPermission = status.shizukuPermission;
    if (status.rootAvailable !== undefined) mock.rootAvailable = status.rootAvailable;
  }

  static setMockExecutionResult(result: Partial<ElevatedExecutionResult> | null): void {
    const mock = getGlobalMockState();
    if (result === null) {
      mock.mockExecutionResult = null;
    } else {
      mock.mockExecutionResult = {
        success: result.success ?? true,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
        exitCode: result.exitCode ?? 0,
        error: result.error,
      };
    }
  }

  static getExecutedCommands(): string[] {
    return [...getGlobalMockState().executedCommands];
  }

  static resetMockState(): void {
    (global as any).__FRIDAY_MOCK_ROOT_CONTROL__ = {
      shizukuAvailable: false,
      shizukuPermission: false,
      rootAvailable: false,
      mockExecutionResult: null,
      executedCommands: [],
    };
  }

  // --- Native & Elevated Methods ---

  static async isShizukuAvailable(): Promise<boolean> {
    if (FridayRootControlNative?.isShizukuAvailable) {
      try {
        return await FridayRootControlNative.isShizukuAvailable();
      } catch (_e) {}
    }
    return getGlobalMockState().shizukuAvailable;
  }

  static async hasShizukuPermission(): Promise<boolean> {
    if (FridayRootControlNative?.hasShizukuPermission) {
      try {
        return await FridayRootControlNative.hasShizukuPermission();
      } catch (_e) {}
    }
    return getGlobalMockState().shizukuPermission;
  }

  static async requestShizukuPermission(): Promise<boolean> {
    if (FridayRootControlNative?.requestShizukuPermission) {
      try {
        return await FridayRootControlNative.requestShizukuPermission();
      } catch (_e) {}
    }
    const mock = getGlobalMockState();
    if (mock.shizukuAvailable) {
      mock.shizukuPermission = true;
      return true;
    }
    return false;
  }

  static async isRootAvailable(): Promise<boolean> {
    if (FridayRootControlNative?.isRootAvailable) {
      try {
        return await FridayRootControlNative.isRootAvailable();
      } catch (_e) {}
    }
    return getGlobalMockState().rootAvailable;
  }

  static async getElevatedStatus(): Promise<ElevatedStatus> {
    if (FridayRootControlNative?.getElevatedStatus) {
      try {
        return await FridayRootControlNative.getElevatedStatus();
      } catch (_e) {}
    }

    const mock = getGlobalMockState();
    const elevatedAvail = mock.shizukuPermission || mock.rootAvailable;
    let activeTier: 'SHIZUKU' | 'ROOT' | 'NONE' = 'NONE';
    if (mock.shizukuPermission) {
      activeTier = 'SHIZUKU';
    } else if (mock.rootAvailable) {
      activeTier = 'ROOT';
    }

    return {
      shizukuAvailable: mock.shizukuAvailable,
      shizukuPermission: mock.shizukuPermission,
      rootAvailable: mock.rootAvailable,
      elevatedAvailable: elevatedAvail,
      activeTier,
    };
  }

  static async executeElevatedShell(command: string): Promise<ElevatedExecutionResult> {
    if (!command || typeof command !== 'string' || command.trim().length === 0) {
      return {
        success: false,
        stdout: '',
        stderr: 'Command cannot be null or empty.',
        exitCode: -1,
        error: 'INVALID_COMMAND',
      };
    }

    const mock = getGlobalMockState();
    mock.executedCommands.push(command);

    if (FridayRootControlNative?.executeElevatedShell) {
      try {
        return await FridayRootControlNative.executeElevatedShell(command);
      } catch (e: any) {
        return {
          success: false,
          stdout: '',
          stderr: e.message || 'Execution error',
          exitCode: -1,
          error: e.message || 'EXECUTION_FAILED',
        };
      }
    }

    if (mock.mockExecutionResult) {
      return { ...mock.mockExecutionResult };
    }

    const status = await this.getElevatedStatus();
    if (!status.elevatedAvailable) {
      return {
        success: false,
        stdout: '',
        stderr: 'ELEVATED_UNAVAILABLE: Neither Shizuku permission nor SU binary is available.',
        exitCode: -1,
        error: 'ELEVATED_UNAVAILABLE',
      };
    }

    // Default mock success when elevated is available
    return {
      success: true,
      stdout: 'Executed mock elevated command: ' + command,
      stderr: '',
      exitCode: 0,
    };
  }

  static async inputTap(x: number, y: number): Promise<boolean> {
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      isNaN(x) ||
      isNaN(y) ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      x < 0 ||
      y < 0 ||
      x > 10000 ||
      y > 10000
    ) {
      return false;
    }

    if (FridayRootControlNative?.inputTap) {
      try {
        return await FridayRootControlNative.inputTap(x, y);
      } catch (_e) {}
    }

    const res = await this.executeElevatedShell(`input tap ${Math.round(x)} ${Math.round(y)}`);
    return res.success;
  }

  static async inputText(text: string): Promise<boolean> {
    if (text === null || text === undefined || typeof text !== 'string') {
      return false;
    }

    if (FridayRootControlNative?.inputText) {
      try {
        return await FridayRootControlNative.inputText(text);
      } catch (_e) {}
    }

    // Sanitize control characters and newlines to prevent command injection
    const sanitized = text.replace(/[\x00-\x1F\x7F]/g, ' ');
    const escaped = sanitized.replace(/'/g, "'\\''");
    const res = await this.executeElevatedShell(`input text '${escaped}'`);
    return res.success;
  }

  static async inputKey(keyCode: number | string): Promise<boolean> {
    const numericCode = typeof keyCode === 'string' ? parseInt(keyCode, 10) : keyCode;
    if (
      typeof numericCode !== 'number' ||
      isNaN(numericCode) ||
      !Number.isFinite(numericCode) ||
      numericCode < 0 ||
      numericCode > 1000
    ) {
      return false;
    }

    if (FridayRootControlNative?.inputKey) {
      try {
        return await FridayRootControlNative.inputKey(numericCode);
      } catch (_e) {}
    }

    const res = await this.executeElevatedShell(`input keyevent ${numericCode}`);
    return res.success;
  }

  static async killProcess(packageName: string): Promise<boolean> {
    if (!packageName || typeof packageName !== 'string' || !PACKAGE_NAME_REGEX.test(packageName.trim())) {
      return false;
    }

    const cleanPackage = packageName.trim();

    if (FridayRootControlNative?.killProcess) {
      try {
        return await FridayRootControlNative.killProcess(cleanPackage);
      } catch (_e) {}
    }

    const res = await this.executeElevatedShell(`am force-stop ${cleanPackage}`);
    return res.success;
  }

  static async grantPermission(packageName: string, permission: string): Promise<boolean> {
    if (
      !packageName ||
      !permission ||
      typeof packageName !== 'string' ||
      typeof permission !== 'string' ||
      !PACKAGE_NAME_REGEX.test(packageName.trim()) ||
      !PERMISSION_REGEX.test(permission.trim())
    ) {
      return false;
    }

    const cleanPackage = packageName.trim();
    const cleanPermission = permission.trim();

    if (FridayRootControlNative?.grantPermission) {
      try {
        return await FridayRootControlNative.grantPermission(cleanPackage, cleanPermission);
      } catch (_e) {}
    }

    const res = await this.executeElevatedShell(`pm grant ${cleanPackage} ${cleanPermission}`);
    return res.success;
  }
}
