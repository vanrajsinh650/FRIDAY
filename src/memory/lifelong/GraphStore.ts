// src/memory/lifelong/GraphStore.ts

import { EntityRecord, RelationshipRecord } from './types';

export class GraphStore {
  private entities: Map<string, EntityRecord> = new Map();
  private relationships: Map<string, RelationshipRecord> = new Map();
  // Adjacency map: sourceEntityId -> Array of RelationshipRecord
  private adjacency: Map<string, RelationshipRecord[]> = new Map();

  upsertEntity(entity: EntityRecord): void {
    this.entities.set(entity.id.toLowerCase(), entity);
    this.entities.set(entity.name.toLowerCase(), entity);
    for (const alias of entity.aliases || []) {
      this.entities.set(alias.toLowerCase(), entity);
    }
  }

  getEntity(idOrName: string): EntityRecord | undefined {
    return this.entities.get(idOrName.toLowerCase().trim());
  }

  getAllEntities(): EntityRecord[] {
    const unique = new Map<string, EntityRecord>();
    for (const ent of this.entities.values()) {
      unique.set(ent.id, ent);
    }
    return Array.from(unique.values());
  }

  addRelationship(rel: RelationshipRecord): void {
    const key = `${rel.sourceEntityId.toLowerCase()}:${rel.relationType.toLowerCase()}:${rel.targetEntityId.toLowerCase()}`;
    this.relationships.set(key, rel);

    const adj = this.adjacency.get(rel.sourceEntityId.toLowerCase()) || [];
    adj.push(rel);
    this.adjacency.set(rel.sourceEntityId.toLowerCase(), adj);
  }

  getRelationships(sourceId?: string, relationType?: string): RelationshipRecord[] {
    const all = Array.from(this.relationships.values());
    return all.filter((r) => {
      if (sourceId && r.sourceEntityId.toLowerCase() !== sourceId.toLowerCase()) return false;
      if (relationType && r.relationType.toLowerCase() !== relationType.toLowerCase()) return false;
      return true;
    });
  }

  /**
   * Personalized PageRank (PPR) Spreading Activation (HippoRAG style).
   * Spreads activation probabilities from seed entities across associative graph edges.
   */
  personalizedPageRank(
    seedEntityIds: string[],
    iterations: number = 10,
    damping: number = 0.85
  ): Map<string, number> {
    const scores = new Map<string, number>();
    if (!seedEntityIds || seedEntityIds.length === 0) return scores;

    // 1. Initialize teleport distribution
    const seedSet = new Set(seedEntityIds.map((s) => s.toLowerCase()));
    const teleportProb = 1.0 / seedSet.size;

    for (const seed of seedSet) {
      scores.set(seed, teleportProb);
    }

    const allNodes = new Set<string>();
    for (const rel of this.relationships.values()) {
      allNodes.add(rel.sourceEntityId.toLowerCase());
      allNodes.add(rel.targetEntityId.toLowerCase());
    }

    // 2. Power Iteration
    for (let iter = 0; iter < iterations; iter++) {
      const nextScores = new Map<string, number>();

      for (const node of allNodes) {
        const outEdges = this.adjacency.get(node) || [];
        const currentScore = scores.get(node) || 0;
        if (currentScore <= 0 || outEdges.length === 0) continue;

        const weightPerEdge = (currentScore * damping) / outEdges.length;
        for (const edge of outEdges) {
          const target = edge.targetEntityId.toLowerCase();
          nextScores.set(target, (nextScores.get(target) || 0) + weightPerEdge);
        }
      }

      // Add teleport component back to seeds
      for (const seed of seedSet) {
        const base = (1.0 - damping) * teleportProb;
        nextScores.set(seed, (nextScores.get(seed) || 0) + base);
      }

      for (const [node, score] of nextScores.entries()) {
        scores.set(node, score);
      }
    }

    return scores;
  }
}
