import { MemoryStore } from '../src/memory/store';
import { ScopedMemoryRetriever } from '../src/memory/retriever';

describe('Structured Memory Engine', () => {
  beforeEach(() => {
    MemoryStore.clearAll();
    MemoryStore.setFact('CONTACT', 'Mom', '+919876543210');
    MemoryStore.setFact('PREFERENCE', 'Favorite Show', 'Taarak Mehta Ka Ooltah Chashmah');
  });

  test('retrieves relevant memory facts in scoped query', () => {
    const relevant = ScopedMemoryRetriever.retrieveRelevantFacts('Call Mom right now');
    expect(relevant.length).toBe(1);
    expect(relevant[0].key).toBe('Mom');
    expect(relevant[0].value).toBe('+919876543210');
  });

  test('sets and deletes facts cleanly', () => {
    MemoryStore.setFact('FACT', 'Wifi Password', 'secret123');
    const all = MemoryStore.getAllFacts();
    const fact = all.find((f) => f.key === 'Wifi Password');
    expect(fact).toBeDefined();

    if (fact) {
      MemoryStore.deleteFact(fact.id);
      const after = MemoryStore.getAllFacts();
      expect(after.find((f) => f.key === 'Wifi Password')).toBeUndefined();
    }
  });
});
