// src/memory/lifelong/LifelongMemoryEngine.ts

import {
  EntityRecord,
  RelationshipRecord,
  SemanticFactRecord,
  EpisodicTrajectoryRecord,
  MemorySearchResult,
  FactCategory,
} from './types';
import { VectorIndex } from './VectorIndex';
import { GraphStore } from './GraphStore';
import { EmbeddingProvider } from './EmbeddingProvider';
import { ConflictArbiter } from './ConflictArbiter';
import { HybridRetriever } from './HybridRetriever';
import { FactExtractor } from './FactExtractor';
import { TrajectoryRecorder } from './TrajectoryRecorder';
import { SystemControlModule } from '../../native/SystemControlModule';

export class LifelongMemoryEngine {
  private static instance: LifelongMemoryEngine | null = null;

  private facts: Map<string, SemanticFactRecord> = new Map();
  private trajectories: Map<string, EpisodicTrajectoryRecord> = new Map();
  private vectorIndex: VectorIndex = new VectorIndex();
  private graphStore: GraphStore = new GraphStore();
  private trajectoryRecorder: TrajectoryRecorder = new TrajectoryRecorder();
  private isInitialized = false;

  private constructor() {}

  static getInstance(): LifelongMemoryEngine {
    if (!this.instance) {
      this.instance = new LifelongMemoryEngine();
    }
    return this.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.initDefaultPersonaGraph();
      const raw = await SystemControlModule.loadMemoryFile();
      if (raw && raw.trim().length > 0) {
        const data = JSON.parse(raw);
        if (data && typeof data === 'object') {
          if (Array.isArray(data.facts)) {
            for (const f of data.facts) {
              if (!f || !f.id || !f.factText) continue;
              const emb = f.embedding || EmbeddingProvider.generateEmbedding(f.factText);
              f.embedding = emb;
              this.facts.set(f.id, f);
              this.vectorIndex.upsert(f.id, emb, { category: f.category });
            }
          }

          if (Array.isArray(data.entities)) {
            for (const ent of data.entities) {
              this.graphStore.upsertEntity(ent);
            }
          }

          if (Array.isArray(data.relationships)) {
            for (const rel of data.relationships) {
              this.graphStore.addRelationship(rel);
            }
          }

          if (Array.isArray(data.trajectories)) {
            for (const t of data.trajectories) {
              this.trajectories.set(t.id, t);
            }
          }
        }
      }
    } catch (_e) {
      this.initDefaultPersonaGraph();
    } finally {
      this.isInitialized = true;
    }
  }

  private initDefaultPersonaGraph(): void {
    const now = Date.now();

    // Default Entities
    const userEntity: EntityRecord = {
      id: 'ent_user',
      name: 'Boss',
      category: 'person',
      aliases: ['user', 'tony', 'tony stark'],
      attributes: { title: 'Boss' },
      createdAt: now,
      updatedAt: now,
      accessCount: 1,
      lastAccessedAt: now,
    };
    const fridayEntity: EntityRecord = {
      id: 'ent_friday',
      name: 'FRIDAY',
      category: 'person',
      aliases: ['assistant', 'ai', 'friday'],
      attributes: { role: 'Autonomous Mobile AI' },
      createdAt: now,
      updatedAt: now,
      accessCount: 1,
      lastAccessedAt: now,
    };

    this.graphStore.upsertEntity(userEntity);
    this.graphStore.upsertEntity(fridayEntity);

    // Default Graph Relations
    this.graphStore.addRelationship({
      id: 'rel_friday_assistant_user',
      sourceEntityId: 'ent_friday',
      targetEntityId: 'ent_user',
      relationType: 'assistant_to',
      weight: 1.0,
      confidence: 1.0,
      createdAt: now,
      updatedAt: now,
    });
  }

  // --- Fact Ingestion & Continuous Conflict Resolution ---

  async ingestFact(
    text: string,
    category: FactCategory = 'preference',
    importance: number = 0.8
  ): Promise<SemanticFactRecord | null> {
    const evaluation = ConflictArbiter.evaluateFact(text, Array.from(this.facts.values()));

    if (evaluation.action === 'NO_OP') {
      if (evaluation.targetFactId) {
        const existing = this.facts.get(evaluation.targetFactId);
        if (existing) {
          existing.accessCount++;
          existing.lastAccessedAt = Date.now();
          await this.persist();
          return existing;
        }
      }
      return null;
    }

    const now = Date.now();

    if (evaluation.action === 'UPDATE' && evaluation.targetFactId) {
      const old = this.facts.get(evaluation.targetFactId);
      if (old) {
        old.isActive = false;
        old.validTo = now;
      }
    }

    const factText = evaluation.refinedFactText || text;
    const embedding = EmbeddingProvider.generateEmbedding(factText);
    const factId = `fact_${now}_${Math.random().toString(36).substring(2, 7)}`;

    const factRecord: SemanticFactRecord = {
      id: factId,
      factText,
      category,
      importance,
      confidence: 0.95,
      isActive: true,
      validFrom: now,
      createdAt: now,
      updatedAt: now,
      accessCount: 1,
      lastAccessedAt: now,
      embedding,
    };

    this.facts.set(factId, factRecord);
    this.vectorIndex.upsert(factId, embedding, { category });

    await this.persist();
    return factRecord;
  }

  /**
   * Continuous ingestion from conversational turns.
   */
  async processConversationalTurn(userMessage: string, assistantReply?: string): Promise<void> {
    const extracted = FactExtractor.extractFromTurn(userMessage, assistantReply);
    for (const item of extracted) {
      await this.ingestFact(item.factText, item.category, item.importance);
    }
  }

  // --- Hybrid Semantic Retrieval ---

  searchMemories(query: string, topK: number = 5): MemorySearchResult[] {
    return HybridRetriever.search(
      query,
      Array.from(this.facts.values()),
      this.vectorIndex,
      this.graphStore,
      topK
    );
  }

  formatContextForPrompt(query: string, topK: number = 4): string {
    const results = this.searchMemories(query, topK);
    if (results.length === 0) return '';

    const lines = results.map((r, idx) => `[Fact ${idx + 1}] (${r.category}) ${r.factText}`);
    return `[LIFELONG MEMORY CONTEXT]\n${lines.join('\n')}`;
  }

  // --- Episodic Trajectory Caching ---

  getTrajectoryRecorder(): TrajectoryRecorder {
    return this.trajectoryRecorder;
  }

  async saveTrajectory(record: EpisodicTrajectoryRecord): Promise<void> {
    this.trajectories.set(record.id, record);
    await this.persist();
  }

  findMatchingTrajectory(taskIntent: string, threshold: number = 0.88): EpisodicTrajectoryRecord | null {
    const queryEmb = EmbeddingProvider.generateEmbedding(taskIntent);
    let bestTraj: EpisodicTrajectoryRecord | null = null;
    let highestSim = -1;

    for (const traj of this.trajectories.values()) {
      const emb = traj.embedding || EmbeddingProvider.generateEmbedding(traj.taskIntent);
      const sim = EmbeddingProvider.cosineSimilarity(queryEmb, emb);
      if (sim > highestSim && sim >= threshold) {
        highestSim = sim;
        bestTraj = traj;
      }
    }

    return bestTraj;
  }

  // --- Persistence ---

  private async persist(): Promise<void> {
    try {
      const snapshot = {
        facts: Array.from(this.facts.values()),
        entities: this.graphStore.getAllEntities(),
        relationships: this.graphStore.getRelationships(),
        trajectories: Array.from(this.trajectories.values()),
        savedAt: Date.now(),
      };
      await SystemControlModule.saveMemoryFile(JSON.stringify(snapshot, null, 2));
    } catch (_e) {}
  }
}
