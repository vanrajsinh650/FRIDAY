// src/memory/lifelong/types.ts

export type EntityCategory = 'person' | 'app' | 'location' | 'device_setting' | 'preference' | 'concept';

export interface EntityRecord {
  id: string;
  name: string;
  category: EntityCategory;
  aliases: string[];
  attributes: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  lastAccessedAt: number;
}

export interface RelationshipRecord {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType: string; // e.g. 'works_at', 'located_in', 'prefers', 'shortcut_for', 'wife_of'
  weight: number;
  confidence: number;
  createdAt: number;
  updatedAt: number;
}

export type FactCategory =
  | 'user_profile'
  | 'habit'
  | 'preference'
  | 'contact'
  | 'screen_lesson'
  | 'device_rule'
  | 'system_lore';

export interface SemanticFactRecord {
  id: string;
  entityId?: string;
  factText: string;
  category: FactCategory;
  importance: number; // 0.0 to 1.0
  confidence: number; // 0.0 to 1.0
  isActive: boolean;
  validFrom: number;
  validTo?: number; // timestamp if superseded/expired
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  lastAccessedAt: number;
  embedding?: number[];
  metadata?: Record<string, any>;
}

export interface UIActionStep {
  stepIndex: number;
  actionType: 'LAUNCH_APP' | 'CLICK_MARK' | 'CLICK_TEXT' | 'TYPE_TEXT' | 'SCROLL' | 'WAIT' | 'CUSTOM';
  targetPackage?: string;
  targetMarkId?: number;
  targetText?: string;
  typePayload?: string;
  scrollDirection?: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
  expectedScreenSnippet?: string;
  timeoutMs?: number;
}

export interface EpisodicTrajectoryRecord {
  id: string;
  taskIntent: string; // e.g. "Order regular latte from Starbucks"
  targetPackage: string;
  parameterSchema: Record<string, string>; // dynamic variables e.g. { size: "Grande" }
  actionSequence: UIActionStep[];
  groundingRules?: Record<string, any>; // visual fallback heuristics
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
  lastExecutedAt?: number;
  createdAt: number;
  embedding?: number[];
}

export interface MemorySearchResult {
  factId: string;
  factText: string;
  category: string;
  rrfScore: number;
  importance: number;
  lastAccessedAt: number;
  source: 'FTS_BM25' | 'DENSE_VECTOR' | 'GRAPH_PPR' | 'HYBRID';
}

export type MemoryCRUDAction = 'ADD' | 'UPDATE' | 'MERGE' | 'INVALIDATE' | 'NO_OP';

export interface FactEvaluationResult {
  action: MemoryCRUDAction;
  targetFactId?: string;
  refinedFactText?: string;
  reason: string;
}
