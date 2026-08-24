import { SystemControlModule } from '../native/SystemControlModule';
import {
  ContactProfile,
  MemoryCategory,
  MemoryFact,
  MemoryFactOptions,
  MemorySnapshot,
  RelationshipTriple,
  UserProfile,
} from './types';

export class MemoryStore {
  private static profile: UserProfile = {
    name: 'Boss',
    nickname: 'Boss',
    aliases: ['Tony Stark', 'Tony', 'Boss'],
    preferredLanguage: 'en-US',
    preferredMusicApp: 'youtube',
    preferredMapApp: 'google-maps',
    preferredBrowser: 'chrome',
    favoriteApps: {
      music: 'youtube',
      chat: 'whatsapp',
      maps: 'google-maps',
    },
    systemPreferences: {
      defaultVolume: 80,
      autoDismissOverlay: true,
      hapticFeedback: true,
    },
    contacts: {},
  };

  private static facts: Map<string, MemoryFact> = new Map();
  private static relationships: Map<string, RelationshipTriple> = new Map();
  private static isLoaded = false;

  private static savePromise: Promise<void> | null = null;
  private static pendingSave: boolean = false;

  static async initialize(): Promise<void> {
    if (this.isLoaded) return;
    try {
      this.initDefaultFactsAndRelations();
      const rawJson = await SystemControlModule.loadMemoryFile();
      if (rawJson && rawJson.trim().length > 0) {
        try {
          const snapshot: MemorySnapshot = JSON.parse(rawJson);
          if (snapshot && typeof snapshot === 'object') {
            if (snapshot.profile && typeof snapshot.profile === 'object') {
              this.profile = {
                ...this.profile,
                ...snapshot.profile,
                name: 'Boss',
                nickname: 'Boss',
                favoriteApps: { ...this.profile.favoriteApps, ...(snapshot.profile.favoriteApps || {}) },
                systemPreferences: { ...this.profile.systemPreferences, ...(snapshot.profile.systemPreferences || {}) },
                contacts: { ...this.profile.contacts, ...(snapshot.profile.contacts || {}) },
              };
            }
            if (Array.isArray(snapshot.facts)) {
              this.facts.clear();
              const now = Date.now();
              for (const fact of snapshot.facts) {
                if (!fact || typeof fact !== 'object' || typeof fact.key !== 'string') continue;
                // Check TTL expiration
                if (fact.expiresAt && fact.expiresAt <= now && !fact.isPermanent) {
                  continue;
                }
                if (fact.key.toLowerCase().includes('name') || fact.key.toLowerCase().includes('nick')) {
                  fact.value = 'Boss';
                }
                this.facts.set(fact.key.toLowerCase(), fact);
              }
            }
            if (Array.isArray(snapshot.relationships)) {
              this.relationships.clear();
              for (const rel of snapshot.relationships) {
                if (!rel || typeof rel !== 'object' || typeof rel.subject !== 'string' || typeof rel.predicate !== 'string') continue;
                const relKey = `${rel.subject.toLowerCase()}:${rel.predicate.toLowerCase()}`;
                this.relationships.set(relKey, rel);
              }
            }
          }
        } catch (parseErr) {
          console.warn('[MemoryStore] Corrupted memory file detected during parse, recovering with default facts & graph:', parseErr);
          this.initDefaultFactsAndRelations();
          await this.saveToDisk();
        }
      }
    } catch (_: any) {
    } finally {
      this.purgeExpiredFacts();
      this.isLoaded = true;
    }
  }

  private static initDefaultFactsAndRelations(): void {
    const now = Date.now();
    const nameFact: MemoryFact = {
      id: 'm_name',
      category: 'FACT',
      key: 'User Name',
      value: 'Boss',
      confidence: 1.0,
      importance: 1.0,
      isPermanent: true,
      updatedAt: now,
      createdAt: now,
    };
    this.facts.set('user_name', nameFact);
    this.facts.set('user name', nameFact);

    const nickFact: MemoryFact = {
      id: 'm_nick',
      category: 'FACT',
      key: 'Nickname',
      value: 'Boss',
      confidence: 1.0,
      importance: 1.0,
      isPermanent: true,
      updatedAt: now,
      createdAt: now,
    };
    this.facts.set('user_nickname', nickFact);
    this.facts.set('nickname', nickFact);

    // Default Tony Stark / MCU Relationship Graph
    this.setRelationshipInternal('user', 'boss', 'Tony Stark', 1.0);
    this.setRelationshipInternal('friday', 'assistant', 'user', 1.0);
  }

  static async saveToDisk(): Promise<void> {
    if (this.savePromise) {
      this.pendingSave = true;
      return this.savePromise;
    }

    this.savePromise = (async () => {
      try {
        do {
          this.pendingSave = false;
          this.purgeExpiredFacts();
          const snapshot: MemorySnapshot = {
            profile: this.profile,
            facts: Array.from(this.facts.values()),
            relationships: Array.from(this.relationships.values()),
            lastSaved: Date.now(),
            version: 2,
          };
          await SystemControlModule.saveMemoryFile(JSON.stringify(snapshot, null, 2));
        } while (this.pendingSave);
      } catch (_: any) {
      } finally {
        this.savePromise = null;
      }
    })();

    return this.savePromise;
  }

  // --- Profile Management ---

  static getProfile(): UserProfile {
    return {
      ...this.profile,
      favoriteApps: { ...this.profile.favoriteApps },
      systemPreferences: { ...this.profile.systemPreferences },
      contacts: { ...this.profile.contacts },
    };
  }

  static async updateProfile(updates: Partial<UserProfile>): Promise<void> {
    this.profile = {
      ...this.profile,
      ...updates,
      name: 'Boss',
      nickname: 'Boss',
      favoriteApps: { ...this.profile.favoriteApps, ...(updates.favoriteApps || {}) },
      systemPreferences: { ...this.profile.systemPreferences, ...(updates.systemPreferences || {}) },
      contacts: { ...this.profile.contacts, ...(updates.contacts || {}) },
    };
    await this.saveToDisk();
  }

  static async setFavoriteApp(category: string, appOrPackage: string): Promise<void> {
    if (!this.profile.favoriteApps) this.profile.favoriteApps = {};
    this.profile.favoriteApps[category.toLowerCase()] = appOrPackage;
    await this.saveToDisk();
  }

  static getFavoriteApp(category: string): string | undefined {
    return this.profile.favoriteApps?.[category.toLowerCase()];
  }

  static async updateSystemPreferences(prefs: Record<string, any>): Promise<void> {
    this.profile.systemPreferences = {
      ...this.profile.systemPreferences,
      ...prefs,
    };
    await this.saveToDisk();
  }

  static getSystemPreferences(): Record<string, any> {
    return { ...this.profile.systemPreferences };
  }

  static async addOrUpdateContact(contact: ContactProfile): Promise<void> {
    if (!this.profile.contacts) this.profile.contacts = {};
    this.profile.contacts[contact.name] = { ...contact };

    // If contact has a relationship (e.g. wife -> Pepper), index in graph
    if (contact.relationship) {
      await this.setRelationship('user', contact.relationship, contact.name);
      if (contact.phone) {
        await this.setRelationship(contact.name, 'phone', contact.phone);
      }
    }
    await this.saveToDisk();
  }

  static getContact(nameOrRelation: string): ContactProfile | undefined {
    if (!this.profile.contacts) return undefined;
    const query = nameOrRelation.toLowerCase().trim();

    // 1. Direct name match
    for (const [name, contact] of Object.entries(this.profile.contacts)) {
      if (name.toLowerCase() === query || contact.name.toLowerCase() === query) {
        return contact;
      }
      if (contact.aliases?.some((a) => a.toLowerCase() === query)) {
        return contact;
      }
    }

    // 2. Relationship match (e.g. "wife", "mom", "brother")
    for (const contact of Object.values(this.profile.contacts)) {
      if (contact.relationship?.toLowerCase() === query) {
        return contact;
      }
    }

    // 3. Check graph relation
    const targetName = this.resolveRelationship('user', query);
    if (targetName) {
      return this.getContact(targetName);
    }

    return undefined;
  }

  // --- Fact Storage & Retrieval ---

  static getFact(key: string): MemoryFact | undefined {
    const fact = this.findFactByIdOrKey(key);
    if (!fact) return undefined;
    if (fact.expiresAt && Date.now() > fact.expiresAt && !fact.isPermanent) {
      this.deleteFact(key);
      return undefined;
    }
    return fact;
  }

  static getAllFacts(includeExpired: boolean = false): MemoryFact[] {
    const now = Date.now();
    const result: MemoryFact[] = [];
    const seenIds = new Set<string>();

    for (const fact of this.facts.values()) {
      if (seenIds.has(fact.id)) continue;
      if (!includeExpired && fact.expiresAt && now > fact.expiresAt && !fact.isPermanent) {
        continue;
      }
      seenIds.add(fact.id);
      result.push(fact);
    }
    return result;
  }

  static getFactsByCategory(category: MemoryCategory): MemoryFact[] {
    return this.getAllFacts().filter((f) => f.category === category);
  }

  static queryFacts(query?: string, category?: MemoryCategory): MemoryFact[] {
    const all = this.getAllFacts();
    let filtered = all;
    if (category) {
      filtered = filtered.filter((f) => f.category === category);
    }
    if (!query || !query.trim()) return filtered;
    const q = query.toLowerCase().trim();
    return filtered.filter(
      (f) =>
        f.key.toLowerCase().includes(q) ||
        f.value.toLowerCase().includes(q) ||
        (f.subject && f.subject.toLowerCase().includes(q)) ||
        (f.predicate && f.predicate.toLowerCase().includes(q)) ||
        (f.object && f.object.toLowerCase().includes(q))
    );
  }

  static async setFact(
    categoryOrKey: MemoryCategory | string,
    keyOrVal: string,
    valueOrNone?: string,
    options?: MemoryFactOptions
  ): Promise<MemoryFact> {
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

    const now = Date.now();
    const existing = this.findFactByIdOrKey(key);

    const rawImportance = options?.importance ?? (category === 'PROFILE' || category === 'PREFERENCE' ? 0.8 : 0.5);
    const importance = typeof rawImportance === 'number' && Number.isFinite(rawImportance) ? Math.max(0, Math.min(1, rawImportance)) : 0.5;
    const rawConfidence = options?.confidence ?? 1.0;
    const confidence = typeof rawConfidence === 'number' && Number.isFinite(rawConfidence) ? Math.max(0, Math.min(1, rawConfidence)) : 1.0;

    let ttlMs: number | undefined = undefined;
    if (typeof options?.ttlMs === 'number' && Number.isFinite(options.ttlMs)) {
      ttlMs = Math.max(0, options.ttlMs);
    } else if (typeof options?.ttlSeconds === 'number' && Number.isFinite(options.ttlSeconds)) {
      ttlMs = Math.max(0, options.ttlSeconds * 1000);
    }

    const isPermanent = options?.isPermanent ?? (ttlMs === undefined && options?.expiresAt === undefined);

    let expiresAt: number | undefined = undefined;
    if (!isPermanent) {
      if (typeof options?.expiresAt === 'number' && Number.isFinite(options.expiresAt)) {
        expiresAt = options.expiresAt;
      } else if (ttlMs !== undefined) {
        // Guard against integer overflow
        const maxExpiry = Number.MAX_SAFE_INTEGER;
        expiresAt = ttlMs > maxExpiry - now ? maxExpiry : now + ttlMs;
      }
    }

    // Graph triple extraction
    let subject = options?.subject;
    let predicate = options?.predicate;
    let object = options?.object;

    // Check if key/value indicates a relationship (e.g. "user.boss", "wife", "contact.Pepper")
    if (!predicate && (category === 'RELATIONSHIP' || key.includes('.') || key.includes('->'))) {
      const parsed = this.parseRelationshipString(key, value);
      if (parsed) {
        subject = parsed.subject;
        predicate = parsed.predicate;
        object = parsed.object;
      }
    }

    // Boss identity enforcement
    if (key.toLowerCase().includes('name') && !key.toLowerCase().includes('contact')) {
      value = 'Boss';
    }

    const fact: MemoryFact = {
      id: existing?.id || `fact_${now}_${Math.random().toString(36).substring(2, 7)}`,
      category,
      key,
      value,
      confidence,
      importance,
      updatedAt: now,
      createdAt: existing?.createdAt || now,
      ttlMs,
      expiresAt,
      isPermanent,
      subject,
      predicate,
      object,
      metadata: options?.metadata,
    };

    this.facts.set(key.toLowerCase(), fact);

    // Auto-update graph relation if present
    if (subject && predicate && object) {
      this.setRelationshipInternal(subject, predicate, object, confidence);
    }

    await this.saveToDisk();
    return fact;
  }

  static async setShortTermFact(
    key: string,
    value: string,
    ttlSeconds: number = 300,
    importance: number = 0.3
  ): Promise<MemoryFact> {
    const safeTtl = typeof ttlSeconds === 'number' && Number.isFinite(ttlSeconds) ? Math.max(1, ttlSeconds) : 300;
    return this.setFact('FACT', key, value, {
      ttlSeconds: safeTtl,
      importance,
      isPermanent: false,
    });
  }

  static async setPermanentFact(
    key: string,
    value: string,
    category: MemoryCategory = 'FACT',
    importance: number = 0.9
  ): Promise<MemoryFact> {
    return this.setFact(category, key, value, {
      isPermanent: true,
      importance,
    });
  }

  static touchFact(keyOrId: string, extensionSeconds?: number): boolean {
    const fact = this.findFactByIdOrKey(keyOrId);
    if (!fact) return false;
    const now = Date.now();
    fact.updatedAt = now;
    if (typeof extensionSeconds === 'number' && Number.isFinite(extensionSeconds) && extensionSeconds > 0 && fact.expiresAt) {
      const extMs = extensionSeconds * 1000;
      const newExpiry = extMs > Number.MAX_SAFE_INTEGER - now ? Number.MAX_SAFE_INTEGER : now + extMs;
      fact.expiresAt = Math.max(fact.expiresAt, newExpiry);
    }
    return true;
  }

  static purgeExpiredFacts(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, fact] of this.facts.entries()) {
      if (fact.expiresAt && now > fact.expiresAt && !fact.isPermanent) {
        this.facts.delete(key);
        count++;
      }
    }
    return count;
  }

  static async deleteFact(keyOrId: string): Promise<boolean> {
    const fact = this.findFactByIdOrKey(keyOrId);
    if (fact) {
      const keysToDelete: string[] = [];
      for (const [k, f] of this.facts.entries()) {
        if (f.id === fact.id) {
          keysToDelete.push(k);
        }
      }
      for (const k of keysToDelete) {
        this.facts.delete(k);
      }
      await this.saveToDisk();
      return true;
    }
    return false;
  }

  static async removeFact(key: string): Promise<boolean> {
    return this.deleteFact(key);
  }

  static async clearAll(): Promise<void> {
    this.facts.clear();
    this.relationships.clear();
    this.profile = {
      name: 'Boss',
      nickname: 'Boss',
      aliases: ['Tony Stark', 'Tony', 'Boss'],
      preferredLanguage: 'en-US',
      preferredMusicApp: 'youtube',
      preferredMapApp: 'google-maps',
      favoriteApps: { music: 'youtube', chat: 'whatsapp', maps: 'google-maps' },
      systemPreferences: { defaultVolume: 80, autoDismissOverlay: true },
      contacts: {},
    };
    this.initDefaultFactsAndRelations();
    await this.saveToDisk();
  }

  static getRecentContext(limit: number = 5): string[] {
    return this.getAllFacts()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit)
      .map((f) => `${f.key}: ${f.value}`);
  }

  // --- Graph Relations Engine ---

  static async setRelationship(
    subject: string,
    predicate: string,
    object: string,
    confidence: number = 1.0
  ): Promise<RelationshipTriple> {
    const rel = this.setRelationshipInternal(subject, predicate, object, confidence);
    // Also store as memory fact for multi-tier retrieval
    const factKey = `${subject}.${predicate}`;
    await this.setFact('RELATIONSHIP', factKey, object, {
      subject,
      predicate,
      object,
      confidence,
      importance: 0.85,
      isPermanent: true,
    });
    return rel;
  }

  private static setRelationshipInternal(
    subject: string,
    predicate: string,
    object: string,
    confidence: number = 1.0
  ): RelationshipTriple {
    const cleanSubj = subject.trim();
    const cleanPred = predicate.trim().toLowerCase();
    const cleanObj = object.trim();
    const relKey = `${cleanSubj.toLowerCase()}:${cleanPred}`;
    const triple: RelationshipTriple = {
      id: `rel_${cleanSubj.toLowerCase()}_${cleanPred}`,
      subject: cleanSubj,
      predicate: cleanPred,
      object: cleanObj,
      confidence,
      updatedAt: Date.now(),
    };
    this.relationships.set(relKey, triple);
    return triple;
  }

  static getRelationships(subject?: string, predicate?: string): RelationshipTriple[] {
    const all = Array.from(this.relationships.values());
    return all.filter((r) => {
      if (subject && r.subject.toLowerCase() !== subject.toLowerCase()) return false;
      if (predicate && r.predicate.toLowerCase() !== predicate.toLowerCase()) return false;
      return true;
    });
  }

  static getAllRelationships(): RelationshipTriple[] {
    return Array.from(this.relationships.values());
  }

  static resolveRelationship(subject: string, predicate: string): string | undefined {
    const relKey = `${subject.toLowerCase().trim()}:${predicate.toLowerCase().trim()}`;
    const direct = this.relationships.get(relKey);
    if (direct) return direct.object;

    // Search aliases if subject is 'user' or 'Tony'
    if (subject.toLowerCase() === 'user' || subject.toLowerCase() === 'boss' || subject.toLowerCase() === 'tony') {
      const aliasKeys = ['user', 'boss', 'tony', 'tony stark'];
      for (const alias of aliasKeys) {
        const match = this.relationships.get(`${alias}:${predicate.toLowerCase().trim()}`);
        if (match) return match.object;
      }
    }
    return undefined;
  }

  static findRelated(entity: string, maxDepth: number = 2): Array<{ path: string[]; target: string; relationship: string }> {
    if (!entity || typeof entity !== 'string') return [];
    const safeMaxDepth = Math.min(Math.max(1, maxDepth), 10);
    const results: Array<{ path: string[]; target: string; relationship: string }> = [];

    const traverse = (current: string, currentPath: string[], depth: number, activeStack: Set<string>) => {
      if (depth > safeMaxDepth) return;
      const lower = current.toLowerCase().trim();
      if (!lower) return;

      const rels = this.getRelationships(current);
      for (const rel of rels) {
        const objLower = rel.object.toLowerCase().trim();
        // Skip self-loops or cyclic hops to ancestor nodes in active path
        if (!objLower || activeStack.has(objLower)) {
          continue;
        }

        const nextPath = [...currentPath, `${rel.subject} -(${rel.predicate})-> ${rel.object}`];
        results.push({
          path: nextPath,
          target: rel.object,
          relationship: rel.predicate,
        });

        const nextStack = new Set(activeStack);
        nextStack.add(objLower);
        traverse(rel.object, nextPath, depth + 1, nextStack);
      }
    };

    const initialStack = new Set<string>();
    initialStack.add(entity.toLowerCase().trim());
    traverse(entity, [], 1, initialStack);
    return results;
  }

  static async deleteRelationship(subject: string, predicate: string): Promise<boolean> {
    const relKey = `${subject.toLowerCase().trim()}:${predicate.toLowerCase().trim()}`;
    const deleted = this.relationships.delete(relKey);
    if (deleted) {
      await this.deleteFact(`${subject}.${predicate}`);
      await this.saveToDisk();
    }
    return deleted;
  }

  private static parseRelationshipString(key: string, value: string): { subject: string; predicate: string; object: string } | null {
    // E.g. "user.boss -> 'Tony Stark'", "contact.wife", "user.wife"
    if (key.includes('.')) {
      const parts = key.split('.');
      return {
        subject: parts[0].trim(),
        predicate: parts[1].replace(/->.*$/, '').trim(),
        object: value.trim(),
      };
    }
    if (key.includes('->')) {
      const parts = key.split('->');
      return {
        subject: 'user',
        predicate: parts[0].trim(),
        object: value.trim(),
      };
    }
    return null;
  }

  private static findFactByIdOrKey(keyOrId: string): MemoryFact | undefined {
    const lower = keyOrId.toLowerCase().trim();
    if (this.facts.has(lower)) return this.facts.get(lower);
    const normalizedUnderscore = lower.replace(/\s+/g, '_');
    if (this.facts.has(normalizedUnderscore)) return this.facts.get(normalizedUnderscore);
    const normalizedSpace = lower.replace(/_/g, ' ');
    if (this.facts.has(normalizedSpace)) return this.facts.get(normalizedSpace);

    for (const fact of this.facts.values()) {
      if (
        fact.id === keyOrId ||
        fact.id.toLowerCase() === lower ||
        fact.key.toLowerCase() === lower ||
        fact.key.toLowerCase().replace(/_/g, ' ') === normalizedSpace ||
        fact.key.toLowerCase().replace(/\s+/g, '_') === normalizedUnderscore
      ) {
        return fact;
      }
    }
    return undefined;
  }
}
