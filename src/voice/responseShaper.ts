export class ResponseShaper {
  static shape(text: string): string {
    if (!text) return '';
    let shaped = text;

    // 1. Remove JSON artifacts or technical parameter leaks
    shaped = shaped
      .replace(/\{[\s\S]*"toolName"[\s\S]*\}/gi, '')
      .replace(/parameters?\s*:\s*null/gi, '')
      .replace(/parameters?\s*:\s*\{[^}]*\}/gi, '')
      .replace(/toolName\s*:\s*"?\w+"?/gi, '')
      .replace(/\{"reply"\s*:\s*"/gi, '')
      .replace(/"\s*,\s*"toolName"[\s\S]*/gi, '')
      .replace(/\\n/g, ' ')
      .replace(/\\"/g, '"');

    // 2. Strip Markdown symbols (bullets, bold, headers, code backticks)
    shaped = shaped
      .replace(/[*_#`~\[\]]/g, '')
      .replace(/^\s*[-•]\s*/gm, '')
      .replace(/\s+/g, ' ');

    // 3. Use natural contractions
    shaped = shaped
      .replace(/\bI am\b/g, "I'm")
      .replace(/\bI will\b/g, "I'll")
      .replace(/\bI have\b/g, "I've")
      .replace(/\bdo not\b/g, "don't")
      .replace(/\bcannot\b/g, "can't")
      .replace(/\bit is\b/g, "it's")
      .replace(/\bthat is\b/g, "that's")
      .replace(/\bwhat is\b/g, "what's")
      .replace(/\byou are\b/g, "you're");

    // 4. Remove robotic operation narration
    shaped = shaped
      .replace(/I'm now opening /gi, 'Opening ')
      .replace(/I have successfully /gi, '')
      .replace(/I'm going to /gi, '')
      .replace(/I am currently /gi, '')
      .replace(/I will now /gi, '');

    // 5. Keep generous spoken length (up to 800 chars) for rich explanations without arbitrary cutoffs
    if (shaped.length > 800) {
      shaped = shaped.slice(0, 800).replace(/\s+\S*$/, '') + '.';
    }

    return shaped.trim();
  }
}
