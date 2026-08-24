import { ScreenTree, UINode } from '../../native/types';

// Reason over a list of on-screen results instead of blindly taking the first.
//
// The accessibility tree of a results screen (YouTube search, a file list, a
// contact list) exposes each item as a clickable node whose `text` is the title
// and whose `contentDescription` often carries metadata ("15M views • 3 years
// ago"). This ranker scores those candidates against what the user actually
// asked for, so "play the Taarak Mehta holi episode" lands on the holi episode
// rather than whatever card happens to be first.
//
// It is deliberately pure (tree + query in, ranking out) so it is trivially unit
// tested and carries no side effects or native dependencies.

export interface RankedResult {
  node: UINode;
  score: number;
  matchedTitle: string;
}

// Words that carry no discriminating signal — dropping them keeps the overlap
// score focused on the meaningful tokens of the request.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'video',
  'song', 'play', 'watch', 'full', 'episode', 'ka', 'ki', 'ke', 'par', 'pe', 'me',
]);

// Chrome/controls that are clickable but are never a "result" to open.
const CHROME_HINTS = [
  'search', 'back', 'menu', 'settings', 'account', 'notification', 'tab',
  'home', 'shorts', 'subscriptions', 'library', 'filter', 'sort', 'more options',
];

// Items we should actively avoid selecting even if the title matches, because
// they are not the thing the user wants to watch.
const NEGATIVE_HINTS = ['advertisement', 'sponsored', ' ad ', 'mix -', 'mix ·', 'live now'];

function tokenize(s: string): string[] {
  return (s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// Parse "15M views", "1.2K views", "3,024 views" → an absolute number, so a
// well-matched-but-obscure clip still beats a barely-matched viral one only by a
// small, logarithmic margin (popularity is a tie-breaker, not the main signal).
function parseViewCount(desc: string): number {
  const m = (desc || '').toLowerCase().match(/([\d.,]+)\s*([kmb])?\s*views?/);
  if (!m) return 0;
  const num = parseFloat(m[1].replace(/,/g, ''));
  if (isNaN(num)) return 0;
  const mult = m[2] === 'b' ? 1e9 : m[2] === 'm' ? 1e6 : m[2] === 'k' ? 1e3 : 1;
  return num * mult;
}

export class ResultRanker {
  // A candidate is a clickable, visible node with a title long enough to be a
  // real content item — not a search box, nav chrome, or a bare icon.
  static isResultCandidate(node: UINode, tree: ScreenTree): boolean {
    if (!node.isClickable || !node.isVisible || node.isEditable) return false;
    const title = (node.text || node.contentDescription || '').trim();
    if (title.length < 4) return false;

    const hay = `${node.text || ''} ${node.contentDescription || ''} ${node.id || ''}`.toLowerCase();
    // Strictly exclude voice search mic buttons and navigation chrome
    if (hay.includes('voice') || hay.includes('mic') || hay.includes('search with your voice')) return false;
    if (CHROME_HINTS.some((h) => hay.includes(h))) return false;

    // A result card occupies a meaningful slice of the screen width. Guard
    // against divide-by-zero for degenerate trees.
    if (tree.screenWidth > 0 && node.bounds.width < tree.screenWidth * 0.35) return false;
    return true;
  }

  static rankResults(tree: ScreenTree, query: string): RankedResult[] {
    const qTokens = tokenize(query);
    if (qTokens.length === 0) return [];

    const candidates = tree.nodes.filter((n) => this.isResultCandidate(n, tree));
    const maxViews = Math.max(1, ...candidates.map((c) => parseViewCount(c.contentDescription || '')));

    const ranked = candidates.map((node, index) => {
      const title = (node.text || node.contentDescription || '').trim();
      const titleTokens = new Set(tokenize(title));
      const overlap = qTokens.filter((t) => titleTokens.has(t)).length;
      const coverage = overlap / qTokens.length; // 0..1 — how much of the request the title covers

      let score = coverage * 100 + overlap * 10;

      // Popularity: a small logarithmic nudge so it only decides near-ties.
      const views = parseViewCount(node.contentDescription || '');
      if (views > 0) score += (Math.log10(views) / Math.log10(maxViews)) * 8;

      // Earlier items are marginally preferred when everything else is equal
      // (the platform already ranked them).
      score += Math.max(0, 3 - index * 0.5);

      const meta = `${title} ${node.contentDescription || ''}`.toLowerCase();
      if (NEGATIVE_HINTS.some((h) => meta.includes(h))) score -= 40;

      return { node, score, matchedTitle: title };
    });

    return ranked.sort((a, b) => b.score - a.score);
  }

  // Best result whose title genuinely overlaps the query. Returns null when the
  // query is empty (generic "just play something" — caller takes the first card)
  // or when nothing clears a minimal relevance bar (avoid confidently opening an
  // irrelevant item; the caller falls back to the platform's own first result).
  static pickBestResult(tree: ScreenTree, query: string): RankedResult | null {
    if (!query || query.trim().length === 0) return null;
    const ranked = this.rankResults(tree, query);
    if (ranked.length === 0) return null;
    const best = ranked[0];
    const qTokens = tokenize(query);
    const titleTokens = new Set(tokenize(best.matchedTitle));
    const hasOverlap = qTokens.some((t) => titleTokens.has(t));
    return hasOverlap ? best : null;
  }
}
