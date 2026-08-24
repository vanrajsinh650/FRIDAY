export type IntentType = 'NOISE' | 'STOP' | 'INCOMPLETE_ACTION' | 'CONVERSATIONAL' | 'ACTIONABLE';

export interface UtteranceEvaluation {
  type: IntentType;
  cleanedText: string;
  wordCount: number;
  actionVerb?: string;
  target?: string;
  clarificationPrompt?: string;
}

export class ActionSafetyGuard {
  private static readonly NOISE_TOKENS = new Set([
    'uh', 'um', 'ah', 'er', 'hmm', 'ha', 'oh', 'a', 'an', 'the',
    'so', 'to', 'shh', 'like', 'yeah', 'yup'
  ]);

  private static readonly STOP_COMMANDS = new Set([
    'stop', 'bye', 'thank you', 'thanks', 'sleep', 'goodbye',
    'ok done', 'done', 'shut up', 'quiet', 'cancel', 'exit', 'nevermind',
    'never mind', 'stop it', 'that is all', 'thats all', "that's all",
    'that will be all', 'dismissed', 'all done', 'no thanks', 'nothing else',
    'go to sleep', 'stand down'
  ]);

  private static readonly CONVERSATIONAL_KEYWORDS = new Set([
    'time', 'date', 'battery', 'who', 'what', 'how', 'why', 'when', 'where',
    'help', 'hello', 'hi', 'hey', 'status', 'features', 'tell'
  ]);

  private static readonly ISOLATED_APP_NOUNS: Record<string, string> = {
    'youtube': 'What would you like to search or play on YouTube?',
    'whatsapp': 'Who would you like to message on WhatsApp?',
    'camera': 'Do you want me to open the camera for you?',
    'torch': 'Would you like me to turn the flashlight on or off?',
    'flashlight': 'Would you like me to turn the flashlight on or off?',
    'chrome': 'What would you like to search on Chrome?',
    'spotify': 'What music would you like to play on Spotify?',
    'settings': 'Which settings would you like to open?'
  };

  private static readonly ISOLATED_ACTION_VERBS: Record<string, string> = {
    'open': 'What app would you like me to open for you?',
    'launch': 'What app should I launch?',
    'play': 'What song or video should I play?',
    'send': 'Who should I send a message to?',
    'search': 'What would you like me to search for?',
    'call': 'Who would you like to call?'
  };

  static isNoiseOrArtifact(text: string): boolean {
    const cleaned = (text || '').trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, '');
    if (!cleaned || cleaned.length < 2) return true;
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return true;
    if (words.length === 1 && this.CONVERSATIONAL_KEYWORDS.has(words[0])) return false;
    if (words.every(w => this.NOISE_TOKENS.has(w))) return true;
    if (!/[a-z0-9]/i.test(cleaned)) return true;
    return false;
  }

  static isStopCommand(text: string): boolean {
    const lower = (text || '').trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, '');
    return this.STOP_COMMANDS.has(lower);
  }

  static isActionableCommand(query: string): boolean {
    const evaluation = this.evaluate(query);
    return evaluation.type === 'ACTIONABLE';
  }

  static evaluate(rawText: string): UtteranceEvaluation {
    const text = (rawText || '').trim();
    const normalized = text.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = normalized.split(/\s+/).filter(w => w.length > 0);

    if (this.isNoiseOrArtifact(text)) {
      return { type: 'NOISE', cleanedText: text, wordCount: words.length };
    }

    if (this.STOP_COMMANDS.has(normalized)) {
      return { type: 'STOP', cleanedText: text, wordCount: words.length };
    }

    // Conversational Single-Word or Multi-Word Queries
    const isConversational =
      words.some(w => this.CONVERSATIONAL_KEYWORDS.has(w)) ||
      /^(who are you|how are you|what can you do|what time is it|what is the time|what is my battery|battery status|battery level|battery percentage|wake up|hey friday|hi friday|hello friday|what is today|help)\b/i.test(normalized);

    if (isConversational && !/(play|open|launch|send|call|kill|force stop|root|shizuku|elevated|torch|flashlight|wifi|bluetooth|hotspot)\b/i.test(normalized)) {
      return { type: 'CONVERSATIONAL', cleanedText: text, wordCount: words.length };
    }

    // Check for single isolated app nouns
    if (words.length === 1 && this.ISOLATED_APP_NOUNS[normalized]) {
      return {
        type: 'INCOMPLETE_ACTION',
        cleanedText: text,
        wordCount: 1,
        target: normalized,
        clarificationPrompt: this.ISOLATED_APP_NOUNS[normalized]
      };
    }

    // Check for single isolated action verbs
    if (words.length === 1 && this.ISOLATED_ACTION_VERBS[normalized]) {
      return {
        type: 'INCOMPLETE_ACTION',
        cleanedText: text,
        wordCount: 1,
        actionVerb: normalized,
        clarificationPrompt: this.ISOLATED_ACTION_VERBS[normalized]
      };
    }

    // Action Verb + Target Pattern
    const actionPattern = /\b(open|launch|start|play|send|message|text|search|turn on|turn off|enable|disable|toggle|set|clear|close|call|dial)\b/i;
    if (actionPattern.test(normalized)) {
      return { type: 'ACTIONABLE', cleanedText: text, wordCount: words.length };
    }

    // Fallback for general queries: pass to conversational/agent
    return {
      type: 'CONVERSATIONAL',
      cleanedText: text,
      wordCount: words.length
    };
  }
}
