import { MemoryFact, UserProfile } from './types';

export class MemoryStore {
  private static profile: UserProfile = {
    name: 'Vanrajsinh',
    nickname: 'Boss',
    preferredLanguage: 'en-US',
    preferredMusicApp: 'youtube',
    preferredMapApp: 'google-maps',
  };

  private static facts: Map<string, MemoryFact> = new Map([
    ['contact_mom', { id: 'm1', category: 'CONTACT', key: 'Mom', value: '+919876543210', confidence: 1.0, updatedAt: Date.now() }],
    ['pref_comedy', { id: 'm2', category: 'PREFERENCE', key: 'Favorite Show', value: 'Taarak Mehta Ka Ooltah Chashmah', confidence: 1.0, updatedAt: Date.now() }],
  ]);

  static getProfile(): UserProfile {
    return { ...this.profile };
  }

  static updateProfile(updates: Partial<UserProfile>): void {
    this.profile = { ...this.profile, ...updates };
  }

  static getAllFacts(): MemoryFact[] {
    return Array.from(this.facts.values());
  }

  static setFact(category: MemoryFact['category'], key: string, value: string): void {
    const id = `fact_${Date.now()}`;
    this.facts.set(key.toLowerCase(), { id, category, key, value, confidence: 1.0, updatedAt: Date.now() });
  }

  static deleteFact(id: string): void {
    const keysToDelete: string[] = [];
    for (const [k, v] of this.facts.entries()) {
      if (v.id === id) {
        keysToDelete.push(k);
      }
    }
    for (const k of keysToDelete) {
      this.facts.delete(k);
    }
  }

  static clearAll(): void {
    this.facts.clear();
  }
}
