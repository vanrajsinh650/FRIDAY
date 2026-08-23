import { SemanticLayer } from '../src/agent/semanticLayer';
import { TranscriptAccumulator } from '../src/voice/transcriptAccumulator';
import { ResponseShaper } from '../src/voice/responseShaper';
import { VoiceStateMachine, VoiceSessionState } from '../src/voice/voiceStateMachine';
import { ReferenceResolver } from '../src/agent/memory/referenceResolver';
import { SessionManager } from '../src/agent/session/sessionManager';

describe('FRIDAY Voice UX Rewrite Components', () => {
  describe('SemanticLayer', () => {
    it('fuzzy matches and corrects misheard names without mutating original transcript', () => {
      const result = SemanticLayer.process('play songs by arijit sing on youtube', {});
      expect(result.rawTranscript).toBe('play songs by arijit sing on youtube');
      expect(result.correctedTranscript).toContain('Arijit Singh');
      expect(result.corrections.length).toBeGreaterThan(0);
      expect(result.corrections[0].original.toLowerCase()).toBe('arijit sing');
    });

    it('enforces English language pipeline across all transcripts', () => {
      const english = SemanticLayer.process('Open YouTube and play music', {});
      expect(english.detectedLanguage).toBe('en');
    });
  });

  describe('TranscriptAccumulator', () => {
    it('tracks partial transcripts and preserves the longest stable string', () => {
      const accumulator = new TranscriptAccumulator();
      accumulator.startTurn();

      accumulator.addPartial('open');
      accumulator.addPartial('open youtube');
      accumulator.addPartial('open youtube and search');

      const turn = accumulator.finalize('open youtube and search Arijit Singh', 0.95, 'silence_after_speech');
      expect(turn.rawPartials).toHaveLength(3);
      expect(turn.stableTranscript).toBe('open youtube and search');
      expect(turn.finalTranscript).toBe('open youtube and search Arijit Singh');
      expect(turn.confidence).toBe(0.95);
      expect(turn.endpointReason).toBe('silence_after_speech');
    });
  });

  describe('ResponseShaper', () => {
    it('converts formal phrasing into natural contractions and concise speech', () => {
      const formal = "I am now opening YouTube for you, boss. I have successfully found the video.";
      const shaped = ResponseShaper.shape(formal);
      expect(shaped).not.toContain("I am");
      expect(shaped).not.toContain("I have successfully");
    });
  });

  describe('VoiceStateMachine', () => {
    it('transitions through valid session states smoothly', () => {
      const sm = new VoiceStateMachine();
      expect(sm.getState()).toBe(VoiceSessionState.SLEEPING);

      expect(sm.transition(VoiceSessionState.WAKE_LISTENING)).toBe(true);
      expect(sm.transition(VoiceSessionState.WAKE_DETECTED)).toBe(true);
      expect(sm.transition(VoiceSessionState.SPEAKING)).toBe(true);
      expect(sm.transition(VoiceSessionState.LISTENING)).toBe(true);
      expect(sm.transition(VoiceSessionState.ENDPOINTING)).toBe(true);
      expect(sm.transition(VoiceSessionState.FINALIZING)).toBe(true);
      expect(sm.transition(VoiceSessionState.THINKING)).toBe(true);
    });

    it('rejects invalid state transitions', () => {
      const sm = new VoiceStateMachine();
      expect(sm.transition(VoiceSessionState.SPEAKING)).toBe(false);
      expect(sm.getState()).toBe(VoiceSessionState.SLEEPING);
    });
  });

  describe('ReferenceResolver Extended Anaphora', () => {
    beforeEach(() => {
      SessionManager.reset();
    });

    it('resolves second one and third wala', () => {
      SessionManager.addTurn('user', 'search Arijit Singh', 'com.google.android.youtube');
      SessionManager.setCurrentTask(null, 'Arijit Singh', 'com.google.android.youtube');

      const second = ReferenceResolver.resolveUserGoal('play the second one', 'com.google.android.youtube');
      expect(second.resolvedGoal).toBe('Play the second result for Arijit Singh');

      const third = ReferenceResolver.resolveUserGoal('teesra wala play karo', 'com.google.android.youtube');
      expect(third.resolvedGoal).toBe('Play the third result for Arijit Singh');
    });

    it('handles task modification prefixes like actually / wait / no', () => {
      SessionManager.addTurn('user', 'search Taarak Mehta', 'com.google.android.youtube');
      SessionManager.setCurrentTask(null, 'Taarak Mehta', 'com.google.android.youtube');

      const mod = ReferenceResolver.resolveUserGoal('actually play the first one', 'com.google.android.youtube');
      expect(mod.resolvedGoal).toBe('Play the first result for Taarak Mehta');
    });
  });
});
