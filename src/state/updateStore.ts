import { create } from 'zustand';
import { UpdateCheckResult } from '../native/InAppUpdateModule';

export type UpdateStatus =
  | 'IDLE'
  | 'CHECKING'
  | 'AVAILABLE'
  | 'DOWNLOADING'
  | 'READY_TO_INSTALL'
  | 'UP_TO_DATE'
  | 'ERROR';

export interface UpdateStore {
  status: UpdateStatus;
  currentVersion: string;
  currentVersionCode: number;
  latestVersion: string | null;
  latestVersionCode: number | null;
  releaseNotes: string | null;
  apkUrl: string | null;
  downloadPercent: number;
  errorMessage: string | null;
  isModalVisible: boolean;
  forceUpdate: boolean;
  lastCheckedAt: number | null;

  setStatus: (status: UpdateStatus) => void;
  setUpdateResult: (result: UpdateCheckResult) => void;
  setDownloadPercent: (percent: number) => void;
  setError: (error: string | null) => void;
  setModalVisible: (visible: boolean) => void;
  setVersionInfo: (version: string, code: number) => void;
  reset: () => void;
}

export const useUpdateStore = create<UpdateStore>((set) => ({
  status: 'IDLE',
  currentVersion: '1.0.0',
  currentVersionCode: 1,
  latestVersion: null,
  latestVersionCode: null,
  releaseNotes: null,
  apkUrl: null,
  downloadPercent: 0,
  errorMessage: null,
  isModalVisible: false,
  forceUpdate: false,
  lastCheckedAt: null,

  setStatus: (status) => set({ status }),
  setUpdateResult: (result) =>
    set({
      status: result.isUpdateAvailable ? 'AVAILABLE' : 'UP_TO_DATE',
      currentVersion: result.currentVersion,
      currentVersionCode: result.currentVersionCode,
      latestVersion: result.latestVersion,
      latestVersionCode: result.latestVersionCode,
      releaseNotes: result.releaseNotes,
      apkUrl: result.apkUrl,
      forceUpdate: result.forceUpdate,
      lastCheckedAt: Date.now(),
      isModalVisible: result.isUpdateAvailable,
      errorMessage: null,
    }),
  setDownloadPercent: (downloadPercent) => set({ downloadPercent, status: downloadPercent >= 100 ? 'READY_TO_INSTALL' : 'DOWNLOADING' }),
  setError: (errorMessage) => set({ errorMessage, status: 'ERROR' }),
  setModalVisible: (isModalVisible) => set({ isModalVisible }),
  setVersionInfo: (currentVersion, currentVersionCode) => set({ currentVersion, currentVersionCode }),
  reset: () =>
    set({
      status: 'IDLE',
      downloadPercent: 0,
      errorMessage: null,
      isModalVisible: false,
    }),
}));
