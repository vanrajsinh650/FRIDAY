import { Goal, GoalCategory } from './types';
import { SemanticLayer } from '../agent/semanticLayer';

export class GoalEngine {
  static parse(rawInput: string): Goal {
    const semantic = SemanticLayer.process(rawInput, {});
    const cleaned = semantic.correctedTranscript.trim();
    const lower = cleaned.toLowerCase();

    let category: GoalCategory = 'CONVERSATION';
    let expectedOutcome = 'Answer provided or task fulfilled';
    let confirmationRequired = false;

    // 1. Information Retrieval / Inquiries (Check first so "What is battery?" is query, not control)
    if (/^(?:what|who|when|where|why|how|how much|tell me|explain|check|is there|do i have)\b/i.test(lower)) {
      category = 'INFORMATION_RETRIEVAL';
      expectedOutcome = 'Accurate factual information retrieved and spoken';
    }
    // 2. Scheduling / Alarms / Reminders
    else if (/\b(?:remind|reminder|alarm|schedule|timer|routine|calendar)\b/i.test(lower)) {
      category = 'SCHEDULING';
      expectedOutcome = 'Reminder or alarm registered in scheduler';
    }
    // 3. Device Hardware / System Control (Imperative modifications)
    else if (/\b(?:volume|brightness|torch|flashlight|battery|storage|ram|wifi|bluetooth|mute|silent|turn on|turn off|set)\b/i.test(lower)) {
      category = 'DEVICE_CONTROL';
      expectedOutcome = 'Device hardware or setting modified';
    }
    // 4. Communication / Messaging
    else if (/\b(?:send (?:a )?message|text|whatsapp|call|dial|read (?:my )?notifications)\b/i.test(lower)) {
      category = 'COMMUNICATION';
      expectedOutcome = 'Communication dispatched or notifications read';
    }
    // 5. Media & Entertainment
    else if (/\b(?:play|music|song|video|youtube|spotify|pause|resume|next track)\b/i.test(lower)) {
      category = 'MEDIA_ENTERTAINMENT';
      expectedOutcome = 'Media playback initiated';
    }
    // 6. Navigation / App Launch
    else if (/^(?:open|launch|khol|chalu|start|go to)\b/i.test(lower)) {
      category = 'NAVIGATION';
      expectedOutcome = 'Target application or surface opened in foreground';
    }

    // High risk checks
    if (/\b(?:uninstall|delete|wipe|erase|reset|factory reset|purchase|buy)\b/i.test(lower)) {
      confirmationRequired = true;
    }

    const id = `goal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    return {
      id,
      rawInput,
      objective: cleaned,
      category,
      constraints: [],
      entities: semantic.inferredEntities || {},
      expectedOutcome,
      confirmationRequired,
      createdAt: Date.now(),
    };
  }
}
