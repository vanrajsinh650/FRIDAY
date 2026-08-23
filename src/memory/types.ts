export interface UserProfile {
  name: string;
  nickname?: string;
  preferredLanguage: string;
  preferredMusicApp: 'youtube' | 'spotify';
  preferredMapApp: 'google-maps' | 'waze';
  homeAddress?: string;
  workAddress?: string;
  bio?: string;
}

export type MemoryCategory =
  | 'CONTACT'
  | 'PREFERENCE'
  | 'HABIT'
  | 'FACT'
  | 'RELATIONSHIP'
  | 'NOTE'
  | 'SECRET'
  | 'APP_CACHE';

export interface MemoryFact {
  id: string;
  category: MemoryCategory;
  key: string;
  value: string;
  confidence: number;
  updatedAt: number;
}

export interface MemorySnapshot {
  profile: UserProfile;
  facts: MemoryFact[];
  lastSaved: number;
}
