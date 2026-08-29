import { create } from 'zustand';
import { AppCategoryKey } from '../utils/appCategorizer';
import { InstalledApp } from '../native/types';

export interface LauncherStore {
  pinnedPackages: string[];
  hiddenPackages: string[];
  selectedCategory: AppCategoryKey | 'ALL';
  layoutMode: 'CATEGORIES' | 'GRID';
  selectedAppForAction: InstalledApp | null;

  pinApp: (packageName: string) => void;
  unpinApp: (packageName: string) => void;
  togglePin: (packageName: string) => void;
  hideApp: (packageName: string) => void;
  unhideApp: (packageName: string) => void;
  setSelectedCategory: (category: AppCategoryKey | 'ALL') => void;
  setLayoutMode: (mode: 'CATEGORIES' | 'GRID') => void;
  setSelectedAppForAction: (app: InstalledApp | null) => void;
}

export const useLauncherStore = create<LauncherStore>((set, get) => ({
  pinnedPackages: [
    'com.whatsapp',
    'com.android.chrome',
    'com.google.android.youtube',
    'com.google.android.dialer',
    'com.android.camera',
  ],
  hiddenPackages: [],
  selectedCategory: 'ALL',
  layoutMode: 'CATEGORIES',
  selectedAppForAction: null,

  pinApp: (packageName: string) => {
    const current = get().pinnedPackages;
    if (!current.includes(packageName)) {
      set({ pinnedPackages: [...current, packageName] });
    }
  },

  unpinApp: (packageName: string) => {
    set({ pinnedPackages: get().pinnedPackages.filter((p) => p !== packageName) });
  },

  togglePin: (packageName: string) => {
    const current = get().pinnedPackages;
    if (current.includes(packageName)) {
      set({ pinnedPackages: current.filter((p) => p !== packageName) });
    } else {
      set({ pinnedPackages: [...current, packageName] });
    }
  },

  hideApp: (packageName: string) => {
    const current = get().hiddenPackages;
    if (!current.includes(packageName)) {
      set({ hiddenPackages: [...current, packageName] });
    }
  },

  unhideApp: (packageName: string) => {
    set({ hiddenPackages: get().hiddenPackages.filter((p) => p !== packageName) });
  },

  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  setLayoutMode: (layoutMode) => set({ layoutMode }),
  setSelectedAppForAction: (selectedAppForAction) => set({ selectedAppForAction }),
}));
