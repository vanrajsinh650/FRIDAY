import { MemoryStore } from './store';
import { MemoryFact } from './types';

export class ScopedMemoryRetriever {
  static retrieveRelevantFacts(goal: string, activePackage?: string): MemoryFact[] {
    const all = MemoryStore.getAllFacts();
    const query = goal.toLowerCase();

    // Scoped retrieval: only return facts relevant to active entities
    return all.filter((fact) => {
      const keyMatch = query.includes(fact.key.toLowerCase());
      const valMatch = query.includes(fact.value.toLowerCase());
      const pkgMatch = activePackage ? fact.value.toLowerCase().includes(activePackage.toLowerCase()) : false;
      return keyMatch || valMatch || pkgMatch;
    });
  }
}
