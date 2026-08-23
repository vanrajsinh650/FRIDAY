export class SafetyGuard {
  private static protectedKeywords = [
    'delete all',
    'delete photo',
    'delete video',
    'delete contact',
    'delete message',
    'format storage',
    'factory reset',
    'wipe phone',
    'rm -rf',
    'uninstall all',
    'delete dcim',
    'delete download',
    'delete whatsapp',
  ];

  static isActionSafe(toolName: string, params: Record<string, any>): { safe: boolean; reason?: string } {
    const serialized = JSON.stringify({ toolName, params }).toLowerCase();
    for (const keyword of this.protectedKeywords) {
      if (serialized.includes(keyword)) {
        return {
          safe: false,
          reason: `Safety Shield blocked potentially destructive action matching protected rule: "${keyword}". Personal files and media are protected.`,
        };
      }
    }
    return { safe: true };
  }
}
