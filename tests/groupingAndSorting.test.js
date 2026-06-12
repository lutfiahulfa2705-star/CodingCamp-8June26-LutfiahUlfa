/**
 * Unit tests for TransactionStore.getGroupedByMonth() and getSorted()
 *
 * Uses the same Jest + document/localStorage mock pattern as the other test
 * files.  app.js is required fresh for each test via jest.resetModules().
 *
 * Validates: Requirements 9.1, 9.2 (Monthly Summary) and 10.1, 10.2 (Sort)
 */

'use strict';

// ---------------------------------------------------------------------------
// Minimal localStorage mock
// ---------------------------------------------------------------------------
function createLocalStorageMock() {
  let store = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key(n) {
      return Object.keys(store)[n] || null;
    },
  };
}

// ---------------------------------------------------------------------------
// Minimal document stub — every getElementById returns null so that
// render() and all DOM-touching helpers become safe no-ops.
// ---------------------------------------------------------------------------
function createDocumentStub() {
  return {
    getElementById: () => null,
    createElement: () => ({
      className: '',
      textContent: '',
      style: {},
      dataset: {},
      hidden: false,
      setAttribute: () => {},
      appendChild: () => {},
      innerHTML: '',
    }),
    createDocumentFragment: () => ({
      appendChild: () => {},
    }),
    readyState: 'complete',
    addEventListener: () => {},
    documentElement: { dataset: {} },
  };
}

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------
beforeEach(() => {
  global.localStorage = createLocalStorageMock();
  global.document = createDocumentStub();
  if (typeof global.crypto === 'undefined') {
    global.crypto = {
      randomUUID: () =>
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        }),
    };
  }
  jest.resetModules();
});

afterEach(() => {
  delete global.localStorage;
  delete global.document;
});

// ---------------------------------------------------------------------------
// Helper: fresh TransactionStore
// ---------------------------------------------------------------------------
function requireTransactionStore() {
  const mod = require('../js/app.js');
  return mod.TransactionStore;
}

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------
function makeTransaction(overrides = {}) {
  return {
    id: 'test-id-' + Math.random().toString(36).slice(2),
    name: 'Test Item',
    amount: 10.0,
    category: 'Food',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getGroupedByMonth()
// ---------------------------------------------------------------------------
describe('TransactionStore.getGroupedByMonth()', () => {
  test('returns an empty object when the store is empty', () => {
    const TS = requireTransactionStore();
    TS._init([]);
    expect(TS.getGroupedByMonth()).toEqual({});
  });

  test('groups a single transaction under its YYYY-MM key', () => {
    const TS = requireTransactionStore();
    const t = makeTransaction({ id: 'a', createdAt: '2024-06-15T10:00:00.000Z' });
    TS._init([t]);
    const grouped = TS.getGroupedByMonth();
    expect(Object.keys(grouped)).toEqual(['2024-06']);
    expect(grouped['2024-06']).toHaveLength(1);
    expect(grouped['2024-06'][0]).toEqual(t);
  });

  test('groups multiple transactions from the same month together', () => {
    const TS = requireTransactionStore();
    const t1 = makeTransaction({ id: 'a', createdAt: '2024-06-01T08:00:00.000Z' });
    const t2 = makeTransaction({ id: 'b', createdAt: '2024-06-28T20:00:00.000Z' });
    TS._init([t1, t2]);
    const grouped = TS.getGroupedByMonth();
    expect(Object.keys(grouped)).toEqual(['2024-06']);
    expect(grouped['2024-06']).toHaveLength(2);
  });

  test('separates transactions from different months into different keys', () => {
    const TS = requireTransactionStore();
    const t1 = makeTransaction({ id: 'a', createdAt: '2024-05-10T00:00:00.000Z' });
    const t2 = makeTransaction({ id: 'b', createdAt: '2024-06-10T00:00:00.000Z' });
    const t3 = makeTransaction({ id: 'c', createdAt: '2024-07-10T00:00:00.000Z' });
    TS._init([t1, t2, t3]);
    const grouped = TS.getGroupedByMonth();
    const keys = Object.keys(grouped).sort();
    expect(keys).toEqual(['2024-05', '2024-06', '2024-07']);
    expect(grouped['2024-05']).toHaveLength(1);
    expect(grouped['2024-06']).toHaveLength(1);
    expect(grouped['2024-07']).toHaveLength(1);
  });

  test('correctly mixes months with one and multiple transactions', () => {
    const TS = requireTransactionStore();
    const jan1 = makeTransaction({ id: 'j1', createdAt: '2024-01-05T00:00:00.000Z' });
    const jan2 = makeTransaction({ id: 'j2', createdAt: '2024-01-20T00:00:00.000Z' });
    const feb1 = makeTransaction({ id: 'f1', createdAt: '2024-02-14T00:00:00.000Z' });
    TS._init([jan1, jan2, feb1]);
    const grouped = TS.getGroupedByMonth();
    expect(grouped['2024-01']).toHaveLength(2);
    expect(grouped['2024-02']).toHaveLength(1);
  });

  test('the union of all grouped arrays equals the full transaction list', () => {
    const TS = requireTransactionStore();
    const transactions = [
      makeTransaction({ id: 'a', createdAt: '2024-03-01T00:00:00.000Z' }),
      makeTransaction({ id: 'b', createdAt: '2024-04-15T00:00:00.000Z' }),
      makeTransaction({ id: 'c', createdAt: '2024-03-31T00:00:00.000Z' }),
      makeTransaction({ id: 'd', createdAt: '2024-05-10T00:00:00.000Z' }),
    ];
    TS._init(transactions);
    const grouped = TS.getGroupedByMonth();
    const allGrouped = Object.values(grouped).flat();
    // Same number of transactions, same set of ids
    expect(allGrouped).toHaveLength(transactions.length);
    const groupedIds = allGrouped.map(t => t.id).sort();
    const originalIds = transactions.map(t => t.id).sort();
    expect(groupedIds).toEqual(originalIds);
  });

  test('derives the YYYY-MM key from the first 7 characters of createdAt', () => {
    const TS = requireTransactionStore();
    // Boundary: last day of year
    const t = makeTransaction({ id: 'x', createdAt: '2023-12-31T23:59:59.999Z' });
    TS._init([t]);
    const grouped = TS.getGroupedByMonth();
    expect(grouped['2023-12']).toBeDefined();
    expect(grouped['2023-12'][0].id).toBe('x');
  });

  test('does not mutate the internal transaction array', () => {
    const TS = requireTransactionStore();
    const t = makeTransaction({ id: 'z', createdAt: '2024-06-01T00:00:00.000Z' });
    TS._init([t]);
    const grouped = TS.getGroupedByMonth();
    // Mutate the returned value
    grouped['2024-06'].push(makeTransaction({ id: 'injected' }));
    // Store should still have only 1 transaction
    expect(TS.getAll()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// getSorted()
// ---------------------------------------------------------------------------
describe('TransactionStore.getSorted()', () => {
  test('returns an empty array when the store is empty', () => {
    const TS = requireTransactionStore();
    TS._init([]);
    expect(TS.getSorted('asc')).toEqual([]);
    expect(TS.getSorted('desc')).toEqual([]);
    expect(TS.getSorted(null)).toEqual([]);
  });

  test('direction "asc" returns transactions ordered from lowest to highest amount', () => {
    const TS = requireTransactionStore();
    TS._init([
      makeTransaction({ id: 'c', amount: 30 }),
      makeTransaction({ id: 'a', amount: 10 }),
      makeTransaction({ id: 'b', amount: 20 }),
    ]);
    const sorted = TS.getSorted('asc');
    const amounts = sorted.map(t => t.amount);
    expect(amounts).toEqual([10, 20, 30]);
  });

  test('direction "desc" returns transactions ordered from highest to lowest amount', () => {
    const TS = requireTransactionStore();
    TS._init([
      makeTransaction({ id: 'b', amount: 20 }),
      makeTransaction({ id: 'c', amount: 30 }),
      makeTransaction({ id: 'a', amount: 10 }),
    ]);
    const sorted = TS.getSorted('desc');
    const amounts = sorted.map(t => t.amount);
    expect(amounts).toEqual([30, 20, 10]);
  });

  test('direction null returns a copy without reordering', () => {
    const TS = requireTransactionStore();
    const t1 = makeTransaction({ id: '1', amount: 50 });
    const t2 = makeTransaction({ id: '2', amount: 10 });
    const t3 = makeTransaction({ id: '3', amount: 99 });
    TS._init([t1, t2, t3]);
    const copy = TS.getSorted(null);
    // Order is preserved (same as internal array)
    expect(copy.map(t => t.id)).toEqual(['1', '2', '3']);
  });

  test('returns a copy — mutating the result does not change the store', () => {
    const TS = requireTransactionStore();
    TS._init([makeTransaction({ id: 'orig', amount: 5 })]);
    const sorted = TS.getSorted('asc');
    sorted.push(makeTransaction({ id: 'injected', amount: 999 }));
    expect(TS.getAll()).toHaveLength(1);
  });

  test('does not mutate the original store order when sorting', () => {
    const TS = requireTransactionStore();
    const t1 = makeTransaction({ id: '1', amount: 100 });
    const t2 = makeTransaction({ id: '2', amount: 1 });
    TS._init([t1, t2]);
    // Sort ascending (would reorder)
    TS.getSorted('asc');
    // Internal order should still be t1 then t2
    const all = TS.getAll();
    expect(all[0].id).toBe('1');
    expect(all[1].id).toBe('2');
  });

  test('"asc" sort is stable for equal amounts (preserves relative order)', () => {
    const TS = requireTransactionStore();
    const t1 = makeTransaction({ id: 'first',  amount: 10 });
    const t2 = makeTransaction({ id: 'second', amount: 10 });
    const t3 = makeTransaction({ id: 'third',  amount: 10 });
    TS._init([t1, t2, t3]);
    const sorted = TS.getSorted('asc');
    // All amounts equal — order should be stable (Array.prototype.sort is
    // guaranteed stable in V8 / Node 11+)
    expect(sorted.map(t => t.id)).toEqual(['first', 'second', 'third']);
  });

  test('single transaction returns a one-element array for any direction', () => {
    const TS = requireTransactionStore();
    const t = makeTransaction({ id: 'solo', amount: 42 });
    TS._init([t]);
    expect(TS.getSorted('asc')).toHaveLength(1);
    expect(TS.getSorted('desc')).toHaveLength(1);
    expect(TS.getSorted(null)).toHaveLength(1);
  });

  test('getSorted returns all transactions (no items dropped)', () => {
    const TS = requireTransactionStore();
    const txns = [
      makeTransaction({ id: '1', amount: 5 }),
      makeTransaction({ id: '2', amount: 15 }),
      makeTransaction({ id: '3', amount: 10 }),
    ];
    TS._init(txns);
    expect(TS.getSorted('asc')).toHaveLength(3);
    expect(TS.getSorted('desc')).toHaveLength(3);
    expect(TS.getSorted(null)).toHaveLength(3);
  });

  test('"asc" adjacent-pair invariant: every a.amount <= b.amount', () => {
    const TS = requireTransactionStore();
    TS._init([
      makeTransaction({ id: 'a', amount: 99 }),
      makeTransaction({ id: 'b', amount: 1 }),
      makeTransaction({ id: 'c', amount: 50 }),
      makeTransaction({ id: 'd', amount: 25 }),
    ]);
    const sorted = TS.getSorted('asc');
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].amount).toBeLessThanOrEqual(sorted[i + 1].amount);
    }
  });

  test('"desc" adjacent-pair invariant: every a.amount >= b.amount', () => {
    const TS = requireTransactionStore();
    TS._init([
      makeTransaction({ id: 'a', amount: 99 }),
      makeTransaction({ id: 'b', amount: 1 }),
      makeTransaction({ id: 'c', amount: 50 }),
      makeTransaction({ id: 'd', amount: 25 }),
    ]);
    const sorted = TS.getSorted('desc');
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].amount).toBeGreaterThanOrEqual(sorted[i + 1].amount);
    }
  });
});
