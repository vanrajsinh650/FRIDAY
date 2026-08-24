export class SafetyGuard {
  private static protectedKeywords = [
    'delete all',
    'delete photo',
    'delete video',
    'delete contact',
    'delete message',
    'format storage',
    'factory reset',
    'factory_reset',
    'factoryreset',
    'wipe phone',
    'rm -rf',
    'rm -r',
    'uninstall all',
    'delete dcim',
    'delete download',
    'delete whatsapp',
    'master clear',
    'reboot bootloader',
    'reboot recovery',
  ];

  static isActionSafe(toolName: string, params: Record<string, any>): { safe: boolean; reason?: string } {
    const serialized = JSON.stringify({ toolName, params }).toLowerCase();
    const normalized = serialized.replace(/[^a-z0-9]/g, ' ');
    for (const keyword of this.protectedKeywords) {
      const cleanKeyword = keyword.toLowerCase();
      const normKeyword = cleanKeyword.replace(/[^a-z0-9]/g, ' ');
      if (
        serialized.includes(cleanKeyword) ||
        normalized.includes(normKeyword) ||
        normalized.includes(cleanKeyword)
      ) {
        return {
          safe: false,
          reason: `Safety Shield blocked potentially destructive action matching protected rule: "${keyword}". Personal files and media are protected.`,
        };
      }
    }
    return { safe: true };
  }
}
