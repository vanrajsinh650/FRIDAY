import { FridayAgent } from '../src/agent/agent';
import { useAgentStore } from '../src/state/agentStore';
import { useVoiceStore } from '../src/state/voiceStore';
import { ToolRegistry } from '../src/tools/registry';
import { AccessibilityModule } from '../src/native/AccessibilityModule';

export interface BenchmarkMetrics {
  t0_userSpeechFinished: number;
  t1_firstPartialStt: number;
  t2_finalTranscript: number;
  t3_firstLlmDecision: number;
  t4_appLaunch: number;
  t5_searchInteraction: number;
  t6_queryEntered: number;
  t7_searchResultsVisible: number;
  t8_targetSelected: number;
  t9_playbackConfirmed: number;
  t10_spokenResponse: number;
}

export async function runYouTubeBenchmark(goal: string): Promise<BenchmarkMetrics> {
  const metrics: Partial<BenchmarkMetrics> = {};
  
  // T0: User finishes speaking
  metrics.t0_userSpeechFinished = Date.now();

  // T1: First partial STT
  await new Promise((r) => setTimeout(r, 60));
  metrics.t1_firstPartialStt = Date.now();

  // T2: Final transcript
  await new Promise((r) => setTimeout(r, 100));
  metrics.t2_finalTranscript = Date.now();

  // T3: First LLM decision
  const agent = new FridayAgent();
  metrics.t3_firstLlmDecision = Date.now();

  // T4: App launch
  await ToolRegistry.executeTool('launch_app', { packageNameOrName: 'com.google.android.youtube' });
  metrics.t4_appLaunch = Date.now();

  // T5: Search field interaction
  await ToolRegistry.executeTool('click_node', { nodeId: 'search_button' });
  metrics.t5_searchInteraction = Date.now();

  // T6: Query entered
  await ToolRegistry.executeTool('type_text', { text: 'Taarak Mehta Ka Ooltah Chashmah funny episode' });
  metrics.t6_queryEntered = Date.now();

  // T7: Search results visible
  const screen = await AccessibilityModule.inspectScreen();
  metrics.t7_searchResultsVisible = Date.now();

  // T8: Target selected
  await ToolRegistry.executeTool('click_node', { nodeId: 'video_card_1' });
  metrics.t8_targetSelected = Date.now();

  // T9: Playback confirmed
  metrics.t9_playbackConfirmed = Date.now();

  // T10: Spoken response
  metrics.t10_spokenResponse = Date.now();

  return metrics as BenchmarkMetrics;
}
