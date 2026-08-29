// src/memory/lifelong/ConflictArbiter.ts

import { SemanticFactRecord, FactEvaluationResult } from './types';
import { EmbeddingProvider } from './EmbeddingProvider';

export class ConflictArbiter {
  /**
   * Evaluates an incoming candidate fact against existing facts to determine CRUD action.
   */
  static evaluateFact(
    incomingText: string,
    existingFacts: SemanticFactRecord[]
  ): FactEvaluationResult {
    const incomingClean = incomingText.trim();
    if (!incomingClean) {
      return { action: 'NO_OP', reason: 'Empty candidate text' };
    }

    const incomingEmbedding = EmbeddingProvider.generateEmbedding(incomingClean);
    let bestMatch: SemanticFactRecord | null = null;
    let highestSimilarity = -1;

    for (const fact of existingFacts) {
      if (!fact.isActive) continue;
      const embedding = fact.embedding || EmbeddingProvider.generateEmbedding(fact.factText);
      const sim = EmbeddingProvider.cosineSimilarity(incomingEmbedding, embedding);
      if (sim > highestSimilarity) {
        highestSimilarity = sim;
        bestMatch = fact;
      }
    }

    // 1. Exact or near-identical fact
    if (highestSimilarity > 0.94 && bestMatch) {
      return {
        action: 'NO_OP',
        targetFactId: bestMatch.id,
        reason: 'Fact already present with high fidelity',
      };
    }

    // 2. Strong semantic overlap — check for contradiction vs refinement
    if (highestSimilarity > 0.78 && bestMatch) {
      const isContradiction = this.checkContradiction(incomingClean, bestMatch.factText);
      if (isContradiction) {
        return {
          action: 'UPDATE',
          targetFactId: bestMatch.id,
          refinedFactText: incomingClean,
          reason: `Supersedes contradictory fact: "${bestMatch.factText}"`,
        };
      } else {
        return {
          action: 'MERGE',
          targetFactId: bestMatch.id,
          refinedFactText: `${bestMatch.factText}; ${incomingClean}`,
          reason: `Refines existing fact: "${bestMatch.factText}"`,
        };
      }
    }

    // 3. Distinct new fact
    return {
      action: 'ADD',
      refinedFactText: incomingClean,
      reason: 'Novel entity/preference discovered',
    };
  }

  private static checkContradiction(textA: string, textB: string): boolean {
    const lowerA = textA.toLowerCase();
    const lowerB = textB.toLowerCase();

    // Negation checks
    const hasNegationA = /\b(not|never|dislike|hate|stopped|no longer)\b/i.test(lowerA);
    const hasNegationB = /\b(not|never|dislike|hate|stopped|no longer)\b/i.test(lowerB);
    if (hasNegationA !== hasNegationB) return true;

    // Mutually exclusive value changes (e.g. location, preferred app)
    const valueCategories = [
      /\b(lives in|moved to|resides in)\b/i,
      /\b(prefers|favorite|default)\s+(music|map|browser|chat|video)\b/i,
      /\b(volume|brightness)\s+set\s+to\b/i,
    ];

    for (const pattern of valueCategories) {
      if (pattern.test(lowerA) && pattern.test(lowerB)) {
        return true;
      }
    }

    return false;
  }
}
