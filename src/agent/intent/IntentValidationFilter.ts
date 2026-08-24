export interface ValidatedIntent {
  intentClass: 'NAVIGATION' | 'INFORMATION_SEEKING' | 'STATE_CHANGE' | 'CLARIFICATION_NEEDED';
  targetApp?: string;
  actionVerb?: string;
  parameters: Record<string, any>;
  goalType: 'APP_OPERATION' | 'SYSTEM_CONTROL' | 'MEDIA_PLAYBACK' | 'MESSAGING' | 'SEARCH' | 'GENERAL';
  terminalConditionType: 'PACKAGE_ACTIVE' | 'SINGLE_ACTION_DONE' | 'TEXT_PRESENT' | 'MUTATION_CONFIRMED';
  expectedPackage?: string;
  clarificationPrompt?: string;
}

export class IntentValidationFilter {
  private static readonly NAVIGATION_VERBS = [
    'open',
    'launch',
    'start',
    'go in',
    'go into',
    'go to',
    'head into',
    'head over to',
    'switch to',
    'bring up',
    'pull up',
    'show me',
    'khol',
    'chalu kar',
    'chalao',
  ];

  private static readonly INFO_VERBS = [
    'what',
    'who',
    'how',
    'when',
    'where',
    'why',
    'read',
    'check',
    'summarize',
    'find out',
    'tell me',
    'show notifications',
    'battery',
    'time',
    'weather',
  ];

  private static readonly STATE_CHANGE_VERBS = [
    'send',
    'text',
    'message',
    'msg',
    'call',
    'dial',
    'buy',
    'order',
    'delete',
    'remove',
    'turn on',
    'turn off',
    'set',
    'mute',
    'toggle',
    'play',
    'search',
  ];

  public static filterAndDisambiguate(rawUtterance: string): ValidatedIntent {
    const clean = rawUtterance.trim().toLowerCase();

    // 1. Check for explicit coordinating conjunctions (e.g. "open X and do Y")
    const hasConjunction = /\b(and|then|after that|and then|to)\b/i.test(clean);

    // 2. Identify pure navigation keywords
    let isExplicitNav = false;
    let targetAppFromNav = '';

    for (const navVerb of this.NAVIGATION_VERBS) {
      if (clean.startsWith(navVerb)) {
        isExplicitNav = true;
        targetAppFromNav = clean.slice(navVerb.length).trim();
        break;
      }
    }

    const hasStateChangeVerb = this.STATE_CHANGE_VERBS.some((v) =>
      new RegExp(`\\b${v}\\b`, 'i').test(clean)
    );
    const hasInfoVerb = this.INFO_VERBS.some((v) =>
      new RegExp(`\\b${v}\\b`, 'i').test(clean)
    );

    // RULE 1: Pure Navigation Filter (e.g. "go in WhatsApp", "open YouTube", "launch Camera")
    // If the utterance starts with a navigation phrase AND does NOT have state-change verbs/conjunctions
    if (isExplicitNav && !hasStateChangeVerb && !hasInfoVerb && !hasConjunction) {
      const appName = targetAppFromNav || clean;
      return {
        intentClass: 'NAVIGATION',
        targetApp: appName,
        actionVerb: 'launch_app',
        parameters: { packageNameOrName: appName },
        goalType: 'APP_OPERATION',
        terminalConditionType: 'PACKAGE_ACTIVE',
      };
    }

    // RULE 2: Media Playback
    if (clean.includes('play') || clean.includes('song') || clean.includes('music') || clean.includes('video')) {
      return {
        intentClass: 'STATE_CHANGE',
        actionVerb: 'play_media',
        parameters: { query: rawUtterance },
        goalType: 'MEDIA_PLAYBACK',
        terminalConditionType: 'MUTATION_CONFIRMED',
      };
    }

    // RULE 3: Messaging with Parameter Completeness Gate
    if (clean.includes('send') || clean.includes('message') || clean.includes('text') || clean.includes('msg')) {
      const hasRecipient = /\bto\s+([a-zA-Z0-9_ ]+)/i.test(clean) || /\b(text|message)\s+([a-zA-Z0-9_]+)/i.test(clean);
      const hasBody = /["'“](.+?)["'”]/i.test(clean) || /\b(?:saying|that)\s+(.+)/i.test(clean);

      if (!hasRecipient && !hasBody && isExplicitNav) {
        // User said "go in WhatsApp" or "open messages" without a recipient or text:
        // Strictly treat as PURE NAVIGATION!
        return {
          intentClass: 'NAVIGATION',
          targetApp: targetAppFromNav || 'messages',
          actionVerb: 'launch_app',
          parameters: { packageNameOrName: targetAppFromNav || 'messages' },
          goalType: 'APP_OPERATION',
          terminalConditionType: 'PACKAGE_ACTIVE',
        };
      }

      return {
        intentClass: 'STATE_CHANGE',
        actionVerb: 'send_message',
        parameters: { raw: rawUtterance },
        goalType: 'MESSAGING',
        terminalConditionType: 'MUTATION_CONFIRMED',
      };
    }

    // RULE 4: Information Seeking
    if (hasInfoVerb && !hasStateChangeVerb) {
      return {
        intentClass: 'INFORMATION_SEEKING',
        actionVerb: 'query_info',
        parameters: { query: rawUtterance },
        goalType: 'GENERAL',
        terminalConditionType: 'SINGLE_ACTION_DONE',
      };
    }

    // RULE 5: Default Fallback
    return {
      intentClass: 'STATE_CHANGE',
      actionVerb: 'execute',
      parameters: { raw: rawUtterance },
      goalType: 'GENERAL',
      terminalConditionType: 'SINGLE_ACTION_DONE',
    };
  }
}
