export interface EntityCorrection {
  original: string;
  corrected: string;
  confidence: number;
  context: string;
}

export interface SemanticResult {
  rawTranscript: string;
  correctedTranscript: string;
  corrections: EntityCorrection[];
  detectedLanguage: 'en' | 'hi' | 'hinglish' | 'mixed';
  inferredEntities: Record<string, string>;
}

export class SemanticLayer {
  private static knownEntities: Map<string, string[]> = new Map([
    ['Friday', ['fraiday', 'fry day', 'freeday', 'frida', 'fryday', 'phriday', 'f.r.i.d.a.y', 'vega', 'veega', 'vaga']],
    ['Arijit Singh', ['arijit sing', 'arijeet singh', 'arjit singh', 'arijit sin', 'arjeet singh']],
    ['Taarak Mehta Ka Ooltah Chashmah', ['tarak mehta', 'tarak maheta', 'taarak maheta', 'tarak mehta ka ulta chashma', 'taarak mehta ka oolta chasma']],
    ['Vanrajsinh', ['vanraj sinh', 'vanrajsingh', 'vanraj sin', 'vanraj']],
    ['YouTube', ['you tube', 'utube', 'u tube', 'ytube', 'u-tube']],
    ['WhatsApp', ['whats app', 'watsapp', 'whatapp', 'what sapp', 'wapp']],
    ['Instagram', ['insta gram', 'insta']],
    ['Chrome', ['google chrome', 'chrom']],
    ['Spotify', ['spotyfy', 'spotifi']],
    ['Camera', ['camra', 'photo camera']],
    ['Gallery', ['photos app', 'galery', 'gallary']],
    ['Settings', ['setting', 'setings', 'system settings']],
    ['Tanmay Bhat', ['tanmay bhatt', 'tanmay bhart', 'tanmay bat', 'tanmey bhat', 'tanmay bahtt']],
    ['Pragati Setu', ['pragati setu', 'pragati detu', 'pragati dx12', 'pragati seto', 'pragati sethu', 'pragati setu app']],
    ['Aarogya Setu', ['arogya setu', 'arogya seto', 'aarogya sethu']],
  ]);

  static process(rawTranscript: string, context: {
    activeApp?: string;
    recentSearch?: string;
  }): SemanticResult {
    const corrections: EntityCorrection[] = [];
    let corrected = rawTranscript;

    // Fuzzy match against known entities — only correct if high confidence
    for (const [canonical, variants] of this.knownEntities) {
      for (const variant of variants) {
        const regex = new RegExp(`\\b${variant.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'gi');
        if (regex.test(corrected)) {
          corrected = corrected.replace(regex, canonical);
          corrections.push({
            original: variant,
            corrected: canonical,
            confidence: 0.85,
            context: `Known entity fuzzy match`,
          });
        }
      }
    }

    const detectedLanguage = this.detectLanguage(rawTranscript);

    return {
      rawTranscript,
      correctedTranscript: corrected,
      corrections,
      detectedLanguage,
      inferredEntities: {},
    };
  }

  private static detectLanguage(_text: string): 'en' | 'hi' | 'hinglish' | 'mixed' {
    return 'en';
  }

  static registerEntity(canonical: string, variants: string[]): void {
    const existing = this.knownEntities.get(canonical) || [];
    this.knownEntities.set(canonical, [...new Set([...existing, ...variants])]);
  }
}
