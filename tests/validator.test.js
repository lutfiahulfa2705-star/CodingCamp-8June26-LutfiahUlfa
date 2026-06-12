/**
 * Unit tests for Validator
 *
 * Coverage:
 *  - Valid inputs pass
 *  - Empty / whitespace-only name fails
 *  - Zero, negative, and NaN amounts fail
 *  - Invalid category fails
 *  - Multiple simultaneous errors are collected
 *
 * Validates: Requirements 1.2, 1.3
 */

'use strict';

// The IIFE in app.js exposes exports only when module.exports is available
// (i.e. when running under Node/Jest).
const { Validator } = require('../js/app.js');

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function valid(name, amount, category) {
  return Validator.validate(name, amount, category);
}

const VALID_NAME     = 'Lunch';
const VALID_AMOUNT   = 12.5;
const VALID_CATEGORY = 'Food';

// ---------------------------------------------------------------------------
// 1. Valid inputs
// ---------------------------------------------------------------------------
describe('Validator — valid inputs', () => {
  test('passes with a regular name, positive amount, and valid category Food', () => {
    const result = valid('Lunch', 12.5, 'Food');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('passes with category Transport', () => {
    const result = valid('Bus ticket', 2.0, 'Transport');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('passes with category Fun', () => {
    const result = valid('Cinema', 9.99, 'Fun');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('passes when amount is provided as a numeric string', () => {
    const result = valid('Coffee', '3.50', 'Food');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('passes when name has leading/trailing whitespace (non-empty after trim)', () => {
    const result = valid('  Groceries  ', 50, 'Food');
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Name validation
// ---------------------------------------------------------------------------
describe('Validator — name validation', () => {
  test('fails when name is an empty string', () => {
    const result = valid('', VALID_AMOUNT, VALID_CATEGORY);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Please enter an item name.');
  });

  test('fails when name is a single space', () => {
    const result = valid(' ', VALID_AMOUNT, VALID_CATEGORY);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Please enter an item name.');
  });

  test('fails when name is all whitespace (spaces, tabs, newlines)', () => {
    const result = valid('   \t\n  ', VALID_AMOUNT, VALID_CATEGORY);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Please enter an item name.');
  });

  test('fails when name is null', () => {
    const result = valid(null, VALID_AMOUNT, VALID_CATEGORY);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Please enter an item name.');
  });

  test('fails when name is undefined', () => {
    const result = valid(undefined, VALID_AMOUNT, VALID_CATEGORY);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Please enter an item name.');
  });
});

// ---------------------------------------------------------------------------
// 3. Amount validation
// ---------------------------------------------------------------------------
describe('Validator — amount validation', () => {
  test('fails when amount is zero', () => {
    const result = valid(VALID_NAME, 0, VALID_CATEGORY);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Please enter a positive amount.');
  });

  test('fails when amount is negative', () => {
    const result = valid(VALID_NAME, -5, VALID_CATEGORY);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Please enter a positive amount.');
  });

  test('fails when amount is NaN', () => {
    const result = valid(VALID_NAME, NaN, VALID_CATEGORY);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Please enter a positive amount.');
  });

  test('fails when amount is Infinity', () => {
    const result = valid(VALID_NAME, Infinity, VALID_CATEGORY);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Please enter a positive amount.');
  });

  test('fails when amount is -Infinity', () => {
    const result = valid(VALID_NAME, -Infinity, VALID_CATEGORY);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Please enter a positive amount.');
  });

  test('fails when amount is a non-numeric string', () => {
    const result = valid(VALID_NAME, 'abc', VALID_CATEGORY);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Please enter a positive amount.');
  });

  test('fails when amount is an empty string', () => {
    const result = valid(VALID_NAME, '', VALID_CATEGORY);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Please enter a positive amount.');
  });

  test('passes when amount is a very small positive number', () => {
    const result = valid(VALID_NAME, 0.01, VALID_CATEGORY);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Category validation
// ---------------------------------------------------------------------------
describe('Validator — category validation', () => {
  test('fails when category is an empty string', () => {
    const result = valid(VALID_NAME, VALID_AMOUNT, '');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Please select a category.');
  });

  test('fails when category is the default placeholder value', () => {
    // The <select> uses value="" for the placeholder option
    const result = valid(VALID_NAME, VALID_AMOUNT, '-- Select category --');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Please select a category.');
  });

  test('fails when category is an arbitrary string not in the allowed list', () => {
    const result = valid(VALID_NAME, VALID_AMOUNT, 'Entertainment');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Please select a category.');
  });

  test('fails when category is a lowercase variant (case-sensitive check)', () => {
    const result = valid(VALID_NAME, VALID_AMOUNT, 'food');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Please select a category.');
  });

  test('fails when category is undefined', () => {
    const result = valid(VALID_NAME, VALID_AMOUNT, undefined);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Please select a category.');
  });
});

// ---------------------------------------------------------------------------
// 5. Multiple errors collected at once
// ---------------------------------------------------------------------------
describe('Validator — multiple simultaneous errors', () => {
  test('returns all three error messages when all fields are invalid', () => {
    const result = valid('', 0, '');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Please enter an item name.');
    expect(result.errors).toContain('Please enter a positive amount.');
    expect(result.errors).toContain('Please select a category.');
    expect(result.errors).toHaveLength(3);
  });

  test('returns exactly two errors when name is valid but amount and category are not', () => {
    const result = valid('Lunch', -1, 'Unknown');
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors).toContain('Please enter a positive amount.');
    expect(result.errors).toContain('Please select a category.');
  });
});
