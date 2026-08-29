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

    // 6. Explicit Memory Statements ("remember that X", "note that Y", "keep in mind Z")
    const explicitMatch = text.match(/\b(?:remember that|remember|note that|save fact|keep in mind)\s+([^.!?]+)/i);
    if (explicitMatch && explicitMatch[1]) {
      items.push({
        factText: explicitMatch[1].trim(),
        category: 'user_profile',
        importance: 0.95,
        confidence: 1.0,
      });
    }

    // 7. Reminders & Tasks ("i set a reminder for...", "remind me to...", "i need to...")
    const reminderMatch = text.match(/\b(?:remind me to|i set a reminder (?:for|to|that)|i need to|don't forget to)\s+([^.!?]+)/i);
    if (reminderMatch && reminderMatch[1]) {
      items.push({
        factText: `User reminder/task: ${reminderMatch[1].trim()}`,
        category: 'habit',
        importance: 0.9,
        confidence: 0.95,
      });
    }

    // 8. Key Attributes ("my <key> is <value>", "my email is <email>", "my birthday is <date>")
    const attrMatch = text.match(/\bmy\s+([a-zA-Z0-9_\s]+?)\s+is\s+([^.!?]+)/i);
    if (attrMatch && attrMatch[1] && attrMatch[2] && !text.includes('name is') && !text.includes('preference')) {
      items.push({
        factText: `User ${attrMatch[1].trim()}: ${attrMatch[2].trim()}`,
        category: 'user_profile',
        importance: 0.85,
        confidence: 0.95,
      });
    }

    // 9. Assistant Spoken Confirmations of Scheduled Alarms/Reminders
    if (assistantReply && (assistantReply.includes('scheduled') || assistantReply.includes('reminder') || assistantReply.includes('alarm'))) {
      items.push({
        factText: `System confirmation: ${assistantReply.trim()}`,
        category: 'habit',
        importance: 0.75,
        confidence: 0.9,
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
