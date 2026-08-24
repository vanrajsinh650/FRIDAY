import { NativeModules } from 'react-native';
import { OverlayState } from './types';

const { FridayFloatingOverlayNative } = NativeModules;

export class FloatingOverlayModule {
  private static mockShowing = false;
  private static mockStatusText = 'FRIDAY Standby';
  private static mockState = 'IDLE';

  /**
   * Check if SYSTEM_ALERT_WINDOW permission is granted.
   */
  static async checkOverlayPermission(): Promise<boolean> {
    if (FridayFloatingOverlayNative?.checkOverlayPermission) {
      try {
        return await FridayFloatingOverlayNative.checkOverlayPermission();
      } catch (_e) {
        return false;
      }
    }
    return true;
  }

  /**
   * Request SYSTEM_ALERT_WINDOW permission (opens Android overlay settings).
   */
  static async requestOverlayPermission(): Promise<boolean> {
    if (FridayFloatingOverlayNative?.requestOverlayPermission) {
      try {
        return await FridayFloatingOverlayNative.requestOverlayPermission();
      } catch (_e) {
        return false;
      }
    }
    return true;
  }

  /**
   * Display or elevate the persistent floating Holographic HUD on screen.
   */
  static async showOverlay(statusText: string = 'Online & Listening', state: string = 'IDLE'): Promise<boolean> {
    FloatingOverlayModule.mockShowing = true;
    FloatingOverlayModule.mockStatusText = statusText;
    FloatingOverlayModule.mockState = state;

    if (FridayFloatingOverlayNative?.showOverlay) {
      try {
        const result = await FridayFloatingOverlayNative.showOverlay(statusText, state);
        if (result === false) {
          FloatingOverlayModule.mockShowing = false;
        }
        return result;
      } catch (_e) {
        FloatingOverlayModule.mockShowing = false;
        return false;
      }
    }
    return true;
  }

  /**
   * Update the live status and glowing state of the active Floating HUD.
   */
  static async updateOverlay(statusText: string, state: string = 'EXECUTING'): Promise<boolean> {
    FloatingOverlayModule.mockStatusText = statusText;
    FloatingOverlayModule.mockState = state;

    if (FridayFloatingOverlayNative?.updateOverlay) {
      try {
        return await FridayFloatingOverlayNative.updateOverlay(statusText, state);
      } catch (_e) {
        return false;
      }
    }
    return true;
  }

  /**
   * Dismiss and remove the Floating HUD from screen.
   */
  static async hideOverlay(): Promise<boolean> {
    FloatingOverlayModule.mockShowing = false;

    if (FridayFloatingOverlayNative?.hideOverlay) {
      try {
        return await FridayFloatingOverlayNative.hideOverlay();
      } catch (_e) {
        return false;
      }
    }
    return true;
  }

  /**
   * Test/Diagnostic helper to check mock visibility.
   */
  static isMockShowing(): boolean {
    return FloatingOverlayModule.mockShowing;
  }

  /**
   * Test/Diagnostic helper to get current mock overlay state.
   */
  static getMockState(): OverlayState {
    return {
      statusText: FloatingOverlayModule.mockStatusText,
      state: FloatingOverlayModule.mockState,
    };
  }

  /**
   * Reset mock overlay state for test isolation.
   */
  static resetMockState(): void {
    FloatingOverlayModule.mockShowing = false;
    FloatingOverlayModule.mockStatusText = 'FRIDAY Standby';
    FloatingOverlayModule.mockState = 'IDLE';
  }
}
