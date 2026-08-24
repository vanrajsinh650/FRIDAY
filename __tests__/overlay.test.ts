import { FloatingOverlayModule } from '../src/native/FloatingOverlayModule';
import { FridayAgent } from '../src/agent/agent';
import { useAgentStore } from '../src/state/agentStore';
import { AccessibilityModule } from '../src/native/AccessibilityModule';
import { VoicePipeline } from '../src/voice/voicePipeline';
import { DeviceEventEmitter, NativeModules } from 'react-native';

describe('FloatingOverlayModule & 24/7 Persistent HUD Integration', () => {
  beforeEach(() => {
    FloatingOverlayModule.resetMockState();
    useAgentStore.getState().reset();
    AccessibilityModule.resetMockTree();
    jest.spyOn(AccessibilityModule, 'isServiceEnabled').mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('FloatingOverlayModule Core Methods', () => {
    test('checkOverlayPermission returns true in test environment', async () => {
      const permitted = await FloatingOverlayModule.checkOverlayPermission();
      expect(permitted).toBe(true);
    });

    test('requestOverlayPermission resolves successfully', async () => {
      const requested = await FloatingOverlayModule.requestOverlayPermission();
      expect(requested).toBe(true);
    });

    test('showOverlay updates mock state and marks overlay as showing', async () => {
      expect(FloatingOverlayModule.isMockShowing()).toBe(false);

      const result = await FloatingOverlayModule.showOverlay('Opening YouTube...', 'EXECUTING');
      expect(result).toBe(true);
      expect(FloatingOverlayModule.isMockShowing()).toBe(true);

      const state = FloatingOverlayModule.getMockState();
      expect(state.statusText).toBe('Opening YouTube...');
      expect(state.state).toBe('EXECUTING');
    });

    test('updateOverlay modifies status text and execution state without resetting visibility', async () => {
      await FloatingOverlayModule.showOverlay('Planning...', 'PLANNING');
      expect(FloatingOverlayModule.isMockShowing()).toBe(true);

      await FloatingOverlayModule.updateOverlay('Playing video...', 'EXECUTING');
      const updatedState = FloatingOverlayModule.getMockState();
      expect(updatedState.statusText).toBe('Playing video...');
      expect(updatedState.state).toBe('EXECUTING');
      expect(FloatingOverlayModule.isMockShowing()).toBe(true);
    });

    test('hideOverlay dismisses the HUD and marks visibility as false', async () => {
      await FloatingOverlayModule.showOverlay('Active Task', 'EXECUTING');
      expect(FloatingOverlayModule.isMockShowing()).toBe(true);

      const hidden = await FloatingOverlayModule.hideOverlay();
      expect(hidden).toBe(true);
      expect(FloatingOverlayModule.isMockShowing()).toBe(false);
    });

    test('showOverlay handles false return from native module by unsetting mockShowing', async () => {
      const mockNative = (NativeModules as any).FridayFloatingOverlayNative;
      mockNative.showOverlay = jest.fn().mockResolvedValue(false);

      const result = await FloatingOverlayModule.showOverlay('Denied Test', 'PLANNING');
      expect(result).toBe(false);
      expect(FloatingOverlayModule.isMockShowing()).toBe(false);

      delete mockNative.showOverlay;
    });

    test('supports SPEAKING state and updates correctly', async () => {
      await FloatingOverlayModule.showOverlay('Speaking...', 'SPEAKING');
      expect(FloatingOverlayModule.isMockShowing()).toBe(true);
      const state = FloatingOverlayModule.getMockState();
      expect(state.statusText).toBe('Speaking...');
      expect(state.state).toBe('SPEAKING');
    });

    test('gracefully handles native module exceptions without crashing', async () => {
      const mockNative = (NativeModules as any).FridayFloatingOverlayNative;
      mockNative.showOverlay = jest.fn().mockRejectedValue(new Error('WindowManager crash simulation'));
      mockNative.updateOverlay = jest.fn().mockRejectedValue(new Error('RemoteServiceException'));
      mockNative.hideOverlay = jest.fn().mockRejectedValue(new Error('ViewNotAttachedException'));
      mockNative.checkOverlayPermission = jest.fn().mockRejectedValue(new Error('SecurityException'));
      mockNative.requestOverlayPermission = jest.fn().mockRejectedValue(new Error('ActivityNotFoundException'));

      expect(await FloatingOverlayModule.showOverlay('Test', 'IDLE')).toBe(false);
      expect(await FloatingOverlayModule.updateOverlay('Test', 'IDLE')).toBe(false);
      expect(await FloatingOverlayModule.hideOverlay()).toBe(false);
      expect(await FloatingOverlayModule.checkOverlayPermission()).toBe(false);
      expect(await FloatingOverlayModule.requestOverlayPermission()).toBe(false);

      delete mockNative.showOverlay;
      delete mockNative.updateOverlay;
      delete mockNative.hideOverlay;
      delete mockNative.checkOverlayPermission;
      delete mockNative.requestOverlayPermission;
    });
  });

  describe('AgentLoop Overlay Live Status Synchronization', () => {
    test('updates floating overlay HUD during multi-step automation', async () => {
      const agent = new FridayAgent();
      const showSpy = jest.spyOn(FloatingOverlayModule, 'showOverlay');
      const updateSpy = jest.spyOn(FloatingOverlayModule, 'updateOverlay');

      await agent.executeGoal('Open YouTube and play Taarak Mehta funny episode');

      // Verify that showOverlay was called when planning and executing actions
      expect(showSpy).toHaveBeenCalled();
      const showCalls = showSpy.mock.calls;
      expect(showCalls.some((c) => c[1] === 'PLANNING' || c[1] === 'EXECUTING')).toBe(true);

      // Verify final verification passed update
      expect(updateSpy).toHaveBeenCalledWith('Verified ✓', 'SUCCESS');
      expect(FloatingOverlayModule.getMockState().state).toBe('SUCCESS');
      expect(FloatingOverlayModule.getMockState().statusText).toBe('Verified ✓');
    });

    test('updates floating overlay HUD with verified state on Tier-0 intent fast-path', async () => {
      const agent = new FridayAgent();
      const updateSpy = jest.spyOn(FloatingOverlayModule, 'updateOverlay');

      await agent.executeGoal('hey friday');

      expect(updateSpy).toHaveBeenCalledWith('Verified ✓', 'SUCCESS');
      expect(FloatingOverlayModule.getMockState().state).toBe('SUCCESS');
    });
  });

  describe('VoicePipeline Overlay Live State Integration', () => {
    test('shows listening state on wake word detection trigger', async () => {
      VoicePipeline.initializeWakeWordListener();
      const showSpy = jest.spyOn(FloatingOverlayModule, 'showOverlay');

      DeviceEventEmitter.emit('onWakeWordDetected', {
        wakeWord: 'friday',
        command: 'what is my battery level',
        fullText: 'friday what is my battery level',
      });

      // Allow microtask ticks for event processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(showSpy).toHaveBeenCalledWith('Listening...', 'LISTENING');
    });

    test('updates overlay state on interrupt', () => {
      const updateSpy = jest.spyOn(FloatingOverlayModule, 'updateOverlay');
      VoicePipeline.interrupt();

      expect(updateSpy).toHaveBeenCalledWith('Interrupted', 'IDLE');
      expect(FloatingOverlayModule.getMockState().statusText).toBe('Interrupted');
      expect(FloatingOverlayModule.getMockState().state).toBe('IDLE');
    });
  });
});
