import { SystemControlModule } from '../native/SystemControlModule';
import { MemoryCategory, MemoryFact, MemorySnapshot, UserProfile } from './types';

export class MemoryStore {
  private static profile: UserProfile = {
    name: 'Boss',
    nickname: 'Boss',
    preferredLanguage: 'en-US',
    preferredMusicApp: 'youtube',
    preferredMapApp: 'google-maps',
  };

  private static facts: Map<string, MemoryFact> = new Map([
    ['user_name', { id: 'm_name', category: 'FACT', key: 'User Name', value: 'Boss', confidence: 1.0, updatedAt: Date.now() }],
    ['user_nickname', { id: 'm_nick', category: 'FACT', key: 'Nickname', value: 'Boss', confidence: 1.0, updatedAt: Date.now() }],
  ]);

  private static isLoaded = false;

  static async initialize(): Promise<void> {
    if (this.isLoaded) return;
    try {
      const rawJson = await SystemControlModule.loadMemoryFile();
      if (rawJson && rawJson.trim().length > 0) {
        const snapshot: MemorySnapshot = JSON.parse(rawJson);
        if (snapshot.profile) {
          this.profile = { ...this.profile, ...snapshot.profile, name: 'Boss', nickname: 'Boss' };
        }
        if (Array.isArray(snapshot.facts)) {
          this.facts.clear();
          for (const fact of snapshot.facts) {
            if (fact.key.toLowerCase().includes('name') || fact.key.toLowerCase().includes('nick')) {
              fact.value = 'Boss';
            }
            this.facts.set(fact.key.toLowerCase(), fact);
          }
        }
      }
    } catch (_: any) {
    } finally {
      this.isLoaded = true;
    }
  }

  static async saveToDisk(): Promise<void> {
    try {
      const snapshot: MemorySnapshot = {
        profile: this.profile,
        facts: Array.from(this.facts.values()),
        lastSaved: Date.now(),
      };
      await SystemControlModule.saveMemoryFile(JSON.stringify(snapshot, null, 2));
    } catch (_: any) {}
  }

  static getProfile(): UserProfile {
    return { ...this.profile };
  }

  static async updateProfile(updates: Partial<UserProfile>): Promise<void> {
    this.profile = { ...this.profile, ...updates };
    await this.saveToDisk();
  }

  static getFact(key: string): MemoryFact | undefined {
    return this.facts.get(key.toLowerCase());
  }

  static getAllFacts(): MemoryFact[] {
    return Array.from(this.facts.values());
  }

  static getFactsByCategory(category: MemoryCategory): MemoryFact[] {
    return Array.from(this.facts.values()).filter((f) => f.category === category);
  }

  static queryFacts(query?: string): MemoryFact[] {
    const all = Array.from(this.facts.values());
    if (!query || !query.trim()) return all;
    const q = query.toLowerCase().trim();
    return all.filter((f) => f.key.toLowerCase().includes(q) || f.value.toLowerCase().includes(q));
  }

  static async setFact(categoryOrKey: MemoryCategory | string, keyOrVal: string, valueOrNone?: string): Promise<MemoryFact> {
    let category: MemoryCategory = 'FACT';
    let key = '';
    let value = '';

    if (valueOrNone !== undefined) {
      category = categoryOrKey as MemoryCategory;
      key = keyOrVal;
      value = valueOrNone;
    } else {
      key = categoryOrKey;
      value = keyOrVal;
    }

    const existing = this.facts.get(key.toLowerCase());
    const fact: MemoryFact = {
      id: existing?.id || `fact_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      category,
      key,
      value,
      confidence: 1.0,
      updatedAt: Date.now(),
    };
    this.facts.set(key.toLowerCase(), fact);
    await this.saveToDisk();
    return fact;
  }

  static async deleteFact(keyOrId: string): Promise<boolean> {
    const lower = keyOrId.toLowerCase();
    if (this.facts.has(lower)) {
      this.facts.delete(lower);
      await this.saveToDisk();
      return true;
    }

    // Search by fact ID
    for (const [mapKey, fact] of this.facts.entries()) {
      if (fact.id === keyOrId || fact.id === lower) {
        this.facts.delete(mapKey);
        await this.saveToDisk();
        return true;
      }
    }
    return false;
  }

  static async removeFact(key: string): Promise<boolean> {
    return this.deleteFact(key);
  }

  static async clearAll(): Promise<void> {
    this.facts.clear();
    await this.saveToDisk();
  }

  static getRecentContext(limit: number = 5): string[] {
    return Array.from(this.facts.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit)
      .map((f) => `${f.key}: ${f.value}`);
  }
}
