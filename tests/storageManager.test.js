/**
 * Tests for StorageManager
 *
 * StorageManager is extracted from the IIFE in app.js for Node/Jest testing by
 * requiring app.js, which conditionally exports its modules via module.exports.
 *
 * A lightweight localStorage mock is installed before each test so that the
 * module behaves identically to the browser environment without a DOM.
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
    _store: () => store,
    _simulateQuotaError() {
      this.setItem = () => { throw new DOMException('QuotaExceededError'); };
    },
  };
}

// Install mock globally before the module is required so that the availability
// probe at module-init time uses our controllable mock.
let localStorageMock;

beforeEach(() => {
  localStorageMock = createLocalStorageMock();
  global.localStorage = localStorageMock;

  // Clear module cache so each test gets a fresh StorageManager instance
  // (important because storageAvailable is set once at module init time).
  jest.resetModules();
});

afterEach(() => {
  delete global.localStorage;
});

// ---------------------------------------------------------------------------
// Helper: require a fresh StorageManager after the mock is already in place.
// ---------------------------------------------------------------------------
function requireStorageManager() {
  const mod = require('../js/app.js');
  return mod.StorageManager;
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('StorageManager — unit tests', () => {
  describe('save() and load()', () => {
    test('load() returns [] when nothing has been saved', () => {
      const SM = requireStorageManager();
      expect(SM.load()).toEqual([]);
    });

    test('save() + load() round-trips a single transaction', () => {
      const SM = requireStorageManager();
      const transactions = [
        { id: 'abc123', name: 'Lunch', amount: 12.5, category: 'Food', createdAt: '2024-06-05T12:00:00.000Z' },
      ];
      SM.save(transactions);
      expect(SM.load()).toEqual(transactions);
    });

    test('save() + load() round-trips an array of multiple transactions', () => {
      const SM = requireStorageManager();
      const transactions = [
        { id: 'a1', name: 'Coffee', amount: 3.5,  category: 'Food',      createdAt: '2024-06-01T08:00:00.000Z' },
        { id: 'b2', name: 'Bus',    amount: 1.5,  category: 'Transport', createdAt: '2024-06-02T09:00:00.000Z' },
        { id: 'c3', name: 'Movie',  amount: 15.0, category: 'Fun',       createdAt: '2024-06-03T19:00:00.000Z' },
      ];
      SM.save(transactions);
      expect(SM.load()).toEqual(transactions);
    });

    test('load() returns [] and warns when stored JSON is malformed', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      global.localStorage.setItem('expense_transactions', '{broken json[[[');
      const SM = requireStorageManager();
      const result = SM.load();
      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    test('load() returns [] and warns when stored value is not an array', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      global.localStorage.setItem('expense_transactions', JSON.stringify({ not: 'an array' }));
      const SM = requireStorageManager();
      const result = SM.load();
      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    test('save() handles empty array', () => {
      const SM = requireStorageManager();
      SM.save([]);
      expect(SM.load()).toEqual([]);
    });
  });

  describe('saveTheme() and loadTheme()', () => {
    test('loadTheme() defaults to "light" when nothing is saved', () => {
      const SM = requireStorageManager();
      expect(SM.loadTheme()).toBe('light');
    });

    test('saveTheme("dark") + loadTheme() returns "dark"', () => {
      const SM = requireStorageManager();
      SM.saveTheme('dark');
      // loadTheme reads directly from localStorage which was just written by saveTheme.
      expect(SM.loadTheme()).toBe('dark');
    });

    // A fresh module correctly reads a pre-seeded theme value.
    test('loadTheme() returns "dark" when "dark" is already in storage', () => {
      global.localStorage.setItem('expense_theme', 'dark');
      const SM = requireStorageManager();
      // Storage was pre-seeded before module init; loadTheme should return 'dark'.
      expect(SM.loadTheme()).toBe('dark');
    });

    test('loadTheme() returns "light" for an unrecognised stored value', () => {
      global.localStorage.setItem('expense_theme', 'solarized');
      const SM = requireStorageManager();
      expect(SM.loadTheme()).toBe('light');
    });
  });

  describe('isAvailable()', () => {
    test('returns true when localStorage is functional', () => {
      const SM = requireStorageManager();
      expect(SM.isAvailable()).toBe(true);
    });

    test('returns false when localStorage throws on probe', () => {
      // Make setItem throw before the module is required so the probe fails.
      global.localStorage.setItem = () => { throw new Error('Private mode'); };
      const SM = requireStorageManager();
      expect(SM.isAvailable()).toBe(false);
    });
  });

  describe('graceful degradation on quota exceeded', () => {
    test('save() does not throw when quota is exceeded; sets unavailable flag', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const SM = requireStorageManager();
      // Simulate quota exceeded after the availability probe succeeds.
      localStorageMock._simulateQuotaError();
      expect(() => SM.save([{ id: '1', name: 'Test', amount: 1, category: 'Food', createdAt: '' }])).not.toThrow();
      expect(SM.isAvailable()).toBe(false);
      warnSpy.mockRestore();
    });
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

const fc = require('fast-check');

// Arbitraries
const categoryArb = fc.constantFrom('Food', 'Transport', 'Fun');

const transactionArb = fc.record({
  id:        fc.uuid(),
  name:      fc.string({ minLength: 1, maxLength: 80 }).filter(s => s.trim().length > 0),
  // fc.float requires 32-bit float boundaries; use Math.fround to satisfy the constraint.
  amount:    fc.float({ min: Math.fround(0.01), max: Math.fround(1_000_000), noNaN: true })
               .filter(n => n > 0),
  category:  categoryArb,
  createdAt: fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') })
               .map(d => d.toISOString()),
});

const transactionArrayArb = fc.array(transactionArb, { minLength: 0, maxLength: 50 });

describe('StorageManager — property-based tests', () => {
  // Feature: expense-budget-visualizer, Property 6
  // Property 6: Local Storage round-trip preserves transaction data
  // Validates: Requirements 5.1, 5.2, 5.3
  test(
    'Property 6: save() then load() returns deep-equal transaction array',
    () => {
      fc.assert(
        fc.property(transactionArrayArb, (transactions) => {
          // Fresh module + fresh storage for every example.
          const mockLS = createLocalStorageMock();
          global.localStorage = mockLS;
          jest.resetModules();

          const SM = requireStorageManager();
          SM.save(transactions);
          const loaded = SM.load();

          // Deep equality: same length, same ids/names/amounts/categories/timestamps.
          expect(loaded).toEqual(transactions);
        }),
        { numRuns: 100, seed: 42 }
      );
    }
  );

  // Feature: expense-budget-visualizer, Property 10
  // Property 10: Theme persistence round-trip
  // Validates: Requirements 11.3
  test(
    'Property 10: saveTheme() then loadTheme() returns the same theme value',
    () => {
      fc.assert(
        fc.property(fc.constantFrom('light', 'dark'), (theme) => {
          const mockLS = createLocalStorageMock();
          global.localStorage = mockLS;
          jest.resetModules();

          const SM = requireStorageManager();
          SM.saveTheme(theme);

          // loadTheme reads from localStorage directly; re-require to get a
          // fresh instance that reads the now-populated storage.
          jest.resetModules();
          global.localStorage = mockLS; // keep the same store
          const SM2 = requireStorageManager();
          const loaded = SM2.loadTheme();

          expect(loaded).toBe(theme);
        }),
        { numRuns: 100, seed: 42 }
      );
    }
  );
});
