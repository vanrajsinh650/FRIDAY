export interface UserProfile {
  name: string;
  nickname?: string;
  preferredLanguage: string;
  preferredMusicApp: 'youtube' | 'spotify';
  preferredMapApp: 'google-maps' | 'waze';
  homeAddress?: string;
  workAddress?: string;
}

export interface MemoryFact {
  id: string;
  category: 'CONTACT' | 'PREFERENCE' | 'HABIT' | 'FACT' | 'APP_CACHE';
  key: string;
  value: string;
  confidence: number;
  updatedAt: number;
}
