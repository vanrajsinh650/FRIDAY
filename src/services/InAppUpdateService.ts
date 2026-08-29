import { InAppUpdateModule, UpdateCheckResult, DownloadProgress } from '../native/InAppUpdateModule';
import { useUpdateStore } from '../state/updateStore';
import { useSettingsStore } from '../state/settingsStore';
import { Logger } from '../utils/logger';

export class InAppUpdateService {
  private static progressSub: any = null;

  static async initialize(): Promise<void> {
    try {
      const vInfo = await InAppUpdateModule.getAppVersionInfo();
      useUpdateStore.getState().setVersionInfo(vInfo.currentVersion, vInfo.currentVersionCode);
    } catch (_e) {}

    if (!this.progressSub) {
      this.progressSub = InAppUpdateModule.onDownloadProgress((progress: DownloadProgress) => {
        useUpdateStore.getState().setDownloadPercent(progress.percent);
      });
    }
  }

  static async checkForUpdates(silent: boolean = false, customUrl?: string): Promise<UpdateCheckResult> {
    const store = useUpdateStore.getState();
    store.setStatus('CHECKING');
    store.setError(null);

    try {
      const settings = useSettingsStore.getState();
      const manifestUrl = customUrl || (settings as any).updateManifestUrl;
      const result = await InAppUpdateModule.checkForUpdate(manifestUrl);

      store.setUpdateResult(result);
      if (!result.isUpdateAvailable && !silent) {
        Logger.info('App is up to date: ' + result.currentVersion);
      }
      return result;
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to check for updates';
      store.setError(errorMsg);
      Logger.error('Update check error: ' + errorMsg);
      return {
        isUpdateAvailable: false,
        currentVersion: store.currentVersion,
        currentVersionCode: store.currentVersionCode,
        latestVersion: store.currentVersion,
        latestVersionCode: store.currentVersionCode,
        releaseNotes: '',
        apkUrl: '',
        forceUpdate: false,
      };
    }
  }

  static async startDownloadAndInstall(): Promise<boolean> {
    const store = useUpdateStore.getState();
    const apkUrl = store.apkUrl;

    if (!apkUrl) {
      store.setError('No update package URL found.');
      return false;
    }

    try {
      const canInstall = await InAppUpdateModule.canRequestPackageInstalls();
      if (!canInstall) {
        await InAppUpdateModule.openInstallPermissionSettings();
      }

      store.setStatus('DOWNLOADING');
      store.setDownloadPercent(0);
      store.setError(null);

      const success = await InAppUpdateModule.downloadAndInstallUpdate(apkUrl);
      if (success) {
        store.setStatus('READY_TO_INSTALL');
      }
      return success;
    } catch (err: any) {
      const msg = err?.message || 'Failed to download and install update';
      store.setError(msg);
      Logger.error('Update install error: ' + msg);
      return false;
    }
  }

  static dismiss(): void {
    const store = useUpdateStore.getState();
    if (!store.forceUpdate) {
      store.setModalVisible(false);
    }
  }
}
