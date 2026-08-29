import { InAppUpdateModule } from '../src/native/InAppUpdateModule';
import { useUpdateStore } from '../src/state/updateStore';
import { InAppUpdateService } from '../src/services/InAppUpdateService';
import { FridayAgent } from '../src/agent/agent';

describe('In-App Update System', () => {
  beforeEach(() => {
    useUpdateStore.getState().reset();
  });

  test('InAppUpdateModule provides version information and permission checks', async () => {
    const versionInfo = await InAppUpdateModule.getAppVersionInfo();
    expect(versionInfo).toHaveProperty('currentVersion');
    expect(versionInfo).toHaveProperty('currentVersionCode');
    expect(versionInfo).toHaveProperty('packageName');

    const canInstall = await InAppUpdateModule.canRequestPackageInstalls();
    expect(typeof canInstall).toBe('boolean');

    const settingsResult = await InAppUpdateModule.openInstallPermissionSettings();
    expect(settingsResult).toBe(true);
  });

  test('UpdateStore tracks update states and progress', () => {
    const store = useUpdateStore.getState();
    expect(store.status).toBe('IDLE');
    expect(store.downloadPercent).toBe(0);

    store.setUpdateResult({
      isUpdateAvailable: true,
      currentVersion: '1.0.0',
      currentVersionCode: 1,
      latestVersion: '1.1.0',
      latestVersionCode: 2,
      releaseNotes: 'Fixed bugs and added in-app update',
      apkUrl: 'https://example.com/friday_v1.1.0.apk',
      forceUpdate: false,
    });

    const updated = useUpdateStore.getState();
    expect(updated.status).toBe('AVAILABLE');
    expect(updated.latestVersion).toBe('1.1.0');
    expect(updated.isModalVisible).toBe(true);

    updated.setDownloadPercent(50);
    expect(useUpdateStore.getState().status).toBe('DOWNLOADING');
    expect(useUpdateStore.getState().downloadPercent).toBe(50);

    updated.setDownloadPercent(100);
    expect(useUpdateStore.getState().status).toBe('READY_TO_INSTALL');
  });

  test('InAppUpdateService checks for updates and handles installation flow', async () => {
    await InAppUpdateService.initialize();

    const checkResult = await InAppUpdateService.checkForUpdates(false);
    expect(checkResult).toHaveProperty('currentVersion');
    expect(checkResult).toHaveProperty('isUpdateAvailable');

    // Simulate update available
    useUpdateStore.getState().setUpdateResult({
      isUpdateAvailable: true,
      currentVersion: '1.0.0',
      currentVersionCode: 1,
      latestVersion: '1.1.0',
      latestVersionCode: 2,
      releaseNotes: 'Performance upgrades',
      apkUrl: 'https://example.com/release.apk',
      forceUpdate: false,
    });

    const installSuccess = await InAppUpdateService.startDownloadAndInstall();
    expect(typeof installSuccess).toBe('boolean');
  });

  test('FridayAgent handles check for updates voice command', async () => {
    const agent = new FridayAgent();
    const reply = await agent.executeGoal('Friday, check for updates');
    expect(reply).toBeDefined();
    expect(reply.length).toBeGreaterThan(0);
    expect(reply.toLowerCase()).toMatch(/update|version/);
  });
});
