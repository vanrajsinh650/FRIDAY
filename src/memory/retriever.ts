import { MemoryStore } from './store';
import { MemoryFact } from './types';

export class ScopedMemoryRetriever {
  static retrieveRelevantFacts(goal: string, activePackage?: string): MemoryFact[] {
    const all = MemoryStore.getAllFacts();
    if (all.length === 0) {
      return [];
    }

    const query = goal.toLowerCase();
    const scored = all.map((fact) => {
      let score = 0;
      if (query.includes(fact.key.toLowerCase())) score += 5;
      if (query.includes(fact.value.toLowerCase())) score += 3;
      if (activePackage && fact.value.toLowerCase().includes(activePackage.toLowerCase())) score += 2;
      return { fact, score };
    });

    const matching = scored.filter((s) => s.score > 0);
    if (matching.length > 0) {
      matching.sort((a, b) => b.score - a.score);
      return matching.slice(0, 20).map((s) => s.fact);
    }

    return all.slice(0, 20);
  }
}
