import { ToolDefinition } from './types';
import { MemoryStore } from '../memory/store';
import { MemoryCategory } from '../memory/types';

export const saveMemoryFactTool: ToolDefinition = {
  name: 'save_memory_fact',
  description: 'Saves and commits a personal fact, habit, relationship, preference, contact, or note into FRIDAY\'s persistent or short-term memory.',
  parameters: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'The subject or label of what to remember (e.g. "Favorite Food", "Brother Name", "Home Address", "GF Name")' },
      value: { type: 'string', description: 'The exact information or detail to remember (e.g. "Pizza", "Rahul", "Ahmedabad", "Priya")' },
      category: {
        type: 'string',
        enum: ['FACT', 'PREFERENCE', 'HABIT', 'RELATIONSHIP', 'CONTACT', 'NOTE', 'SECRET', 'SYSTEM_PREF', 'PROFILE'],
        description: 'Category of memory',
      },
      importance: { type: 'number', description: 'Importance score between 0.0 and 1.0 (default 0.5)' },
      ttlSeconds: { type: 'number', description: 'Optional time-to-live in seconds for short-term memory (e.g. 300)' },
      isPermanent: { type: 'boolean', description: 'Whether this fact is permanently retained' },
      subject: { type: 'string', description: 'Optional graph subject entity (e.g. "user", "contact.Pepper")' },
      predicate: { type: 'string', description: 'Optional graph predicate relation (e.g. "wife", "boss", "favorite_song")' },
      object: { type: 'string', description: 'Optional graph target object (e.g. "Pepper Potts", "Tony Stark")' },
    },
    required: ['key', 'value'],
  },
  execute: async ({ key, value, category = 'FACT', importance, ttlSeconds, isPermanent, subject, predicate, object }) => {
    await MemoryStore.initialize();
    const fact = await MemoryStore.setFact(category as MemoryCategory, key, value, {
      importance,
      ttlSeconds,
      isPermanent,
      subject,
      predicate,
      object,
    });
    return {
      success: true,
      data: {
        fact,
        summary: `I have saved this to my memory: ${fact.key} is ${fact.value}, Boss.`,
      },
    };
  },
};

export const storeMemoryFactTool: ToolDefinition = {
  name: 'store_memory_fact',
  description: 'Alias for save_memory_fact — saves a memory fact, relationship, or preference.',
  parameters: saveMemoryFactTool.parameters,
  execute: saveMemoryFactTool.execute,
};

export const getMemoryFactsTool: ToolDefinition = {
  name: 'get_memory_facts',
  description: 'Recalls, searches, and retrieves stored facts, memories, preferences, and personal details from FRIDAY\'s memory.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Optional search keyword (e.g. "favorite", "brother", "address", "food", "profile")' },
      category: {
        type: 'string',
        enum: ['FACT', 'PREFERENCE', 'HABIT', 'RELATIONSHIP', 'CONTACT', 'NOTE', 'SECRET', 'SYSTEM_PREF', 'PROFILE'],
        description: 'Optional category filter',
      },
      limit: { type: 'number', description: 'Maximum number of facts to return' },
    },
  },
  execute: async ({ query = '', category, limit = 10 }) => {
    await MemoryStore.initialize();
    let facts = MemoryStore.queryFacts(query, category as MemoryCategory | undefined);
    if (limit && limit > 0) {
      facts = facts.slice(0, limit);
    }
    if (facts.length === 0) {
      return {
        success: true,
        data: {
          facts: [],
          summary: `I don't have any saved memories matching "${query}" yet, Boss.`,
        },
      };
    }

    const details = facts.map((f) => `${f.key}: ${f.value}`).join(', ');
    return {
      success: true,
      data: {
        facts,
        summary: `Here is what I remember: ${details}, Boss.`,
      },
    };
  },
};

export const forgetMemoryFactTool: ToolDefinition = {
  name: 'forget_memory_fact',
  description: 'Erases and removes a specific fact or detail from FRIDAY\'s persistent memory.',
  parameters: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'The memory key or detail to forget' },
    },
    required: ['key'],
  },
  execute: async ({ key }) => {
    await MemoryStore.initialize();
    const deleted = await MemoryStore.deleteFact(key);
    return {
      success: deleted,
      data: {
        key,
        summary: deleted
          ? `I have erased "${key}" from my memory, Boss.`
          : `I couldn't find "${key}" in my memory, Boss.`,
      },
    };
  },
};

export const setRelationshipTool: ToolDefinition = {
  name: 'set_relationship',
  description: 'Establishes a structured relationship triple in the persona profile graph (e.g. user -> wife -> Pepper, user -> boss -> Tony Stark).',
  parameters: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: 'The subject entity (e.g. "user", "contact.Pepper", "FRIDAY")' },
      predicate: { type: 'string', description: 'The relationship relation (e.g. "wife", "boss", "friend", "colleague")' },
      object: { type: 'string', description: 'The target object entity (e.g. "Pepper Potts", "Tony Stark")' },
    },
    required: ['subject', 'predicate', 'object'],
  },
  execute: async ({ subject, predicate, object }) => {
    await MemoryStore.initialize();
    const triple = await MemoryStore.setRelationship(subject, predicate, object);
    return {
      success: true,
      data: {
        relationship: triple,
        summary: `I've mapped the relationship: ${triple.subject} is ${triple.predicate} to ${triple.object}, Boss.`,
      },
    };
  },
};

export const getRelationshipGraphTool: ToolDefinition = {
  name: 'get_relationship_graph',
  description: 'Retrieves connected relationships and entities from the persona profile graph.',
  parameters: {
    type: 'object',
    properties: {
      entity: { type: 'string', description: 'Optional subject or entity to explore connected relations for' },
    },
  },
  execute: async ({ entity }) => {
    await MemoryStore.initialize();
    if (entity) {
      const direct = MemoryStore.getRelationships(entity);
      const related = MemoryStore.findRelated(entity);
      return {
        success: true,
        data: {
          entity,
          direct,
          related,
          summary: direct.length > 0
            ? `Found ${direct.length} relations for ${entity}, Boss.`
            : `No relations found for ${entity}, Boss.`,
        },
      };
    }

    const all = MemoryStore.getAllRelationships();
    return {
      success: true,
      data: {
        relationships: all,
        summary: `Graph contains ${all.length} registered relationships, Boss.`,
      },
    };
  },
};

export const manageProfileTool: ToolDefinition = {
  name: 'manage_profile',
  description: 'Updates user profile preferences, favorite apps, language, or system preferences.',
  parameters: {
    type: 'object',
    properties: {
      preferredMusicApp: { type: 'string', description: 'Preferred music application (e.g. "youtube", "spotify")' },
      preferredMapApp: { type: 'string', description: 'Preferred navigation application (e.g. "google-maps", "waze")' },
      preferredLanguage: { type: 'string', description: 'Preferred speech and response language (e.g. "en-US", "en-IE")' },
      favoriteAppCategory: { type: 'string', description: 'Category for favorite app (e.g. "music", "chat", "maps")' },
      favoriteAppName: { type: 'string', description: 'App name or package for favorite app category' },
    },
  },
  execute: async ({ preferredMusicApp, preferredMapApp, preferredLanguage, favoriteAppCategory, favoriteAppName }) => {
    await MemoryStore.initialize();
    const updates: any = {};
    if (preferredMusicApp) updates.preferredMusicApp = preferredMusicApp;
    if (preferredMapApp) updates.preferredMapApp = preferredMapApp;
    if (preferredLanguage) updates.preferredLanguage = preferredLanguage;

    if (Object.keys(updates).length > 0) {
      await MemoryStore.updateProfile(updates);
    }
    if (favoriteAppCategory && favoriteAppName) {
      await MemoryStore.setFavoriteApp(favoriteAppCategory, favoriteAppName);
    }

    const profile = MemoryStore.getProfile();
    return {
      success: true,
      data: {
        profile,
        summary: `Profile updated successfully, Boss.`,
      },
    };
  },
};
