/**
 * Unit tests for TransactionStore
 *
 * TransactionStore is extracted from the IIFE in app.js via the CommonJS
 * module.exports guard at the bottom of the file.
 *
 * Because add() and remove() call the top-level render() function (which
 * touches the DOM), we mock render by injecting a no-op on global before
 * requiring the module.  The app.js IIFE captures `render` from its own
 * closure scope — however, since render() is defined at IIFE scope and
 * calls DOM helpers that are guarded by `if (el)` checks, we can avoid the
 * crash by simply providing stub DOM globals.  Alternatively, we redirect
 * the relevant document queries to return null via a minimal document stub.
 *
 * Approach chosen: install a minimal `global.document` stub that returns
 * null for all getElementById calls.  This makes every DOM guard inside
 * BalanceController, TransactionListRenderer, ChartController, etc. a
 * safe no-op.  render() itself is thus a harmless no-op in Node/Jest.
 *
 * Because app.js also accesses localStorage at module-init time we also
 * provide a minimal localStorage mock.
 *
 * Validates: Requirements 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 5.1, 5.2
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
// Helper: build a fresh TransactionStore (and friends) in a clean module
// environment. Must be called after mocks are installed on `global`.
// ---------------------------------------------------------------------------
function requireTransactionStore() {
  const mod = require('../js/app.js');
  return mod.TransactionStore;
}

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------
beforeEach(() => {
  global.localStorage = createLocalStorageMock();
  global.document = createDocumentStub();
  // crypto.randomUUID is available in Node 15+; provide a fallback just in
  // case the test runner is older.
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
// 1. getAll()
// ---------------------------------------------------------------------------
describe('TransactionStore.getAll()', () => {
  test('returns an empty array when the store is freshly initialised', () => {
    const TS = requireTransactionStore();
    TS._init([]);
    expect(TS.getAll()).toEqual([]);
  });

  test('returns a shallow copy — mutating the result does not affect the store', () => {
    const TS = requireTransactionStore();
    const t = makeTransaction({ id: 'a1' });
    TS._init([t]);

    const copy = TS.getAll();
    copy.push(makeTransaction({ id: 'extra' }));

    expect(TS.getAll()).toHaveLength(1);
  });

  test('returns all transactions added via add()', () => {
    const TS = requireTransactionStore();
    TS._init([]);

    const t1 = makeTransaction({ id: 'a', name: 'Coffee' });
    const t2 = makeTransaction({ id: 'b', name: 'Bus' });
    TS.add(t1);
    TS.add(t2);

    const all = TS.getAll();
    expect(all).toHaveLength(2);
    expect(all.find(t => t.id === 'a')).toBeDefined();
    expect(all.find(t => t.id === 'b')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 2. add()
// ---------------------------------------------------------------------------
describe('TransactionStore.add()', () => {
  test('adds a transaction that can be retrieved by getAll()', () => {
    const TS = requireTransactionStore();
    TS._init([]);
    const t = makeTransaction({ id: 'x1', name: 'Lunch', amount: 12.5, category: 'Food' });
    TS.add(t);
    expect(TS.getAll()).toContainEqual(t);
  });

  test('appends to existing transactions (order preserved)', () => {
    const TS = requireTransactionStore();
    const first = makeTransaction({ id: '1' });
    TS._init([first]);

    const second = makeTransaction({ id: '2' });
    TS.add(second);

    const all = TS.getAll();
    expect(all[0].id).toBe('1');
    expect(all[1].id).toBe('2');
  });

  test('increments the count with each add()', () => {
    const TS = requireTransactionStore();
    TS._init([]);
    TS.add(makeTransaction({ id: 'a' }));
    TS.add(makeTransaction({ id: 'b' }));
    TS.add(makeTransaction({ id: 'c' }));
    expect(TS.getAll()).toHaveLength(3);
  });

  test('persists added transactions to StorageManager (survives _init reload)', () => {
    const TS = requireTransactionStore();
    TS._init([]);
    const t = makeTransaction({ id: 'persist-me' });
    TS.add(t);

    // Simulate reload: re-require the module (same localStorage mock is in place)
    jest.resetModules();
    const mod2 = require('../js/app.js');
    const loaded = mod2.StorageManager.load();
    expect(loaded.find(tx => tx.id === 'persist-me')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 3. remove()
// ---------------------------------------------------------------------------
describe('TransactionStore.remove()', () => {
  test('removes a transaction by id so it no longer appears in getAll()', () => {
    const TS = requireTransactionStore();
    const t = makeTransaction({ id: 'del-me' });
    TS._init([t]);
    TS.remove('del-me');
    expect(TS.getAll().find(tx => tx.id === 'del-me')).toBeUndefined();
  });

  test('does not affect other transactions when one is removed', () => {
    const TS = requireTransactionStore();
    const keep = makeTransaction({ id: 'keep' });
    const gone = makeTransaction({ id: 'gone' });
    TS._init([keep, gone]);
    TS.remove('gone');

    const all = TS.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('keep');
  });

  test('is a no-op when the id does not exist (no crash, count unchanged)', () => {
    const TS = requireTransactionStore();
    const t = makeTransaction({ id: 'stay' });
    TS._init([t]);
    TS.remove('non-existent-id');
    expect(TS.getAll()).toHaveLength(1);
  });

  test('results in an empty store when the only transaction is removed', () => {
    const TS = requireTransactionStore();
    const t = makeTransaction({ id: 'only' });
    TS._init([t]);
    TS.remove('only');
    expect(TS.getAll()).toHaveLength(0);
  });

  test('persists the removal to StorageManager', () => {
    const TS = requireTransactionStore();
    const t = makeTransaction({ id: 'gone-from-storage' });
    TS._init([t]);
    TS.add(t);   // ensure it is saved first
    TS.remove('gone-from-storage');

    jest.resetModules();
    const mod2 = require('../js/app.js');
    const loaded = mod2.StorageManager.load();
    expect(loaded.find(tx => tx.id === 'gone-from-storage')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. getTotalBalance()
// ---------------------------------------------------------------------------
describe('TransactionStore.getTotalBalance()', () => {
  test('returns 0 for an empty store', () => {
    const TS = requireTransactionStore();
    TS._init([]);
    expect(TS.getTotalBalance()).toBe(0);
  });

  test('returns the amount of a single transaction', () => {
    const TS = requireTransactionStore();
    TS._init([makeTransaction({ id: 'a', amount: 42 })]);
    expect(TS.getTotalBalance()).toBe(42);
  });

  test('returns the sum of all transaction amounts', () => {
    const TS = requireTransactionStore();
    TS._init([
      makeTransaction({ id: '1', amount: 10 }),
      makeTransaction({ id: '2', amount: 20 }),
      makeTransaction({ id: '3', amount: 5.5 }),
    ]);
    expect(TS.getTotalBalance()).toBeCloseTo(35.5, 10);
  });

  test('updates correctly after add()', () => {
    const TS = requireTransactionStore();
    TS._init([]);
    TS.add(makeTransaction({ id: 'a', amount: 100 }));
    TS.add(makeTransaction({ id: 'b', amount: 50.25 }));
    expect(TS.getTotalBalance()).toBeCloseTo(150.25, 10);
  });

  test('updates correctly after remove()', () => {
    const TS = requireTransactionStore();
    TS._init([
      makeTransaction({ id: '1', amount: 100 }),
      makeTransaction({ id: '2', amount: 50 }),
    ]);
    TS.remove('2');
    expect(TS.getTotalBalance()).toBe(100);
  });

  test('returns 0 after all transactions are removed', () => {
    const TS = requireTransactionStore();
    const t = makeTransaction({ id: 'only', amount: 99 });
    TS._init([t]);
    TS.remove('only');
    expect(TS.getTotalBalance()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. getTotalsByCategory()
// ---------------------------------------------------------------------------
describe('TransactionStore.getTotalsByCategory()', () => {
  test('returns { Food: 0, Transport: 0, Fun: 0 } for an empty store', () => {
    const TS = requireTransactionStore();
    TS._init([]);
    expect(TS.getTotalsByCategory()).toEqual({ Food: 0, Transport: 0, Fun: 0 });
  });

  test('sums amounts correctly per category', () => {
    const TS = requireTransactionStore();
    TS._init([
      makeTransaction({ id: '1', amount: 10, category: 'Food' }),
      makeTransaction({ id: '2', amount: 5,  category: 'Food' }),
      makeTransaction({ id: '3', amount: 20, category: 'Transport' }),
      makeTransaction({ id: '4', amount: 15, category: 'Fun' }),
    ]);
    const totals = TS.getTotalsByCategory();
    expect(totals.Food).toBeCloseTo(15, 10);
    expect(totals.Transport).toBeCloseTo(20, 10);
    expect(totals.Fun).toBeCloseTo(15, 10);
  });

  test('leaves categories at 0 that have no transactions', () => {
    const TS = requireTransactionStore();
    TS._init([makeTransaction({ id: '1', amount: 7, category: 'Fun' })]);
    const totals = TS.getTotalsByCategory();
    expect(totals.Food).toBe(0);
    expect(totals.Transport).toBe(0);
    expect(totals.Fun).toBe(7);
  });

  test('sum of all category totals equals getTotalBalance()', () => {
    const TS = requireTransactionStore();
    TS._init([
      makeTransaction({ id: '1', amount: 12.5,  category: 'Food' }),
      makeTransaction({ id: '2', amount: 3.75,  category: 'Transport' }),
      makeTransaction({ id: '3', amount: 20.0,  category: 'Fun' }),
      makeTransaction({ id: '4', amount: 8.25,  category: 'Food' }),
    ]);
    const totals = TS.getTotalsByCategory();
    const categorySum = totals.Food + totals.Transport + totals.Fun;
    expect(categorySum).toBeCloseTo(TS.getTotalBalance(), 10);
  });

  test('updates after a transaction is removed', () => {
    const TS = requireTransactionStore();
    TS._init([
      makeTransaction({ id: '1', amount: 10, category: 'Food' }),
      makeTransaction({ id: '2', amount: 30, category: 'Food' }),
    ]);
    TS.remove('2');
    expect(TS.getTotalsByCategory().Food).toBeCloseTo(10, 10);
  });
});

// ---------------------------------------------------------------------------
// 6. _generateId()
// ---------------------------------------------------------------------------
describe('TransactionStore._generateId()', () => {
  test('returns a non-empty string', () => {
    const TS = requireTransactionStore();
    const id = TS._generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  test('generates distinct ids on successive calls', () => {
    const TS = requireTransactionStore();
    const ids = new Set();
    for (let i = 0; i < 20; i++) {
      ids.add(TS._generateId());
    }
    // All 20 should be unique
    expect(ids.size).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// 7. Edge cases and interaction between methods
// ---------------------------------------------------------------------------
describe('TransactionStore — edge cases', () => {
  test('handles decimal amounts without rounding errors (small fractions)', () => {
    const TS = requireTransactionStore();
    TS._init([
      makeTransaction({ id: 'a', amount: 0.1, category: 'Food' }),
      makeTransaction({ id: 'b', amount: 0.2, category: 'Food' }),
    ]);
    // 0.1 + 0.2 === 0.30000000000000004 in IEEE 754, but toBeCloseTo handles that
    expect(TS.getTotalBalance()).toBeCloseTo(0.3, 10);
  });

  test('multiple add-remove cycles leave the store consistent', () => {
    const TS = requireTransactionStore();
    TS._init([]);
    TS.add(makeTransaction({ id: '1', amount: 100, category: 'Fun' }));
    TS.add(makeTransaction({ id: '2', amount: 200, category: 'Transport' }));
    TS.remove('1');
    TS.add(makeTransaction({ id: '3', amount: 50, category: 'Food' }));
    TS.remove('2');

    expect(TS.getAll()).toHaveLength(1);
    expect(TS.getTotalBalance()).toBe(50);
    const totals = TS.getTotalsByCategory();
    expect(totals.Food).toBe(50);
    expect(totals.Transport).toBe(0);
    expect(totals.Fun).toBe(0);
  });

  test('_init() resets the store to the provided transactions', () => {
    const TS = requireTransactionStore();
    TS._init([makeTransaction({ id: 'old' })]);
    const newTx = makeTransaction({ id: 'new', amount: 77 });
    TS._init([newTx]);

    expect(TS.getAll()).toHaveLength(1);
    expect(TS.getAll()[0].id).toBe('new');
    expect(TS.getTotalBalance()).toBe(77);
  });
});
