import { NativeModules, DeviceEventEmitter, EmitterSubscription } from 'react-native';

const { FridayInAppUpdateNative } = NativeModules;

export interface AppVersionInfo {
  currentVersion: string;
  currentVersionCode: number;
  packageName: string;
}

export interface UpdateManifest {
  version: string;
  versionCode: number;
  apkUrl: string;
  releaseNotes: string;
  minSupportedVersion?: string;
  forceUpdate?: boolean;
  publishedAt?: string;
}

export interface UpdateCheckResult {
  isUpdateAvailable: boolean;
  currentVersion: string;
  currentVersionCode: number;
  latestVersion: string;
  latestVersionCode: number;
  releaseNotes: string;
  apkUrl: string;
  forceUpdate: boolean;
}

export interface DownloadProgress {
  percent: number; // 0 to 100
  bytesDownloaded: number;
  totalBytes: number;
}

export class InAppUpdateModule {
  static async getAppVersionInfo(): Promise<AppVersionInfo> {
    if (FridayInAppUpdateNative?.getAppVersionInfo) {
      return await FridayInAppUpdateNative.getAppVersionInfo();
    }
    return {
      currentVersion: '1.0.0',
      currentVersionCode: 1,
      packageName: 'com.friday',
    };
  }

  static async canRequestPackageInstalls(): Promise<boolean> {
    if (FridayInAppUpdateNative?.canRequestPackageInstalls) {
      return await FridayInAppUpdateNative.canRequestPackageInstalls();
    }
    return true;
  }

  static async openInstallPermissionSettings(): Promise<boolean> {
    if (FridayInAppUpdateNative?.openInstallPermissionSettings) {
      return await FridayInAppUpdateNative.openInstallPermissionSettings();
    }
    return true;
  }

  static async checkForUpdate(manifestUrl?: string): Promise<UpdateCheckResult> {
    if (FridayInAppUpdateNative?.checkForUpdate) {
      return await FridayInAppUpdateNative.checkForUpdate(manifestUrl);
    }
    return {
      isUpdateAvailable: false,
      currentVersion: '1.0.0',
      currentVersionCode: 1,
      latestVersion: '1.0.0',
      latestVersionCode: 1,
      releaseNotes: '',
      apkUrl: '',
      forceUpdate: false,
    };
  }

  static async downloadAndInstallUpdate(apkUrl: string): Promise<boolean> {
    if (FridayInAppUpdateNative?.downloadAndInstallUpdate) {
      return await FridayInAppUpdateNative.downloadAndInstallUpdate(apkUrl);
    }
    return true;
  }

  static onDownloadProgress(callback: (progress: DownloadProgress) => void): EmitterSubscription {
    return DeviceEventEmitter.addListener('onUpdateDownloadProgress', callback);
  }
}
