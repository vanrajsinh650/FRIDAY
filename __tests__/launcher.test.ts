import { AppCategorizer } from '../src/utils/appCategorizer';
import { useLauncherStore } from '../src/state/launcherStore';
import { FridayAgent } from '../src/agent/agent';
import { InstalledApp } from '../src/native/types';

describe('App Organization & Launcher Management', () => {
  const sampleApps: InstalledApp[] = [
    { appName: 'WhatsApp', packageName: 'com.whatsapp', icon: '' },
    { appName: 'YouTube', packageName: 'com.google.android.youtube', icon: '' },
    { appName: 'Chrome', packageName: 'com.android.chrome', icon: '' },
    { appName: 'Google Pay', packageName: 'com.google.android.apps.nbu.paisa.user', icon: '' },
    { appName: 'Settings', packageName: 'com.android.settings', icon: '' },
    { appName: 'Subway Surfers', packageName: 'com.kiloo.subwaysurf', icon: '' },
    { appName: 'Unknown Tool', packageName: 'com.example.custom', icon: '' },
  ];

  test('AppCategorizer accurately categorizes applications into functional groups', () => {
    expect(AppCategorizer.categorizeApp(sampleApps[0])).toBe('SOCIAL');
    expect(AppCategorizer.categorizeApp(sampleApps[1])).toBe('MEDIA');
    expect(AppCategorizer.categorizeApp(sampleApps[2])).toBe('WORK');
    expect(AppCategorizer.categorizeApp(sampleApps[3])).toBe('FINANCE');
    expect(AppCategorizer.categorizeApp(sampleApps[4])).toBe('TOOLS');
    expect(AppCategorizer.categorizeApp(sampleApps[5])).toBe('GAMES');
    expect(AppCategorizer.categorizeApp(sampleApps[6])).toBe('OTHER');
  });

  test('AppCategorizer groups apps and respects pinned and hidden packages', () => {
    const pinned = ['com.whatsapp', 'com.android.chrome'];
    const hidden = ['com.kiloo.subwaysurf'];

    const groups = AppCategorizer.groupApps(sampleApps, pinned, hidden);

    const favoritesGroup = groups.find((g) => g.category.key === 'FAVORITES');
    expect(favoritesGroup).toBeDefined();
    expect(favoritesGroup?.apps.map((a) => a.packageName)).toContain('com.whatsapp');
    expect(favoritesGroup?.apps.map((a) => a.packageName)).toContain('com.android.chrome');

    // Hidden app should not exist in any group
    for (const g of groups) {
      expect(g.apps.some((a) => a.packageName === 'com.kiloo.subwaysurf')).toBe(false);
    }
  });

  test('LauncherStore manages pinning, hiding, and layout configurations', () => {
    const store = useLauncherStore.getState();

    store.pinApp('com.example.newapp');
    expect(useLauncherStore.getState().pinnedPackages).toContain('com.example.newapp');

    store.unpinApp('com.example.newapp');
    expect(useLauncherStore.getState().pinnedPackages).not.toContain('com.example.newapp');

    store.togglePin('com.example.toggled');
    expect(useLauncherStore.getState().pinnedPackages).toContain('com.example.toggled');
    store.togglePin('com.example.toggled');
    expect(useLauncherStore.getState().pinnedPackages).not.toContain('com.example.toggled');

    store.hideApp('com.bloatware.junk');
    expect(useLauncherStore.getState().hiddenPackages).toContain('com.bloatware.junk');
    store.unhideApp('com.bloatware.junk');
    expect(useLauncherStore.getState().hiddenPackages).not.toContain('com.bloatware.junk');

    store.setLayoutMode('CATEGORIES');
    expect(useLauncherStore.getState().layoutMode).toBe('CATEGORIES');

    store.setSelectedCategory('SOCIAL');
    expect(useLauncherStore.getState().selectedCategory).toBe('SOCIAL');
  });

  test('FridayAgent handles organize apps voice instruction', async () => {
    const agent = new FridayAgent();
    const reply = await agent.executeGoal('Friday, organize my apps');
    expect(reply).toBeDefined();
    expect(reply.toLowerCase()).toMatch(/organized|structured|categories/);
  });
});
