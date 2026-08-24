export interface ContactProfile {
  name: string;
  phone?: string;
  email?: string;
  relationship?: string;
  aliases?: string[];
  notes?: string;
}

export interface UserProfile {
  name: string;
  nickname?: string;
  aliases?: string[];
  preferredLanguage: string;
  preferredMusicApp: 'youtube' | 'spotify' | string;
  preferredMapApp: 'google-maps' | 'waze' | string;
  preferredBrowser?: string;
  homeAddress?: string;
  workAddress?: string;
  bio?: string;
  systemPreferences?: Record<string, any>;
  favoriteApps?: Record<string, string>;
  contacts?: Record<string, ContactProfile>;
}

export type MemoryCategory =
  | 'CONTACT'
  | 'PREFERENCE'
  | 'HABIT'
  | 'FACT'
  | 'RELATIONSHIP'
  | 'NOTE'
  | 'SECRET'
  | 'APP_CACHE'
  | 'SYSTEM_PREF'
  | 'PROFILE';

export interface RelationshipTriple {
  id?: string;
  subject: string;
  predicate: string;
  object: string;
  confidence?: number;
  updatedAt?: number;
}

export interface MemoryFactOptions {
  importance?: number;
  ttlMs?: number;
  ttlSeconds?: number;
  expiresAt?: number;
  isPermanent?: boolean;
  subject?: string;
  predicate?: string;
  object?: string;
  confidence?: number;
  metadata?: Record<string, any>;
}

export interface MemoryFact {
  id: string;
  category: MemoryCategory;
  key: string;
  value: string;
  confidence: number;
  importance: number;
  updatedAt: number;
  createdAt?: number;
  ttlMs?: number;
  expiresAt?: number;
  isPermanent?: boolean;
  subject?: string;
  predicate?: string;
  object?: string;
  metadata?: Record<string, any>;
}

export interface MemorySnapshot {
  profile: UserProfile;
  facts: MemoryFact[];
  relationships?: RelationshipTriple[];
  lastSaved: number;
  version?: number;
}

export interface PersonaConfig {
  name: string;
  voice: string;
  voiceEngine: string;
  title: string;
  accent: string;
  traits: string[];
  maxSentences: number;
  minSentences: number;
}
