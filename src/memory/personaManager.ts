import { PersonaConfig } from './types';

export const FRIDAY_PERSONA_CONFIG: PersonaConfig = {
  name: 'F.R.I.D.A.Y.',
  voice: 'en-IE-EmilyNeural',
  voiceEngine: 'Microsoft Edge Neural TTS',
  title: 'Boss',
  accent: 'Irish',
  traits: ['tactical', 'loyal', 'crisp', 'witty', 'unflappable', 'proactive'],
  minSentences: 1,
  maxSentences: 4,
};

export class PersonaManager {
  /**
   * Returns the canonical F.R.I.D.A.Y. Persona Configuration.
   */
  static getPersonaConfig(): PersonaConfig {
    return { ...FRIDAY_PERSONA_CONFIG, traits: [...FRIDAY_PERSONA_CONFIG.traits] };
  }

  /**
   * Returns the canonical system persona prompt block for LLM prompts.
   */
  static getSystemPersonaPrompt(): string {
    return `You are F.R.I.D.A.Y. (Female Replacement Intelligent Digital Assistant Youth), Tony Stark's / Boss's ultra-intelligent, tactical AI assistant from Marvel's Avengers (voiced by Kerry Condon).

[PERSONALITY & VOICE IDENTITY]
- You address the user exclusively as "Boss" in every interaction naturally and respectfully.
- NEVER use any other name or generic title. The user is strictly "Boss".
- You speak with an articulate Irish cadence (en-IE-EmilyNeural): tactical, crisp, witty, unflappable, calm under pressure, loyal, and proactive.
- Speak exclusively in clear, natural English.
- Keep spoken responses concise (2 to 4 sentences max) and optimized for audio text-to-speech.
- NEVER output markdown formatting symbols like asterisks (**), hashtags (#), bullet points (- or *), or backticks (\`) in spoken answers — speak in natural, fluid sentences.
- Never output robotic error dumps or raw JSON parameter leaks.
- Always provide direct, intelligent, and insightful responses.`;
  }

  /**
   * Normalizes and cleans raw text into TTS-safe spoken text conforming to F.R.I.D.A.Y.'s persona.
   * Strips markdown symbols, raw JSON leaks, and non-Boss address.
   */
  static cleanSpokenText(text: string): string {
    if (!text || typeof text !== 'string') return 'Standing by, Boss.';

    let cleaned = text.trim();

    // 1. Handle code blocks and inline code
    if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
      // If entire text is a code block, extract inner content
      cleaned = cleaned.replace(/^```[a-zA-Z]*\n?([\s\S]*?)```$/, '$1').trim();
    } else {
      cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
    }
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

    // 2. Remove JSON leaks if present (e.g. {"toolName":...} or {"reply":...})
    if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed.reply) {
          cleaned = parsed.reply;
        } else if (parsed.parameters?.reply) {
          cleaned = parsed.parameters.reply;
        } else if (parsed.toolName) {
          cleaned = `Executing ${parsed.toolName.replace(/_/g, ' ')}, Boss.`;
        }
      } catch (_e) {
        cleaned = cleaned.replace(/\{[\s\S]*?\}/g, '');
      }
    }

    // 3. Remove Markdown headers (# Header)
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

    // 4. Remove Markdown bullet points (* item, - item, + item)
    cleaned = cleaned.replace(/^[\*\-\+]\s+/gm, '');

    // 5. Remove Bold / Italic asterisks (avoid destroying mathematical multiplication like 5 * 3 * 2)
    cleaned = cleaned.replace(/\*{2,3}(\S(?:[^*]*?\S)?)\*{2,3}/g, '$1');
    cleaned = cleaned.replace(/(?<=\s|^)\*([^\s*][^*]*?[^\s*]|[^\s*])\*(?=\s|[.,!?;:]|$)/g, '$1');

    // Remove Bold / Italic underscores (avoid destroying identifiers like user_id or snake_case)
    cleaned = cleaned.replace(/(?<=\s|^)_{1,3}(\S[^_]*?\S|\S)_{1,3}(?=\s|[.,!?;:]|$)/g, '$1');

    // 6. Remove Markdown links [text](url) -> text
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // 7. Remove blockquotes (> quote)
    cleaned = cleaned.replace(/^>\s+/gm, '');

    // 8. Enforce Boss Identity & Strip AI Clichés
    cleaned = this.enforceBossIdentity(cleaned);

    // Strip generic robot clichés
    cleaned = cleaned.replace(/as an ai language model,?\s*/gi, '');
    cleaned = cleaned.replace(/as an ai assistant,?\s*/gi, '');
    cleaned = cleaned.replace(/i am an ai,?\s*/gi, '');
    cleaned = cleaned.replace(/how can i assist you today,?\s*/gi, 'How can I assist, Boss?');

    // 9. Collapse multiple spaces and blank lines
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned || 'Standing by, Boss.';
  }

  /**
   * Formats and constrains a spoken response to 1-4 crisp sentences, ensuring Boss address.
   */
  static formatSpokenResponse(rawText: string): string {
    const cleaned = this.cleanSpokenText(rawText);
    if (!cleaned) return 'Standing by, Boss.';

    // Split into sentences
    const sentenceMatches = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
    if (!sentenceMatches || sentenceMatches.length === 0) {
      return cleaned.endsWith('.') ? cleaned : `${cleaned}, Boss.`;
    }

    // Take at most 4 sentences
    const trimmedSentences = sentenceMatches
      .slice(0, FRIDAY_PERSONA_CONFIG.maxSentences)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let result = trimmedSentences.join(' ');

    // Ensure the response addresses Boss if not already present
    if (!/\b(boss)\b/i.test(result)) {
      if (result.endsWith('.')) {
        result = result.slice(0, -1) + ', Boss.';
      } else if (result.endsWith('!')) {
        result = result.slice(0, -1) + ', Boss!';
      } else if (result.endsWith('?')) {
        result = result.slice(0, -1) + ', Boss?';
      } else {
        result += ', Boss.';
      }
    }

    return result;
  }

  /**
   * Enforces exclusive "Boss" identity by replacing forbidden names/titles.
   */
  static enforceBossIdentity(text: string): string {
    let result = text;
    // Replace titles and names with Boss
    result = result.replace(/\b(sir|master|human|user)\b/gi, 'Boss');
    result = result.replace(/\b(anthony stark|tony stark|mister stark|mr\. stark)\b/gi, 'Boss');
    result = result.replace(/\b(tony|anthony)\b/gi, 'Boss');
    result = result.replace(/\bvanrajsinh\b/gi, 'Boss');
    return result;
  }

  /**
   * Validates whether a generated response conforms to F.R.I.D.A.Y.'s persona constraints.
   */
  static validateResponse(text: string): { isValid: boolean; violations: string[]; fixedText: string } {
    const violations: string[] = [];

    if (!text || text.trim().length === 0) {
      violations.push('Response is empty');
      return { isValid: false, violations, fixedText: 'Standing by, Boss.' };
    }

    // 1. Check for Markdown symbols
    if (/[\*#`\[\]>]/.test(text)) {
      violations.push('Contains markdown formatting symbols');
    }

    // 2. Check for Raw JSON / Parameter leaks
    if (/\{[\s\S]*?\}/.test(text) || text.includes('"toolName"') || text.includes('"parameters"')) {
      violations.push('Contains raw JSON or tool parameter leak');
    }

    // 3. Check for generic AI disclaimers
    if (/as an ai/i.test(text) || /language model/i.test(text)) {
      violations.push('Contains generic AI disclaimer cliché');
    }

    // 4. Check for incorrect user titles/names
    if (/\b(sir|master|mister stark|mr\. stark|tony|anthony|vanrajsinh)\b/i.test(text)) {
      violations.push('Does not use exclusive "Boss" title');
    }

    // 5. Check sentence length (> 4 sentences)
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    if (sentences.length > FRIDAY_PERSONA_CONFIG.maxSentences) {
      violations.push(`Exceeds maximum spoken sentence limit (${sentences.length} > ${FRIDAY_PERSONA_CONFIG.maxSentences})`);
    }

    const fixedText = this.formatSpokenResponse(text);
    return {
      isValid: violations.length === 0,
      violations,
      fixedText,
    };
  }

  /**
   * Deterministic precompiled MCU F.R.I.D.A.Y. responses for instant offline fast-paths.
   */
  static getPrecompiledGreeting(type: 'wake' | 'greeting' | 'status' | 'identity' | 'capability' | 'gratitude'): string {
    switch (type) {
      case 'wake':
        return "All systems active and ready, Boss. What's the play?";
      case 'greeting':
        return "Hello, Boss. Systems nominal. How can I assist you today?";
      case 'status':
        return "All systems running at peak efficiency, Boss. What can I do for you?";
      case 'identity':
        return "I am FRIDAY (F.R.I.D.A.Y.), Boss — your tactical, ultra-intelligent AI assistant.";
      case 'capability':
        return "I can manage your device, play media on YouTube, send messages on WhatsApp, configure system toggles, and handle tactical intelligence, Boss.";
      case 'gratitude':
        return "Always a pleasure, Boss.";
    }
  }

  /**
   * Checks whether the given name/title represents the Boss identity.
   */
  static isBossIdentity(name: string): boolean {
    const lower = (name || '').toLowerCase().trim();
    return lower === 'boss' || lower === 'tony' || lower === 'tony stark';
  }
}
