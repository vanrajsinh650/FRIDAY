// src/memory/lifelong/VectorIndex.ts

import { EmbeddingProvider } from './EmbeddingProvider';

export interface VectorItem {
  id: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

export interface NearestMatch {
  id: string;
  similarity: number;
  metadata?: Record<string, any>;
}

export class VectorIndex {
  private items: Map<string, VectorItem> = new Map();

  upsert(id: string, embedding: number[], metadata?: Record<string, any>): void {
    this.items.set(id, { id, embedding, metadata });
  }

  delete(id: string): boolean {
    return this.items.delete(id);
  }

  get(id: string): VectorItem | undefined {
    return this.items.get(id);
  }

  clear(): void {
    this.items.clear();
  }

  size(): number {
    return this.items.size;
  }

  /**
   * Finds top-K nearest neighbors using cosine similarity.
   */
  search(queryEmbedding: number[], topK: number = 5, minSimilarity: number = 0.0): NearestMatch[] {
    const matches: NearestMatch[] = [];

    for (const item of this.items.values()) {
      const sim = EmbeddingProvider.cosineSimilarity(queryEmbedding, item.embedding);
      if (sim >= minSimilarity) {
        matches.push({
          id: item.id,
          similarity: sim,
          metadata: item.metadata,
        });
      }
    }

    return matches.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }
}
