import { MemoryStore } from '../src/memory/store';
import { ScopedMemoryRetriever } from '../src/memory/retriever';
import { PersonaManager } from '../src/memory/personaManager';
import { ProfileManager } from '../src/memory/profile';
import { ToolRegistry } from '../src/tools/registry';

describe('Phase 6 — Long-Term Structured Memory & Persona Profile Graph', () => {
  beforeEach(async () => {
    await MemoryStore.clearAll();
  });

  describe('1. MemoryStore — Core CRUD & Storage', () => {
    test('sets and gets standard facts with confidence and importance', async () => {
      const fact = await MemoryStore.setFact('FACT', 'Wifi Password', 'secret123', {
        importance: 0.9,
      });

      expect(fact.key).toBe('Wifi Password');
      expect(fact.value).toBe('secret123');
      expect(fact.importance).toBe(0.9);
      expect(fact.isPermanent).toBe(true);

      const retrieved = MemoryStore.getFact('Wifi Password');
      expect(retrieved).toBeDefined();
      expect(retrieved?.value).toBe('secret123');
    });

    test('deletes facts by key and by fact ID', async () => {
      const fact = await MemoryStore.setFact('PREFERENCE', 'Coffee Preference', 'Black Coffee');
      expect(MemoryStore.getFact('Coffee Preference')).toBeDefined();

      const deletedByKey = await MemoryStore.deleteFact('Coffee Preference');
      expect(deletedByKey).toBe(true);
      expect(MemoryStore.getFact('Coffee Preference')).toBeUndefined();

      const fact2 = await MemoryStore.setFact('HABIT', 'Workout Time', '6:00 AM');
      const deletedById = await MemoryStore.deleteFact(fact2.id);
      expect(deletedById).toBe(true);
      expect(MemoryStore.getFact('Workout Time')).toBeUndefined();
    });

    test('queries facts by keyword and category', async () => {
      await MemoryStore.setFact('CONTACT', 'Mom', '+919876543210');
      await MemoryStore.setFact('CONTACT', 'Doctor Sharma', '+919811122233');
      await MemoryStore.setFact('PREFERENCE', 'Favorite Show', 'Taarak Mehta Ka Ooltah Chashmah');

      const contacts = MemoryStore.queryFacts('', 'CONTACT');
      expect(contacts.length).toBe(2);

      const searchSharma = MemoryStore.queryFacts('Sharma');
      expect(searchSharma.length).toBe(1);
      expect(searchSharma[0].key).toBe('Doctor Sharma');
    });
  });

  describe('2. Structured User Profile & Boss Identity Locking (ADR-017)', () => {
    test('enforces Boss identity and locked user profile name', async () => {
      const profile = MemoryStore.getProfile();
      expect(profile.name).toBe('Boss');
      expect(profile.nickname).toBe('Boss');

      // Attempting to change profile name to another name must be ignored/locked to Boss
      await MemoryStore.updateProfile({ name: 'Vanrajsinh', nickname: 'Tony' });
      const updatedProfile = MemoryStore.getProfile();
      expect(updatedProfile.name).toBe('Boss');
      expect(updatedProfile.nickname).toBe('Boss');
    });

    test('manages app preferences and favorite apps', async () => {
      await ProfileManager.setPreferredMusicApp('spotify');
      await ProfileManager.setPreferredMapApp('waze');
      await ProfileManager.setFavoriteApp('chat', 'com.whatsapp');

      const profile = ProfileManager.getProfile();
      expect(profile.preferredMusicApp).toBe('spotify');
      expect(profile.preferredMapApp).toBe('waze');
      expect(ProfileManager.getFavoriteApp('chat')).toBe('com.whatsapp');
    });

    test('manages system preferences', async () => {
      await ProfileManager.updateSystemPreferences({ defaultVolume: 90, customTheme: 'arc_reactor' });
      const sysPrefs = ProfileManager.getSystemPreferences();
      expect(sysPrefs.defaultVolume).toBe(90);
      expect(sysPrefs.customTheme).toBe('arc_reactor');
    });

    test('stores and queries contact profiles with relationships', async () => {
      await ProfileManager.addContact({
        name: 'Pepper Potts',
        phone: '+1-555-0199',
        relationship: 'wife',
        aliases: ['Pepper', 'Honey'],
        notes: 'CEO Stark Industries',
      });

      const byName = ProfileManager.getContact('Pepper Potts');
      expect(byName).toBeDefined();
      expect(byName?.phone).toBe('+1-555-0199');

      const byAlias = ProfileManager.getContact('Pepper');
      expect(byAlias).toBeDefined();
      expect(byAlias?.name).toBe('Pepper Potts');

      const byRelation = ProfileManager.getContact('wife');
      expect(byRelation).toBeDefined();
      expect(byRelation?.name).toBe('Pepper Potts');
    });
  });

  describe('3. Relationship Profile Graph Engine (ADR-007)', () => {
    test('indexes and resolves direct graph relationships (user.boss -> Tony Stark, user.wife -> Pepper)', async () => {
      await MemoryStore.setRelationship('user', 'wife', 'Pepper Potts');
      await MemoryStore.setRelationship('user', 'best_friend', 'James Rhodes');
      await MemoryStore.setRelationship('Pepper Potts', 'company', 'Stark Industries');

      expect(MemoryStore.resolveRelationship('user', 'wife')).toBe('Pepper Potts');
      expect(MemoryStore.resolveRelationship('user', 'best_friend')).toBe('James Rhodes');
      expect(MemoryStore.resolveRelationship('Pepper Potts', 'company')).toBe('Stark Industries');

      const userRels = MemoryStore.getRelationships('user');
      expect(userRels.length).toBeGreaterThanOrEqual(2);
    });

    test('traverses connected multi-hop graph entities', async () => {
      await MemoryStore.setRelationship('user', 'wife', 'Pepper');
      await MemoryStore.setRelationship('Pepper', 'assistant', 'Happy Hogan');

      const related = MemoryStore.findRelated('user', 2);
      expect(related.some((r) => r.target === 'Pepper')).toBe(true);
      expect(related.some((r) => r.target === 'Happy Hogan')).toBe(true);
    });

    test('deletes relationship triples cleanly', async () => {
      await MemoryStore.setRelationship('user', 'mechanic', 'Dum-E');
      expect(MemoryStore.resolveRelationship('user', 'mechanic')).toBe('Dum-E');

      await MemoryStore.deleteRelationship('user', 'mechanic');
      expect(MemoryStore.resolveRelationship('user', 'mechanic')).toBeUndefined();
    });
  });

  describe('4. Dynamic TTL & Importance Scoring', () => {
    test('expires short-term session memories past TTL', async () => {
      // 100ms TTL fact
      await MemoryStore.setFact('FACT', 'Temp Gate Code', '9988', {
        ttlMs: 50,
        isPermanent: false,
      });

      expect(MemoryStore.getFact('Temp Gate Code')).toBeDefined();

      // Wait 70ms for expiration
      await new Promise((resolve) => setTimeout(resolve, 70));

      const purged = MemoryStore.purgeExpiredFacts();
      expect(purged).toBeGreaterThanOrEqual(1);
      expect(MemoryStore.getFact('Temp Gate Code')).toBeUndefined();
    });

    test('keeps permanent facts indefinitely', async () => {
      await MemoryStore.setPermanentFact('Permanent Home Address', '10880 Malibu Point', 'FACT', 1.0);
      await MemoryStore.setShortTermFact('Session Ephemeral Item', 'Coffee Cup', 1);

      const all = MemoryStore.getAllFacts();
      const permanent = all.find((f) => f.key === 'Permanent Home Address');
      expect(permanent).toBeDefined();
      expect(permanent?.isPermanent).toBe(true);
    });

    test('touches and extends TTL on active facts', () => {
      const now = Date.now();
      const fact = MemoryStore.getFact('User Name');
      expect(fact).toBeDefined();

      const touched = MemoryStore.touchFact('User Name', 600);
      expect(touched).toBe(true);
      expect(MemoryStore.getFact('User Name')?.updatedAt).toBeGreaterThanOrEqual(now);
    });
  });

  describe('5. ScopedMemoryRetriever — Multi-signal Scoring & Graph Expansion', () => {
    beforeEach(async () => {
      await MemoryStore.setFact('CONTACT', 'Mom', '+919876543210', { importance: 0.9 });
      await MemoryStore.setFact('PREFERENCE', 'Favorite Show', 'Taarak Mehta Ka Ooltah Chashmah', { importance: 0.8 });
      await MemoryStore.setFact('CONTACT', 'Pepper Potts', '+1-555-0199', { importance: 0.95 });
      await MemoryStore.setRelationship('user', 'wife', 'Pepper Potts');
    });

    test('retrieves relevant memory facts in scoped query', () => {
      const relevant = ScopedMemoryRetriever.retrieveRelevantFacts('Call Mom right now');
      expect(relevant.length).toBe(1);
      expect(relevant[0].key).toBe('Mom');
      expect(relevant[0].value).toBe('+919876543210');
    });

    test('expands graph relationships (querying "wife" retrieves Pepper Potts)', () => {
      const relevant = ScopedMemoryRetriever.retrieveRelevantFacts('Send a message to my wife');
      expect(relevant.length).toBeGreaterThanOrEqual(1);
      const pepperFact = relevant.find((f) => f.key.includes('Pepper') || f.value.includes('Pepper') || f.object?.includes('Pepper'));
      expect(pepperFact).toBeDefined();
    });

    test('boosts media preference facts when activePackage is YouTube', () => {
      const relevant = ScopedMemoryRetriever.retrieveRelevantFacts('What should I watch?', 'com.google.android.youtube');
      expect(relevant.length).toBeGreaterThanOrEqual(1);
      expect(relevant[0].key).toBe('Favorite Show');
    });

    test('formats query-scoped context for system prompt', () => {
      const context = ScopedMemoryRetriever.formatContext('Call Mom');
      expect(context).toContain('[USER IDENTITY]');
      expect(context).toContain('User: Boss');
      expect(context).toContain('Mom: +919876543210');
    });

    test('formats fact list helper', () => {
      const facts = ScopedMemoryRetriever.retrieveRelevantFacts('Call Mom');
      const formatted = ScopedMemoryRetriever.formatFactsForPrompt(facts);
      expect(formatted).toContain('Mom: +919876543210');
    });
  });

  describe('6. PersonaManager — Iron Man F.R.I.D.A.Y. & Boss Locking (ADR-015, ADR-017)', () => {
    test('verifies canonical Irish voice config (en-IE-EmilyNeural)', () => {
      const config = PersonaManager.getPersonaConfig();
      expect(config.name).toBe('F.R.I.D.A.Y.');
      expect(config.voice).toBe('en-IE-EmilyNeural');
      expect(config.title).toBe('Boss');
      expect(config.accent).toBe('Irish');
      expect(config.maxSentences).toBe(4);
    });

    test('enforces Boss identity over user names or generic titles', () => {
      expect(PersonaManager.enforceBossIdentity('Hello Tony, what can I do for you?')).toBe('Hello Boss, what can I do for you?');
      expect(PersonaManager.enforceBossIdentity('Right away, sir.')).toBe('Right away, Boss.');
      expect(PersonaManager.enforceBossIdentity('Good morning, Mr. Stark.')).toBe('Good morning, Boss.');
      expect(PersonaManager.enforceBossIdentity('Yes, Vanrajsinh.')).toBe('Yes, Boss.');
    });

    test('strips markdown formatting symbols from spoken text', () => {
      const markdownInput = '**All systems** are *nominal*, Boss.\n# Diagnostics\n- Power: 100%\n- Shields: Active\n`Code active`';
      const cleaned = PersonaManager.cleanSpokenText(markdownInput);
      expect(cleaned).not.toContain('**');
      expect(cleaned).not.toContain('*');
      expect(cleaned).not.toContain('#');
      expect(cleaned).not.toContain('- ');
      expect(cleaned).not.toContain('`');
      expect(cleaned).toContain('All systems are nominal, Boss.');
    });

    test('strips raw JSON leaks and tool parameter blobs', () => {
      const rawJson = '{"toolName": "launch_app", "parameters": {"packageName": "com.google.android.youtube"}}';
      const cleaned = PersonaManager.cleanSpokenText(rawJson);
      expect(cleaned).not.toContain('{"toolName"');
      expect(cleaned).toContain('Boss');
    });

    test('formats spoken response to crisp sentence limit and ensures Boss address', () => {
      const longText = 'Sentence one. Sentence two. Sentence three. Sentence four. Sentence five should be cut off.';
      const formatted = PersonaManager.formatSpokenResponse(longText);
      const sentenceCount = formatted.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
      expect(sentenceCount).toBeLessThanOrEqual(4);
      expect(formatted).toContain('Boss');
    });

    test('validates responses and detects violations with automatic fix', () => {
      const badResponse = '**Hello sir**, here is the status: `system ok` #ready';
      const validation = PersonaManager.validateResponse(badResponse);
      expect(validation.isValid).toBe(false);
      expect(validation.violations.length).toBeGreaterThan(0);
      expect(validation.fixedText).not.toContain('**');
      expect(validation.fixedText).not.toContain('sir');
      expect(validation.fixedText).toContain('Boss');
    });

    test('returns authentic MCU precompiled greetings', () => {
      expect(PersonaManager.getPrecompiledGreeting('wake')).toBe("All systems active and ready, Boss. What's the play?");
      expect(PersonaManager.getPrecompiledGreeting('greeting')).toBe("Hello, Boss. Systems nominal. How can I assist you today?");
      expect(PersonaManager.getPrecompiledGreeting('status')).toBe("All systems running at peak efficiency, Boss. What can I do for you?");
      expect(PersonaManager.getPrecompiledGreeting('gratitude')).toBe("Always a pleasure, Boss.");
    });
  });

  describe('7. Memory Tools & ToolRegistry Execution', () => {
    test('executes save_memory_fact and store_memory_fact via ToolRegistry', async () => {
      const saveRes = await ToolRegistry.executeTool('save_memory_fact', {
        key: 'Flight Suit Code',
        value: 'Mark LXXXV',
        category: 'SECRET',
        importance: 0.95,
      });

      expect(saveRes.success).toBe(true);
      expect(saveRes.data.summary).toContain('Mark LXXXV');
      expect(saveRes.data.summary).toContain('Boss');

      const storeRes = await ToolRegistry.executeTool('store_memory_fact', {
        key: 'Arc Reactor Core',
        value: 'Palladium free synthesized element',
        category: 'FACT',
      });
      expect(storeRes.success).toBe(true);
    });

    test('executes get_memory_facts tool via ToolRegistry', async () => {
      await MemoryStore.setFact('PREFERENCE', 'Car', 'Audi R8 e-tron');
      const getRes = await ToolRegistry.executeTool('get_memory_facts', { query: 'Audi' });
      expect(getRes.success).toBe(true);
      expect(getRes.data.summary).toContain('Audi R8 e-tron');
      expect(getRes.data.facts.length).toBe(1);
    });

    test('executes forget_memory_fact tool via ToolRegistry', async () => {
      await MemoryStore.setFact('FACT', 'Temporary Note', 'Delete me soon');
      const forgetRes = await ToolRegistry.executeTool('forget_memory_fact', { key: 'Temporary Note' });
      expect(forgetRes.success).toBe(true);
      expect(forgetRes.data.summary).toContain('erased');

      const notFoundRes = await ToolRegistry.executeTool('forget_memory_fact', { key: 'Nonexistent' });
      expect(notFoundRes.success).toBe(false);
    });

    test('executes set_relationship and get_relationship_graph tools', async () => {
      const setRelRes = await ToolRegistry.executeTool('set_relationship', {
        subject: 'user',
        predicate: 'ai_assistant',
        object: 'FRIDAY',
      });
      expect(setRelRes.success).toBe(true);
      expect(setRelRes.data.summary).toContain('FRIDAY');

      const getGraphRes = await ToolRegistry.executeTool('get_relationship_graph', { entity: 'user' });
      expect(getGraphRes.success).toBe(true);
      expect(getGraphRes.data.direct.length).toBeGreaterThanOrEqual(1);
    });

    test('executes manage_profile tool', async () => {
      const manageRes = await ToolRegistry.executeTool('manage_profile', {
        preferredMusicApp: 'youtube',
        favoriteAppCategory: 'browser',
        favoriteAppName: 'com.android.chrome',
      });
      expect(manageRes.success).toBe(true);
      expect(manageRes.data.profile.preferredMusicApp).toBe('youtube');
    });
  });

  describe('8. Phase 6 Deep Audit & Edge Cases', () => {
    test('MemoryStore: handles concurrent saveToDisk() without data corruption', async () => {
      const promises = [
        MemoryStore.setFact('FACT', 'ConcurrentKey1', 'Val1'),
        MemoryStore.setFact('FACT', 'ConcurrentKey2', 'Val2'),
        MemoryStore.setFact('FACT', 'ConcurrentKey3', 'Val3'),
        MemoryStore.saveToDisk(),
        MemoryStore.saveToDisk(),
      ];
      await Promise.all(promises);

      expect(MemoryStore.getFact('ConcurrentKey1')?.value).toBe('Val1');
      expect(MemoryStore.getFact('ConcurrentKey2')?.value).toBe('Val2');
      expect(MemoryStore.getFact('ConcurrentKey3')?.value).toBe('Val3');
    });

    test('MemoryStore: handles negative TTL, zero TTL, and extreme values safely', async () => {
      // Zero TTL -> expires immediately
      const factZero = await MemoryStore.setFact('FACT', 'ZeroTTL', 'Val', { ttlSeconds: 0, isPermanent: false });
      expect(factZero.expiresAt).toBeDefined();

      // Negative TTL -> expires immediately
      const factNeg = await MemoryStore.setFact('FACT', 'NegTTL', 'Val', { ttlSeconds: -10, isPermanent: false });
      expect(factNeg.expiresAt).toBeDefined();

      // Enormous TTL does not overflow Number.MAX_SAFE_INTEGER
      const factHuge = await MemoryStore.setFact('FACT', 'HugeTTL', 'Val', { ttlMs: Number.MAX_SAFE_INTEGER, isPermanent: false });
      expect(factHuge.expiresAt).toBe(Number.MAX_SAFE_INTEGER);
    });

    test('MemoryStore: prevents infinite loops on graph cyclic relationships', async () => {
      // Direct cycle: A -> B and B -> A
      await MemoryStore.setRelationship('SuitA', 'links_to', 'SuitB');
      await MemoryStore.setRelationship('SuitB', 'links_to', 'SuitA');

      // Multi-hop cycle: X -> Y -> Z -> X
      await MemoryStore.setRelationship('NodeX', 'next', 'NodeY');
      await MemoryStore.setRelationship('NodeY', 'next', 'NodeZ');
      await MemoryStore.setRelationship('NodeZ', 'next', 'NodeX');

      // Self-loop: SelfNode -> SelfNode
      await MemoryStore.setRelationship('SelfNode', 'self', 'SelfNode');

      const relatedDirect = MemoryStore.findRelated('SuitA', 5);
      expect(Array.isArray(relatedDirect)).toBe(true);
      // Ensure traversal terminated cleanly
      expect(relatedDirect.length).toBeLessThanOrEqual(2);

      const relatedMulti = MemoryStore.findRelated('NodeX', 10);
      expect(Array.isArray(relatedMulti)).toBe(true);
      expect(relatedMulti.length).toBeLessThanOrEqual(3);

      const relatedSelf = MemoryStore.findRelated('SelfNode', 5);
      expect(relatedSelf.length).toBe(0);
    });

    test('ScopedMemoryRetriever: handles empty string, regex special chars, and score tie-breaking', () => {
      // Empty query string
      const emptyRes = ScopedMemoryRetriever.retrieveRelevantFacts('');
      expect(Array.isArray(emptyRes)).toBe(true);

      // Special regex chars in query
      const regexCharsRes = ScopedMemoryRetriever.retrieveRelevantFacts('Check (C++) & [regex] + * ? symbols');
      expect(Array.isArray(regexCharsRes)).toBe(true);

      // Deterministic tie-breaking
      const context = ScopedMemoryRetriever.formatContext('');
      expect(context).toContain('[USER IDENTITY]');
    });

    test('PersonaManager: preserves math multiplication and variable underscores', () => {
      // Math multiplication: 5 * 3 * 2 = 30
      const mathText = 'The calculation is 5 * 3 * 2 = 30, Boss.';
      const cleanedMath = PersonaManager.cleanSpokenText(mathText);
      expect(cleanedMath).toContain('5 * 3 * 2 = 30');

      // Variable name underscores: user_id, active_system_status
      const varText = 'The variable user_id is set to active_system_status, Boss.';
      const cleanedVar = PersonaManager.cleanSpokenText(varText);
      expect(cleanedVar).toContain('user_id');
      expect(cleanedVar).toContain('active_system_status');

      // Question ending without Boss appends Boss correctly
      const questionText = 'What can I do for you?';
      const formattedQ = PersonaManager.formatSpokenResponse(questionText);
      expect(formattedQ).toBe('What can I do for you, Boss?');

      const exclaimText = 'All systems ready!';
      const formattedE = PersonaManager.formatSpokenResponse(exclaimText);
      expect(formattedE).toBe('All systems ready, Boss!');

      // Whole code block preservation
      const codeBlock = '```\n5 + 5 = 10\n```';
      const cleanedCode = PersonaManager.cleanSpokenText(codeBlock);
      expect(cleanedCode).toContain('5 + 5 = 10');
    });
  });

  describe('7. Neural Lifelong Memory & Unified Snapshot Persistence', () => {
    test('extracts facts and reminders from conversational turns into neural vector store', async () => {
      const { LifelongMemoryEngine } = await import('../src/memory/lifelong/LifelongMemoryEngine');
      const { FactExtractor } = await import('../src/memory/lifelong/FactExtractor');

      const engine = LifelongMemoryEngine.getInstance();
      await engine.initialize();

      // Test fact extraction rules
      const extracted1 = FactExtractor.extractFromTurn('My favorite music app is Spotify');
      expect(extracted1.length).toBeGreaterThan(0);
      expect(extracted1[0].factText).toContain('Spotify');

      const extracted2 = FactExtractor.extractFromTurn('Remind me to call Tony Stark tomorrow at 10:00 AM');
      expect(extracted2.length).toBeGreaterThan(0);
      expect(extracted2[0].category).toBe('habit');

      const extracted3 = FactExtractor.extractFromTurn('Remember that my safe code is 4096');
      expect(extracted3.length).toBeGreaterThan(0);
      expect(extracted3[0].factText).toContain('safe code is 4096');

      // Process turn in engine
      await engine.processConversationalTurn('My favorite car is Audi R8');
      const searchRes = engine.searchMemories('Audi R8');
      expect(searchRes.length).toBeGreaterThan(0);
      expect(searchRes[0].factText).toContain('Audi R8');
    });

    test('synchronizes MemoryStore setFact with LifelongMemoryEngine without file corruption', async () => {
      const { LifelongMemoryEngine } = await import('../src/memory/lifelong/LifelongMemoryEngine');
      const engine = LifelongMemoryEngine.getInstance();
      await engine.initialize();

      // Set structured fact
      await MemoryStore.setFact('PREFERENCE', 'Preferred Language', 'TypeScript');
      expect(MemoryStore.getFact('Preferred Language')?.value).toBe('TypeScript');

      // Ensure lifelong engine has context formatted
      const context = engine.formatContextForPrompt('TypeScript');
      expect(context.toLowerCase()).toContain('typescript');
    });
  });
});
