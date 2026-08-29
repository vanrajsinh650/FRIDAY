import { InstalledApp } from '../native/types';

export type AppCategoryKey =
  | 'FAVORITES'
  | 'SOCIAL'
  | 'MEDIA'
  | 'TOOLS'
  | 'WORK'
  | 'FINANCE'
  | 'GAMES'
  | 'OTHER';

export interface AppCategoryInfo {
  key: AppCategoryKey;
  label: string;
  emoji: string;
  description: string;
}

export const APP_CATEGORIES: Record<AppCategoryKey, AppCategoryInfo> = {
  FAVORITES: {
    key: 'FAVORITES',
    label: 'Pinned Favorites',
    emoji: '⭐',
    description: 'Quick access pinned to your home screen dock',
  },
  SOCIAL: {
    key: 'SOCIAL',
    label: 'Social & Communication',
    emoji: '💬',
    description: 'Chat, messaging, calling & social networks',
  },
  MEDIA: {
    key: 'MEDIA',
    label: 'Media & Entertainment',
    emoji: '🎬',
    description: 'Music, videos, streaming, camera & gallery',
  },
  TOOLS: {
    key: 'TOOLS',
    label: 'System & Utilities',
    emoji: '🛠️',
    description: 'Settings, system tools, files & device hardware',
  },
  WORK: {
    key: 'WORK',
    label: 'Work & Productivity',
    emoji: '💼',
    description: 'Browser, email, cloud storage, docs & notes',
  },
  FINANCE: {
    key: 'FINANCE',
    label: 'Finance & Shopping',
    emoji: '💳',
    description: 'Payments, banking, food delivery & shopping',
  },
  GAMES: {
    key: 'GAMES',
    label: 'Games & Play',
    emoji: '🎮',
    description: 'Gaming, entertainment & leisure',
  },
  OTHER: {
    key: 'OTHER',
    label: 'Applications',
    emoji: '📦',
    description: 'Installed applications',
  },
};

export interface CategoryGroup {
  category: AppCategoryInfo;
  apps: InstalledApp[];
}

export class AppCategorizer {
  private static socialKeywords = [
    'whatsapp', 'telegram', 'instagram', 'facebook', 'messenger', 'snapchat', 'twitter', 'discord',
    'signal', 'viber', 'wechat', 'line', 'contacts', 'dialer', 'phone', 'call', 'message', 'sms',
    'truecaller', 'threads', 'reddit', 'meet', 'zoom', 'skype'
  ];

  private static mediaKeywords = [
    'youtube', 'spotify', 'netflix', 'hotstar', 'prime', 'amazon video', 'jiocinema', 'wynk', 'gaana',
    'jiosaavn', 'music', 'sound', 'camera', 'photo', 'gallery', 'video', 'vlc', 'mxplayer', 'stream',
    'twitch', 'podcast', 'recording', 'recorder', 'fm', 'radio'
  ];

  private static toolsKeywords = [
    'setting', 'file', 'calculator', 'clock', 'alarm', 'timer', 'calendar', 'weather', 'flashlight',
    'torch', 'shizuku', 'play store', 'vending', 'security', 'antivirus', 'cleaner', 'compass',
    'scanner', 'accessibility', 'device', 'launcher', 'keyboard', 'system'
  ];

  private static workKeywords = [
    'chrome', 'browser', 'firefox', 'opera', 'edge', 'gmail', 'email', 'mail', 'drive', 'docs',
    'sheet', 'slides', 'keep', 'note', 'office', 'excel', 'word', 'powerpoint', 'pdf', 'acrobat',
    'notion', 'slack', 'teams', 'linkedin', 'github', 'trello', 'asana', 'todo'
  ];

  private static financeKeywords = [
    'paytm', 'phonepe', 'gpay', 'google pay', 'bhim', 'cred', 'amazon', 'flipkart', 'myntra',
    'meesho', 'swiggy', 'zomato', 'blinkit', 'zepto', 'instamart', 'bank', 'sbi', 'hdfc', 'icici',
    'axis', 'kotak', 'yono', 'zerodha', 'groww', 'upstox', 'crypto', 'wallet'
  ];

  private static gameKeywords = [
    'game', 'play games', 'bgmi', 'pubg', 'free fire', 'candy crush', 'subway', 'surfer', 'clash',
    'roblox', 'minecraft', 'ludo', 'chess', 'asphalt', 'racing', 'puzzle', 'arcade', 'rpg'
  ];

  static categorizeApp(app: InstalledApp): AppCategoryKey {
    const text = (app.appName + ' ' + (app.packageName || '')).toLowerCase();

    if (this.matchesAny(text, this.socialKeywords)) return 'SOCIAL';
    if (this.matchesAny(text, this.mediaKeywords)) return 'MEDIA';
    if (this.matchesAny(text, this.workKeywords)) return 'WORK';
    if (this.matchesAny(text, this.financeKeywords)) return 'FINANCE';
    if (this.matchesAny(text, this.gameKeywords)) return 'GAMES';
    if (this.matchesAny(text, this.toolsKeywords)) return 'TOOLS';

    return 'OTHER';
  }

  static groupApps(
    apps: InstalledApp[],
    pinnedPackages: string[] = [],
    hiddenPackages: string[] = []
  ): CategoryGroup[] {
    const hiddenSet = new Set(hiddenPackages);
    const pinnedSet = new Set(pinnedPackages);

    const visibleApps = apps.filter((a) => !hiddenSet.has(a.packageName));

    const groupsMap: Record<AppCategoryKey, InstalledApp[]> = {
      FAVORITES: [],
      SOCIAL: [],
      MEDIA: [],
      WORK: [],
      FINANCE: [],
      GAMES: [],
      TOOLS: [],
      OTHER: [],
    };

    // 1. Pinned apps
    for (const app of visibleApps) {
      if (pinnedSet.has(app.packageName)) {
        groupsMap.FAVORITES.push(app);
      }
    }

    // 2. All categorized apps
    for (const app of visibleApps) {
      const category = this.categorizeApp(app);
      groupsMap[category].push(app);
    }

    // Sort each group alphabetically
    for (const key of Object.keys(groupsMap) as AppCategoryKey[]) {
      groupsMap[key].sort((a, b) => a.appName.localeCompare(b.appName));
    }

    const result: CategoryGroup[] = [];

    // Add FAVORITES group first if has apps
    if (groupsMap.FAVORITES.length > 0) {
      result.push({ category: APP_CATEGORIES.FAVORITES, apps: groupsMap.FAVORITES });
    }

    const orderedCategories: AppCategoryKey[] = [
      'SOCIAL',
      'MEDIA',
      'WORK',
      'FINANCE',
      'TOOLS',
      'GAMES',
      'OTHER',
    ];

    for (const catKey of orderedCategories) {
      if (groupsMap[catKey].length > 0) {
        result.push({ category: APP_CATEGORIES[catKey], apps: groupsMap[catKey] });
      }
    }

    return result;
  }

  private static matchesAny(text: string, keywords: string[]): boolean {
    return keywords.some((kw) => text.includes(kw));
  }
}
