// src/memory/lifelong/FactExtractor.ts

import { FactCategory } from './types';

export interface ExtractedFactItem {
  factText: string;
  category: FactCategory;
  importance: number;
  confidence: number;
  entityName?: string;
}

export class FactExtractor {
  /**
   * Extracts personal facts, preferences, habits, and rules from conversational turns.
   */
  static extractFromTurn(userMessage: string, assistantReply?: string): ExtractedFactItem[] {
    const text = (userMessage || '').trim();
    if (text.length < 4) return [];
    const items: ExtractedFactItem[] = [];

    // 1. Name & Identity
    const nameMatch = text.match(/\b(?:my name is|call me|i am)\s+([a-zA-Z0-9_-]+)/i);
    if (nameMatch && nameMatch[1]) {
      items.push({
        factText: `User name is ${nameMatch[1]}`,
        category: 'user_profile',
        importance: 0.95,
        confidence: 1.0,
        entityName: nameMatch[1],
      });
    }

    // 2. Preferences & Favorites
    const prefMatch = text.match(/\b(?:i prefer|i like|my favorite|i love)\s+([^.!?]+)/i);
    if (prefMatch && prefMatch[1]) {
      items.push({
        factText: `User preference: ${prefMatch[1].trim()}`,
        category: 'preference',
        importance: 0.85,
        confidence: 0.9,
      });
    }

    // 3. Contact Associations
    const contactMatch = text.match(/\b([a-zA-Z]+)\s+is my\s+([a-zA-Z]+)/i) ||
                         text.match(/\bmy\s+([a-zA-Z]+)\s+is\s+([a-zA-Z]+)/i);
    if (contactMatch) {
      const relation = contactMatch[1];
      const person = contactMatch[2];
      items.push({
        factText: `${person} is user's ${relation}`,
        category: 'contact',
        importance: 0.9,
        confidence: 0.95,
        entityName: person,
      });
    }

    // 4. Locations & Living
    const locMatch = text.match(/\bi (?:live in|moved to|work at)\s+([^.!?]+)/i);
    if (locMatch && locMatch[1]) {
      items.push({
        factText: `User location/work: ${locMatch[1].trim()}`,
        category: 'user_profile',
        importance: 0.85,
        confidence: 0.9,
      });
    }

    // 5. Habits & Routines
    const habitMatch = text.match(/\b(?:every day|every morning|every night|usually at|always at)\s+([^.!?]+)/i);
    if (habitMatch && habitMatch[1]) {
      items.push({
        factText: `User routine: ${habitMatch[0].trim()}`,
        category: 'habit',
        importance: 0.75,
        confidence: 0.85,
      });
    }

    return items;
  }

  /**
   * Extracts a screen lesson when a UI action encounters or solves a specific app quirk.
   */
  static extractScreenLesson(packageName: string, lesson: string): ExtractedFactItem {
    return {
      factText: `App ${packageName} UI lesson: ${lesson.trim()}`,
      category: 'screen_lesson',
      importance: 0.8,
      confidence: 0.95,
      entityName: packageName,
    };
  }
}
