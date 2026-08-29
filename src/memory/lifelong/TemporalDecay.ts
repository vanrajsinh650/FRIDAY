// src/memory/lifelong/TemporalDecay.ts

/**
 * Implements Ebbinghaus-inspired exponential forgetting curve and memory stability scaling.
 */
export class TemporalDecay {
  // Half-life decay factor per minute (~0.00005)
  private static readonly DEFAULT_LAMBDA = 0.00005;

  /**
   * Computes dynamic retention score R(m, t) in [0.0, 1.0].
   * @param importance Base importance rating (0.0 to 1.0)
   * @param lastAccessedAt Timestamp of last memory access in ms
   * @param accessCount Total lifetime access count
   * @param currentTimeMs Current timestamp in ms
   */
  static computeRetention(
    importance: number,
    lastAccessedAt: number,
    accessCount: number = 1,
    currentTimeMs: number = Date.now()
  ): number {
    const elapsedMinutes = Math.max(0, (currentTimeMs - lastAccessedAt) / (1000 * 60));
    
    // Stability scales with repetition S = S0 * (1 + ln(1 + accessCount))
    const stability = 1.0 + Math.log(1.0 + Math.max(0, accessCount));
    const effectiveLambda = this.DEFAULT_LAMBDA / stability;
    
    const decay = Math.exp(-effectiveLambda * elapsedMinutes);
    const clampedImportance = Math.max(0.1, Math.min(1.0, importance));
    
    // Weighted combination of base importance and recency decay
    return clampedImportance * decay;
  }
}
