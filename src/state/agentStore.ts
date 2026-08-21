export type AgentState = 
  | 'IDLE' 
  | 'LISTENING' 
  | 'THINKING' 
  | 'PLANNING' 
  | 'EXECUTING' 
  | 'VERIFYING' 
  | 'SPEAKING' 
  | 'RECOVERING' 
  | 'SUCCESS' 
  | 'ERROR';

export interface ActionStep {
  id: string;
  toolName: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  result?: any;
  error?: string;
  timestamp: number;
  durationMs?: number;
}

export interface AgentStore {
  state: AgentState;
  activeGoal: string | null;
  currentStepIndex: number;
  steps: ActionStep[];
  lastResponse: string | null;
  errorMessage: string | null;
  
  // Actions
  setAgentState: (state: AgentState) => void;
  setActiveGoal: (goal: string | null) => void;
  addStep: (step: Omit<ActionStep, 'id' | 'timestamp' | 'status'>) => string;
  updateStepStatus: (id: string, status: ActionStep['status'], result?: any, error?: string, durationMs?: number) => void;
  setLastResponse: (response: string | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

import { create } from 'zustand';

export const useAgentStore = create<AgentStore>((set) => ({
  state: 'IDLE',
  activeGoal: null,
  currentStepIndex: -1,
  steps: [],
  lastResponse: null,
  errorMessage: null,

  setAgentState: (state) => set({ state }),
  setActiveGoal: (activeGoal) => set({ activeGoal, steps: [], currentStepIndex: -1, errorMessage: null }),
  addStep: (step) => {
    const id = `step_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    set((s) => ({
      steps: [...s.steps, { ...step, id, status: 'pending', timestamp: Date.now() }],
      currentStepIndex: s.steps.length,
    }));
    return id;
  },
  updateStepStatus: (id, status, result, error, durationMs) =>
    set((s) => ({
      steps: s.steps.map((st) =>
        st.id === id ? { ...st, status, result, error, durationMs } : st
      ),
    })),
  setLastResponse: (lastResponse) => set({ lastResponse }),
  setError: (errorMessage) => set({ errorMessage, state: 'ERROR' }),
  reset: () =>
    set({
      state: 'IDLE',
      activeGoal: null,
      currentStepIndex: -1,
      steps: [],
      lastResponse: null,
      errorMessage: null,
    }),
}));
