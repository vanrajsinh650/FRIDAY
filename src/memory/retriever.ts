import { MemoryStore } from './store';
import { MemoryFact } from './types';

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'to', 'in', 'for', 'of', 'with',
  'my', 'please', 'can', 'you', 'me', 'i', 'do', 'it', 'this', 'that', 'there', 'here',
  'what', 'who', 'how', 'when', 'where', 'why', 'right', 'now', 'just', 'get', 'give'
]);

export class ScopedMemoryRetriever {
  /**
   * Retrieves top-k relevant facts using multi-signal scoring, fuzzy keyword matching,
   * active package awareness, and graph relationship expansion.
   */
  static retrieveRelevantFacts(
    goal: string,
    activePackage?: string,
    limit: number = 10
  ): MemoryFact[] {
    const all = MemoryStore.getAllFacts();
    if (all.length === 0) {
      return [];
    }

    const safeLimit = typeof limit === 'number' && Number.isFinite(limit) && limit > 0 ? limit : 10;
    const query = (goal || '').toLowerCase().trim();
    const queryTokens = this.tokenize(query);
    const expandedEntities = this.expandGraphEntities(query, queryTokens);

    const hasQueryContext = query.length > 0;

    const scored = all.map((fact) => {
      let score = 0;
      let directMatch = false;

      if (!hasQueryContext && !activePackage) {
        return { fact, score: 0 };
      }

      const factKeyLower = (fact.key || '').toLowerCase();
      const factValLower = (fact.value || '').toLowerCase();
      const factSubjLower = (fact.subject || '').toLowerCase();
      const factPredLower = (fact.predicate || '').toLowerCase();
      const factObjLower = (fact.object || '').toLowerCase();

      // 1. Exact phrase matches in key or value
      if (hasQueryContext && factKeyLower && query.includes(factKeyLower)) {
        score += 15;
        directMatch = true;
      }
      if (hasQueryContext && factValLower && factValLower.length > 2 && query.includes(factValLower)) {
        score += 10;
        directMatch = true;
      }

      // 2. Graph subject/predicate/object matches
      if (hasQueryContext && factPredLower && query.includes(factPredLower)) {
        score += 12;
        directMatch = true;
      }
      if (hasQueryContext && factSubjLower && query.includes(factSubjLower)) {
        score += 6;
        directMatch = true;
      }
      if (hasQueryContext && factObjLower && query.includes(factObjLower)) {
        score += 12;
        directMatch = true;
      }

      // 3. Graph-expanded entity bonus (e.g. "wife" expanded to "Pepper")
      for (const entity of expandedEntities) {
        if (entity && (factKeyLower.includes(entity) || factValLower.includes(entity) || factObjLower.includes(entity))) {
          score += 12;
          directMatch = true;
        }
      }

      // 4. Token overlap matching
      for (const token of queryTokens) {
        if (!token) continue;
        if (factKeyLower.includes(token)) {
          score += 5;
          directMatch = true;
        }
        if (factValLower.includes(token)) {
          score += 4;
          directMatch = true;
        }
        if (factPredLower.includes(token)) {
          score += 5;
          directMatch = true;
        }
        if (factObjLower.includes(token)) {
          score += 5;
          directMatch = true;
        }
      }

      // 5. Active package relevance (boosts facts matching active package or media context)
      if (activePackage && activePackage !== 'conversational') {
        const pkgLower = activePackage.toLowerCase();
        if ((factValLower && factValLower.includes(pkgLower)) || (factKeyLower && factKeyLower.includes(pkgLower))) {
          score += 8;
          directMatch = true;
        }
        if (pkgLower.includes('youtube')) {
          if (
            query.includes('watch') ||
            query.includes('video') ||
            query.includes('show') ||
            query.includes('movie') ||
            query.includes('play') ||
            query.includes('music') ||
            query.includes('song') ||
            !hasQueryContext
          ) {
            if (
              fact.category === 'PREFERENCE' ||
              factKeyLower.includes('show') ||
              factKeyLower.includes('music') ||
              factKeyLower.includes('song') ||
              factValLower.includes('show')
            ) {
              score += 10;
              directMatch = true;
            }
          }
        }
      }

      if (!directMatch) {
        return { fact, score: 0 };
      }

      // 6. Importance and confidence multiplier
      const importanceVal = typeof fact.importance === 'number' && Number.isFinite(fact.importance) ? fact.importance : 0.5;
      const confidenceVal = typeof fact.confidence === 'number' && Number.isFinite(fact.confidence) ? fact.confidence : 1.0;
      const importanceWeight = 1 + importanceVal;
      const confidenceWeight = confidenceVal;
      score = score * importanceWeight * confidenceWeight;

      // 7. Recency bonus for matched facts
      const factUpdated = typeof fact.updatedAt === 'number' && Number.isFinite(fact.updatedAt) ? fact.updatedAt : Date.now();
      const daysSinceUpdate = Math.max(0, (Date.now() - factUpdated) / (1000 * 60 * 60 * 24));
      if (Number.isFinite(daysSinceUpdate) && daysSinceUpdate < 7) {
        score += Math.max(0, 2 - daysSinceUpdate * 0.2);
      }

      return { fact, score };
    });

    const matching = scored.filter((s) => s.score > 0);
    if (matching.length > 0) {
      // Deterministic tie-breaking: score -> importance -> recency -> ID
      matching.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const impA = a.fact.importance ?? 0.5;
        const impB = b.fact.importance ?? 0.5;
        if (impB !== impA) return impB - impA;
        if (b.fact.updatedAt !== a.fact.updatedAt) return b.fact.updatedAt - a.fact.updatedAt;
        return (a.fact.id || '').localeCompare(b.fact.id || '');
      });
      return matching.slice(0, safeLimit).map((s) => s.fact);
    }

    // Fallback: return top facts sorted by importance, recency, and ID
    const sortedFallback = [...all].sort((a, b) => {
      const impA = a.importance ?? 0.5;
      const impB = b.importance ?? 0.5;
      if (impB !== impA) return impB - impA;
      if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
      return (a.id || '').localeCompare(b.id || '');
    });

    return sortedFallback.slice(0, safeLimit);
  }

  /**
   * Formats retrieved facts and relationship graph into a query-scoped context string
   * ready for injection into system prompts.
   */
  static formatContext(goal: string, activePackage?: string): string {
    const profile = MemoryStore.getProfile();
    const facts = this.retrieveRelevantFacts(goal, activePackage, 8);
    const relationships = MemoryStore.getAllRelationships();

    const sections: string[] = [];

    // 1. Profile Summary
    sections.push(`[USER IDENTITY]`);
    sections.push(`User: Boss`);
    if (profile.preferredMusicApp || profile.preferredMapApp) {
      sections.push(`Preferences: Music=${profile.preferredMusicApp || 'youtube'}, Navigation=${profile.preferredMapApp || 'google-maps'}`);
    }

    // 2. Relevant Facts
    if (facts.length > 0) {
      sections.push(`\n[RELEVANT RETRIEVED MEMORY]`);
      for (const fact of facts) {
        sections.push(`- ${fact.key}: ${fact.value}`);
      }
    }

    // 3. Relevant Relationships
    const query = (goal || '').toLowerCase().trim();
    const relevantRels = query
      ? relationships.filter(
          (r) =>
            (r.subject && query.includes(r.subject.toLowerCase())) ||
            (r.predicate && query.includes(r.predicate.toLowerCase())) ||
            (r.object && query.includes(r.object.toLowerCase()))
        )
      : [];

    if (relevantRels.length > 0) {
      sections.push(`\n[RELEVANT RELATIONSHIPS]`);
      for (const rel of relevantRels) {
        sections.push(`- ${rel.subject} -> (${rel.predicate}) -> ${rel.object}`);
      }
    }

    return sections.join('\n');
  }

  /**
   * Formats an array of facts into standard `- key: value` lines.
   */
  static formatFactsForPrompt(facts: MemoryFact[]): string {
    if (!facts || facts.length === 0) return 'No relevant memories.';
    return facts.map((f) => `- ${f.key}: ${f.value}`).join('\n');
  }

  private static tokenize(text: string): string[] {
    if (!text || typeof text !== 'string') return [];
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
  }

  private static expandGraphEntities(query: string, tokens: string[]): string[] {
    const expanded: string[] = [];
    if (!query && (!tokens || tokens.length === 0)) return expanded;

    const relKeywords = ['wife', 'husband', 'mom', 'mother', 'dad', 'father', 'boss', 'brother', 'sister', 'friend', 'assistant', 'colleague', 'manager'];

    for (const kw of relKeywords) {
      if ((query && query.includes(kw)) || (tokens && tokens.includes(kw))) {
        const target = MemoryStore.resolveRelationship('user', kw);
        if (target) {
          expanded.push(target.toLowerCase());
        }
      }
    }

    return expanded;
  }
}
