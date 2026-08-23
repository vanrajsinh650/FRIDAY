import { ResultRanker } from '../src/agent/perception/resultRanker';
import { Planner } from '../src/agent/planner';
import { ScreenTree, UINode } from '../src/native/types';

// --- helpers ----------------------------------------------------------------

function node(partial: Partial<UINode> & { id: string }): UINode {
  const width = partial.bounds?.width ?? 1000;
  return {
    className: 'android.view.ViewGroup',
    isClickable: true,
    isEditable: false,
    isScrollable: false,
    isVisible: true,
    packageName: 'com.google.android.youtube',
    bounds: { left: 20, top: 300, right: 20 + width, bottom: 900, centerX: 20 + width / 2, centerY: 600, width, height: 600 },
    ...partial,
  } as UINode;
}

function tree(nodes: UINode[], activePackage = 'com.google.android.youtube'): ScreenTree {
  return { activePackage, nodes, timestamp: 1, screenWidth: 1000, screenHeight: 2400 };
}

describe('ResultRanker — reasoning over a result list', () => {
  test('selects the title that matches the query, not merely the most-viewed', () => {
    const t = tree([
      node({ id: 'a', text: 'Taarak Mehta Ka Ooltah Chashmah - Holi Special', contentDescription: '2M views • 4 years ago' }),
      node({ id: 'b', text: 'Taarak Mehta Ka Ooltah Chashmah - Diwali Episode', contentDescription: '25M views • 3 years ago' }),
      node({ id: 'c', text: 'Comedy Nights Bachao Full Show', contentDescription: '80M views • 5 years ago' }),
    ]);

    const best = ResultRanker.pickBestResult(t, 'taarak mehta holi');
    expect(best).not.toBeNull();
    expect(best!.node.id).toBe('a'); // holi match wins despite b/c having more views
  });

  test('a strong title match beats a weak match with far more views (popularity is only a tie-breaker)', () => {
    const t = tree([
      node({ id: 'weak', text: 'Lofi Beats Radio', contentDescription: '120M views' }),
      node({ id: 'strong', text: 'Lofi Study Session Playlist', contentDescription: '90 views' }),
    ]);
    const best = ResultRanker.pickBestResult(t, 'lofi study session');
    expect(best!.node.id).toBe('strong');
  });

  test('returns null for an empty/generic query so the caller takes the first card', () => {
    const t = tree([node({ id: 'a', text: 'Some Random Video Title', contentDescription: '1M views' })]);
    expect(ResultRanker.pickBestResult(t, '')).toBeNull();
    expect(ResultRanker.rankResults(t, '   ')).toHaveLength(0);
  });

  test('returns null when nothing genuinely overlaps the query', () => {
    const t = tree([
      node({ id: 'a', text: 'Cooking Pasta At Home', contentDescription: '3M views' }),
      node({ id: 'b', text: 'Guitar Lessons For Beginners', contentDescription: '5M views' }),
    ]);
    expect(ResultRanker.pickBestResult(t, 'quantum physics lecture')).toBeNull();
  });

  test('excludes search boxes, nav chrome, and undersized nodes from candidates', () => {
    const t = tree([
      node({ id: 'search_edit_text', text: 'Search YouTube', isEditable: true }),
      node({ id: 'search_button', contentDescription: 'Search', text: '' }),
      node({ id: 'tab', text: 'Shorts tab', bounds: { left: 0, top: 0, right: 100, bottom: 100, centerX: 50, centerY: 50, width: 100, height: 100 } }),
      node({ id: 'real', text: 'Taarak Mehta Best Comedy Scenes', contentDescription: '10M views' }),
    ]);
    const ranked = ResultRanker.rankResults(t, 'taarak mehta comedy');
    expect(ranked).toHaveLength(1);
    expect(ranked[0].node.id).toBe('real');
  });

  test('penalizes sponsored/ad items against a clean match of equal relevance', () => {
    const t = tree([
      node({ id: 'ad', text: 'Best Phone Review 2024', contentDescription: 'Sponsored' }),
      node({ id: 'organic', text: 'Best Phone Review Guide', contentDescription: '1M views' }),
    ]);
    const best = ResultRanker.pickBestResult(t, 'phone review');
    expect(best!.node.id).toBe('organic');
  });
});

describe('Planner — reasoned result selection', () => {
  // A stub provider so constructing the planner never touches the network; the
  // MEDIA_PLAYBACK press_enter path returns before any provider call anyway.
  const stubProvider = {
    name: 'stub',
    generateText: async () => '',
    generateToolCall: async () => ({ toolName: 'none', parameters: {} }),
  } as any;

  test('after submitting the search, taps the ranked node id rather than a blind first result', async () => {
    const planner = new Planner(stubProvider);

    const screenTree = tree([
      node({ id: 'search_edit_text', text: 'taarak mehta holi', isEditable: true }),
      node({ id: 'vid_holi', text: 'Taarak Mehta Ka Ooltah Chashmah Holi Dhamaal', contentDescription: '1M views' }),
      node({ id: 'vid_diwali', text: 'Taarak Mehta Ka Ooltah Chashmah Diwali', contentDescription: '40M views' }),
    ]);

    const snapshot: any = {
      activeGoal: 'play taarak mehta holi episode on youtube',
      goalType: 'MEDIA_PLAYBACK',
      screenTree,
      memoryFacts: [],
      recentActionHistory: [],
      conversationHistory: [],
      activeTask: {
        rawGoal: 'play taarak mehta holi episode on youtube',
        goalType: 'MEDIA_PLAYBACK',
        actionHistory: [
          { toolName: 'launch_app' },
          { toolName: 'click_node' },
          { toolName: 'type_text' },
          { toolName: 'press_enter' },
        ],
      },
    };

    const action = await planner.planNextAction(snapshot);
    expect(action.toolName).toBe('click_first_result');
    expect(action.parameters.nodeId).toBe('vid_holi'); // holi match, not the more-viewed diwali card
  });
});
