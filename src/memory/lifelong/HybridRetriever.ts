// src/memory/lifelong/HybridRetriever.ts

import { SemanticFactRecord, MemorySearchResult } from './types';
import { VectorIndex } from './VectorIndex';
import { GraphStore } from './GraphStore';
import { EmbeddingProvider } from './EmbeddingProvider';
import { TemporalDecay } from './TemporalDecay';

export class HybridRetriever {
  private static readonly RRF_K = 60.0;
  private static readonly WEIGHT_BM25 = 1.0;
  private static readonly WEIGHT_VECTOR = 1.2;
  private static readonly WEIGHT_GRAPH = 1.5;

  /**
   * Executes multi-source hybrid search across BM25 sparse matching, Dense Vector Index, and Graph PPR.
   */
  static search(
    query: string,
    facts: SemanticFactRecord[],
    vectorIndex: VectorIndex,
    graphStore: GraphStore,
    topK: number = 5
  ): MemorySearchResult[] {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery || facts.length === 0) return [];

    const queryTokens = cleanQuery.split(/\s+/).filter((w) => w.length > 1);
    const queryEmbedding = EmbeddingProvider.generateEmbedding(cleanQuery);
    const rankMap = new Map<string, { rrf: number; source: MemorySearchResult['source'] }>();

    // 1. Sparse BM25 / Keyword Retrieval
    const keywordMatches = facts
      .filter((f) => f.isActive)
      .map((fact) => {
        const text = fact.factText.toLowerCase();
        let matches = 0;
        for (const token of queryTokens) {
          if (text.includes(token)) matches++;
        }
        return { fact, score: matches };
      })
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    keywordMatches.forEach((m, idx) => {
      const rrf = this.WEIGHT_BM25 / (this.RRF_K + (idx + 1));
      const cur = rankMap.get(m.fact.id) || { rrf: 0, source: 'FTS_BM25' };
      rankMap.set(m.fact.id, { rrf: cur.rrf + rrf, source: cur.source });
    });

    // 2. Dense Vector Semantic Retrieval (KNN)
    const vectorMatches = vectorIndex.search(queryEmbedding, 20, 0.25);
    vectorMatches.forEach((m, idx) => {
      const rrf = this.WEIGHT_VECTOR / (this.RRF_K + (idx + 1));
      const cur = rankMap.get(m.id) || { rrf: 0, source: 'DENSE_VECTOR' };
      rankMap.set(m.id, {
        rrf: cur.rrf + rrf,
        source: cur.source === 'FTS_BM25' ? 'HYBRID' : 'DENSE_VECTOR',
      });
    });

    // 3. Graph Associative Spreading Activation (HippoRAG PPR)
    const seedEntities = queryTokens.filter((token) => graphStore.getEntity(token) !== undefined);
    if (seedEntities.length > 0) {
      const pprScores = graphStore.personalizedPageRank(seedEntities, 10, 0.85);
      const sortedNodes = Array.from(pprScores.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);

      sortedNodes.forEach(([entityName, _prob], idx) => {
        // Find facts linked to activated entities
        const relatedFacts = facts.filter(
          (f) => f.isActive && f.factText.toLowerCase().includes(entityName.toLowerCase())
        );
        for (const rf of relatedFacts) {
          const rrf = this.WEIGHT_GRAPH / (this.RRF_K + (idx + 1));
          const cur = rankMap.get(rf.id) || { rrf: 0, source: 'GRAPH_PPR' };
          rankMap.set(rf.id, { rrf: cur.rrf + rrf, source: 'HYBRID' });
        }
      });
    }

    // 4. Fuse scores with Ebbinghaus Temporal Decay
    const factMap = new Map(facts.map((f) => [f.id, f]));
    const results: MemorySearchResult[] = [];

    for (const [factId, { rrf, source }] of rankMap.entries()) {
      const fact = factMap.get(factId);
      if (!fact || !fact.isActive) continue;

      const retention = TemporalDecay.computeRetention(
        fact.importance,
        fact.lastAccessedAt,
        fact.accessCount
      );

      const finalScore = rrf * retention;

      results.push({
        factId: fact.id,
        factText: fact.factText,
        category: fact.category,
        rrfScore: finalScore,
        importance: fact.importance,
        lastAccessedAt: fact.lastAccessedAt,
        source,
      });
    }

    return results.sort((a, b) => b.rrfScore - a.rrfScore).slice(0, topK);
  }
}
