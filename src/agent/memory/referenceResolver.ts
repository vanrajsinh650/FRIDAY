import { SessionManager } from '../session/sessionManager';

export class ReferenceResolver {
  static resolveUserGoal(rawInput: string, currentPackage: string): { resolvedGoal: string; resolvedApp?: string; entities: Record<string, string> } {
    const input = rawInput.trim();
    const lower = input.toLowerCase();
    const session = SessionManager.getSession();
    const entities: Record<string, string> = {};

    let resolvedGoal = input;
    let resolvedApp = session.currentApp || undefined;

    // 1. Resolve active app from current foreground or previous turn
    if (!resolvedApp && currentPackage && !currentPackage.includes('com.friday') && !currentPackage.includes('launcher')) {
      resolvedApp = currentPackage;
    }

    // 1b. Task modification: "actually..." / "wait..." / "no, ..."
    if (
      lower.startsWith('actually ') ||
      lower.startsWith('actually, ') ||
      lower.startsWith('wait ') ||
      lower.startsWith('wait, ') ||
      lower.startsWith('no ') ||
      lower.startsWith('no, ')
    ) {
      const modified = input.replace(/^(actually|wait|no),?\s*/i, '').trim();
      if (modified.length > 0) {
        return this.resolveUserGoal(modified, currentPackage);
      }
    }

    // 2. Reference: "the first one" / "play the first result" / "play first one"
    if (
      lower.includes('first one') ||
      lower.includes('first result') ||
      lower.includes('pehla') ||
      lower.includes('pehli') ||
      lower === 'play it' ||
      lower === 'open it' ||
      lower === 'play that'
    ) {
      if (session.currentGoal) {
        resolvedGoal = `Play the first result for ${session.currentGoal}`;
      } else if (resolvedApp?.includes('youtube')) {
        resolvedGoal = `Play the first search result on YouTube`;
      } else {
        resolvedGoal = `Click the first result`;
      }
    }

    // 2b. Reference: "the second one" / "second result" / "doosra" / "second wala"
    if (
      lower.includes('second one') ||
      lower.includes('second result') ||
      lower.includes('doosra') ||
      lower.includes('dusra') ||
      lower.includes('second wala')
    ) {
      if (session.currentGoal) {
        resolvedGoal = `Play the second result for ${session.currentGoal}`;
      } else if (resolvedApp?.includes('youtube')) {
        resolvedGoal = `Play the second search result on YouTube`;
      } else {
        resolvedGoal = `Click the second result`;
      }
    }

    // 2c. "third one" / "teesra" / "third wala"
    if (
      lower.includes('third one') ||
      lower.includes('third result') ||
      lower.includes('teesra') ||
      lower.includes('tisra') ||
      lower.includes('third wala')
    ) {
      if (session.currentGoal) {
        resolvedGoal = `Play the third result for ${session.currentGoal}`;
      } else if (resolvedApp?.includes('youtube')) {
        resolvedGoal = `Play the third search result on YouTube`;
      } else {
        resolvedGoal = `Click the third result`;
      }
    }

    // 3. Reference: "search <query>" without specifying YouTube/Chrome when YouTube was previously active
    if (
      (lower.startsWith('search ') || lower.startsWith('find ') || lower.includes('dhoondo')) &&
      !lower.includes('on youtube') &&
      !lower.includes('in youtube') &&
      !lower.includes('on chrome') &&
      !lower.includes('in chrome')
    ) {
      const query = input.replace(/^(search|find|dhoondo)\s+/i, '').trim();
      entities.searchQuery = query;
      if (resolvedApp?.includes('youtube') || currentPackage.includes('youtube')) {
        resolvedGoal = `Open YouTube, search ${query} and play the first result`;
        resolvedApp = 'com.google.android.youtube';
      } else {
        resolvedGoal = `Search ${query}`;
      }
    }

    // 4. Reference: "send <message>" / "message him <text>" without specifying contact
    if (
      (lower.startsWith('send ') || lower.startsWith('message him ') || lower.startsWith('text him ')) &&
      !lower.includes(' to ')
    ) {
      const msg = input.replace(/^(send|message him|text him|bhejo)\s+/i, '').trim();
      resolvedGoal = `Open WhatsApp and send "${msg}" to recent contact`;
      resolvedApp = 'com.whatsapp';
    }

    // Extract explicit entities if present in current utterance
    if (lower.includes('youtube')) {
      resolvedApp = 'com.google.android.youtube';
      const searchMatch = input.match(/(?:search|find|play|dhoondo)\s+(.+?)(?:\s+(?:on|in)\s+youtube|\s+and\s+play|$)/i);
      if (searchMatch) {
        entities.searchQuery = searchMatch[1].trim();
      }
    } else if (lower.includes('whatsapp')) {
      resolvedApp = 'com.whatsapp';
      const contactMatch = input.match(/(?:to|ko)\s+([a-zA-Z0-9\s]+?)(?:\s+(?:saying|message|that)|$)/i);
      if (contactMatch) {
        entities.contact = contactMatch[1].trim();
      }
    }

    return { resolvedGoal, resolvedApp, entities };
  }
}
