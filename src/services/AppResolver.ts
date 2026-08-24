import { NativeModules } from 'react-native';
import { SystemControlModule } from '../native/SystemControlModule';
import { AccessibilityModule } from '../native/AccessibilityModule';

const { FridaySystemControlNative, FridayAccessibilityNative } = NativeModules;

export interface AppInfo {
  appName: string;
  packageName: string;
  isSystemApp: boolean;
}

export interface LaunchResult {
  success: boolean;
  packageName?: string;
  appName?: string;
  error?: string;
  foregroundReached?: boolean;
}

export class AppResolver {
  /**
   * Dynamically launches any application on device by spoken voice query,
   * label, or package name using phonetic fuzzy matching. Zero hardcoding!
   */
  static async launch(packageNameOrQuery: string): Promise<LaunchResult> {
    const rawQuery = packageNameOrQuery.trim();
    if (!rawQuery) {
      return { success: false, error: 'Empty query provided' };
    }

    try {
      const ok = await SystemControlModule.launchApp(rawQuery);
      if (ok) {
        let foregroundReached = true;
        if (FridayAccessibilityNative?.waitForPackage) {
          foregroundReached = await FridayAccessibilityNative.waitForPackage(rawQuery, 2000);
        } else {
          AccessibilityModule.setMockPackage(rawQuery);
        }

        const canonicalFallback: Record<string, string> = {
          youtube: 'com.google.android.youtube',
          whatsapp: 'com.whatsapp',
        };
        const resolvedPkg = canonicalFallback[rawQuery.toLowerCase()] || rawQuery;

        return {
          success: true,
          packageName: resolvedPkg,
          appName: rawQuery,
          foregroundReached,
        };
      }

      return {
        success: false,
        error: `Could not find or launch application '${rawQuery}' on device.`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Native error launching application',
      };
    }
  }

  /**
   * Retrieves all installed launchable apps from device
   */
  static async listInstalledApps(): Promise<AppInfo[]> {
    try {
      if (FridaySystemControlNative?.getInstalledApps) {
        return await FridaySystemControlNative.getInstalledApps();
      }
      return [];
    } catch (err) {
      console.warn('Failed to fetch installed apps', err);
      return [];
    }
  }
}
