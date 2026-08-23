import { ToolDefinition } from './types';
import { MemoryStore } from '../memory/store';
import { MemoryCategory } from '../memory/types';

export const saveMemoryFactTool: ToolDefinition = {
  name: 'save_memory_fact',
  description: 'Saves and commits a personal fact, habit, relationship, preference, contact, or note into FRIDAY\'s persistent memory.',
  parameters: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'The subject or label of what to remember (e.g. "Favorite Food", "Brother Name", "Home Address", "GF Name")' },
      value: { type: 'string', description: 'The exact information or detail to remember (e.g. "Pizza", "Rahul", "Ahmedabad", "Priya")' },
      category: {
        type: 'string',
        enum: ['FACT', 'PREFERENCE', 'HABIT', 'RELATIONSHIP', 'CONTACT', 'NOTE', 'SECRET'],
        description: 'Category of memory',
      },
    },
    required: ['key', 'value'],
  },
  execute: async ({ key, value, category = 'FACT' }) => {
    await MemoryStore.initialize();
    const fact = await MemoryStore.setFact(category as MemoryCategory, key, value);
    return {
      success: true,
      data: {
        fact,
        summary: `I have saved this to my permanent memory: ${fact.key} is ${fact.value}, boss.`,
      },
    };
  },
};

export const getMemoryFactsTool: ToolDefinition = {
  name: 'get_memory_facts',
  description: 'Recalls, searches, and retrieves stored facts, memories, preferences, and personal details from FRIDAY\'s memory.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Optional search keyword (e.g. "favorite", "brother", "address", "food")' },
    },
  },
  execute: async ({ query = '' }) => {
    await MemoryStore.initialize();
    const facts = MemoryStore.queryFacts(query);
    if (facts.length === 0) {
      return {
        success: true,
        data: {
          facts: [],
          summary: `I don't have any saved memories matching "${query}" yet, boss.`,
        },
      };
    }

    const details = facts.map((f) => `${f.key}: ${f.value}`).join(', ');
    return {
      success: true,
      data: {
        facts,
        summary: `Here is what I remember: ${details}, boss.`,
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
          ? `I have erased "${key}" from my memory, boss.`
          : `I couldn't find "${key}" in my memory, boss.`,
      },
    };
  },
};
