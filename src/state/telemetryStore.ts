import { create } from 'zustand';

export interface LatencyRecord {
  wakeDetectionMs: number;
  sttFirstTokenMs: number;
  llmTimeFirstTokenMs: number;
  timeToFirstActionMs: number;
  ttsFirstAudioMs: number;
  totalTaskMs: number;
  timestamp: number;
}

export interface TelemetryStore {
  currentMetrics: LatencyRecord;
  latencyHistory: LatencyRecord[];
  activeScreenPackage: string | null;
  visibleNodesCount: number;
  
  updateMetrics: (metrics: Partial<LatencyRecord>) => void;
  recordFinishedTask: () => void;
  setScreenDiagnostics: (pkg: string, nodeCount: number) => void;
}

export const useTelemetryStore = create<TelemetryStore>((set) => ({
  currentMetrics: {
    wakeDetectionMs: 0,
    sttFirstTokenMs: 0,
    llmTimeFirstTokenMs: 0,
    timeToFirstActionMs: 0,
    ttsFirstAudioMs: 0,
    totalTaskMs: 0,
    timestamp: Date.now(),
  },
  latencyHistory: [],
  activeScreenPackage: null,
  visibleNodesCount: 0,

  updateMetrics: (metrics) =>
    set((s) => ({
      currentMetrics: { ...s.currentMetrics, ...metrics },
    })),
  recordFinishedTask: () =>
    set((s) => ({
      latencyHistory: [s.currentMetrics, ...s.latencyHistory.slice(0, 49)],
    })),
  setScreenDiagnostics: (activeScreenPackage, visibleNodesCount) =>
    set({ activeScreenPackage, visibleNodesCount }),
}));
