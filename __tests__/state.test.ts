import { useAgentStore } from '../src/state/agentStore';
import { useVoiceStore } from '../src/state/voiceStore';

describe('Zustand State Stores', () => {
  test('agentStore updates state and tracks steps', () => {
    useAgentStore.getState().reset();
    expect(useAgentStore.getState().state).toBe('IDLE');

    useAgentStore.getState().setActiveGoal('Test Goal');
    expect(useAgentStore.getState().activeGoal).toBe('Test Goal');

    const stepId = useAgentStore.getState().addStep({
      toolName: 'launch_app',
      description: 'Launching test app',
    });

    expect(useAgentStore.getState().steps.length).toBe(1);
    useAgentStore.getState().updateStepStatus(stepId, 'success', { ok: true });
    expect(useAgentStore.getState().steps[0].status).toBe('success');
  });

  test('voiceStore manages voice audio stream state', () => {
    useVoiceStore.getState().setRecording(true);
    expect(useVoiceStore.getState().isRecording).toBe(true);

    useVoiceStore.getState().setRmsLevel(0.75);
    expect(useVoiceStore.getState().rmsLevel).toBe(0.75);
  });
});
