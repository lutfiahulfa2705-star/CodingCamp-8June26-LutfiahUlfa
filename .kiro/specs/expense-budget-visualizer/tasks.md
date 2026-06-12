# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement a single-page, mobile-first expense tracker using vanilla HTML/CSS/JS with Chart.js. All logic lives in three files (`index.html`, `css/styles.css`, `js/app.js`). Tasks follow the data flow: scaffold → storage/validation → transaction store → UI renderers → chart → optional features → integration.

## Tasks

- [x] 1. Scaffold project structure and HTML shell
  - Create `index.html` with semantic markup: form fields (`#item-name`, `#amount`, `#category`), `#add-btn`, `#form-error` (aria-live="polite"), `#balance-display`, `#transaction-list`, `#chart-container` with a `<canvas>`, and `#monthly-summary` placeholder
  - Create `css/styles.css` with CSS custom properties for light theme (`:root[data-theme="light"]`) and dark theme (`:root[data-theme="dark"]`), responsive layout from 320px–1280px, and minimum 44×44px touch targets
  - Create `js/app.js` as an empty IIFE scaffold with module stubs (`StorageManager`, `Validator`, `TransactionStore`, `App`)
  - Add Chart.js via CDN `<script>` tag in `index.html`
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3_

- [x] 2. Implement StorageManager and Validator
  - [x] 2.1 Implement `StorageManager`
    - Write `save(transactions)` using `JSON.stringify` + `localStorage.setItem` with key `"expense_transactions"`
    - Write `load()` using `localStorage.getItem` + `JSON.parse`; return `[]` on any error and log a console warning
    - Write `saveTheme(theme)` and `loadTheme()` using key `"expense_theme"`; default to `'light'` when absent
    - Handle `localStorage` unavailability (quota exceeded / private mode) gracefully; set a flag for the App to show a non-blocking warning banner
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 2.2 Write property test for StorageManager (Property 6 & 10)
    - **Property 6: Local Storage round-trip preserves transaction data** — generate arrays of valid `Transaction` objects with `fast-check`; call `save()` then `load()`; assert deep equality of ids, names, amounts, categories, timestamps
    - **Property 10: Theme persistence round-trip** — generate `fc.constantFrom('light', 'dark')`; call `saveTheme()` then `loadTheme()`; assert returned value equals input
    - **Validates: Requirements 5.1, 5.2, 5.3; 11.3**
    - Tag: `// Feature: expense-budget-visualizer, Property 6` and `Property 10`

  - [x] 2.3 Implement `Validator`
    - Write `validate(name, amount, category)` returning `{ valid: boolean, errors: string[] }`
    - Rule: `name.trim().length > 0`; error message: `"Please enter an item name."`
    - Rule: `parseFloat(amount) > 0` and `isFinite(amount)`; error message: `"Please enter a positive amount."`
    - Rule: `['Food', 'Transport', 'Fun'].includes(category)`; error message: `"Please select a category."`
    - _Requirements: 1.2, 1.3_

  - [ ]* 2.4 Write property tests for Validator (Property 2 & 7)
    - **Property 2: Whitespace-only names are rejected** — generate strings via `fc.stringOf(fc.constantFrom(' ', '\t', '\n'))`; assert `validate()` returns `{ valid: false }`
    - **Property 7: Negative or zero amounts are rejected** — generate `0`, negatives, `NaN`, `Infinity`, non-numeric strings via `fc.oneof(...)`; assert `validate()` returns `{ valid: false }`
    - **Validates: Requirements 1.2, 1.3**
    - Tag: `// Feature: expense-budget-visualizer, Property 2` and `Property 7`

- [x] 3. Implement TransactionStore
  - [x] 3.1 Implement `TransactionStore` core operations
    - Initialize `let transactions = []` loaded from `StorageManager.load()` on startup
    - Write `add(transaction)` — appends transaction object, calls `StorageManager.save()`, then calls `render()`
    - Write `remove(id)` — filters out by id, calls `StorageManager.save()`, then calls `render()`
    - Write `getAll()` — returns shallow copy of array
    - Write `getTotalBalance()` — returns sum of all `amount` fields; returns `0` for empty array
    - Write `getTotalsByCategory()` — returns `{ Food: n, Transport: n, Fun: n }` summing per category
    - Generate unique ids using `crypto.randomUUID()` with fallback to `Date.now().toString(36) + Math.random().toString(36).slice(2)`
    - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 5.1, 5.2_

  - [ ]* 3.2 Write property tests for TransactionStore (Property 1, 3, 4 & 5)
    - **Property 1: Valid transaction is added and retrievable** — generate `{name: nonEmpty string, amount: positive float, category: one of enum}`; call `add()`; assert `getAll()` contains the transaction
    - **Property 3: Balance equals sum of all transaction amounts** — generate sequences of add/delete operations; assert `getTotalBalance()` equals arithmetic sum of stored amounts after each mutation
    - **Property 4: Delete removes transaction permanently** — generate store state, pick random id, call `remove(id)`; assert `getAll()` contains no transaction with that id
    - **Property 5: Category totals consistent with transaction list** — generate multi-category sets; assert per-category sums match `getTotalsByCategory()` and their sum equals `getTotalBalance()`
    - **Validates: Requirements 1.4, 2.1, 2.4, 3.1–3.4, 4.1, 4.2**
    - Tag: `// Feature: expense-budget-visualizer, Property 1`, `Property 3`, `Property 4`, `Property 5`

- [x] 4. Implement `getGroupedByMonth` and `getSorted` on TransactionStore
  - [x] 4.1 Implement `getGroupedByMonth()` and `getSorted(direction)`
    - Write `getGroupedByMonth()` — groups transactions by `'YYYY-MM'` key derived from `createdAt`; returns object of `{ 'YYYY-MM': Transaction[] }`
    - Write `getSorted(direction)` — returns sorted copy: `'asc'` | `'desc'` by `amount`; direction `null` returns unsorted copy
    - _Requirements: 9.1, 9.2, 10.1, 10.2_

  - [ ]* 4.2 Write property tests for grouping and sorting (Property 8 & 9)
    - **Property 8: Sort order invariant** — generate unsorted transaction list; sort asc; assert every adjacent pair `(a, b)` has `a.amount <= b.amount`; sort desc; assert `a.amount >= b.amount`
    - **Property 9: Monthly grouping covers all transactions** — generate transactions with varying `createdAt` months; assert union of all grouped arrays equals `getAll()` with no duplicates and no omissions
    - **Validates: Requirements 9.1, 9.2, 10.1, 10.2**
    - Tag: `// Feature: expense-budget-visualizer, Property 8` and `Property 9`

- [x] 5. Checkpoint — Ensure all tests pass
  - Run all unit and property tests; confirm `StorageManager`, `Validator`, and `TransactionStore` pass cleanly. Ask the user if questions arise.

- [x] 6. Implement UI renderers (BalanceController and TransactionListRenderer)
  - [x] 6.1 Implement `BalanceController`
    - Write `render(balance)` — formats `balance` as currency and writes to `#balance-display`
    - Show `0` (formatted) when balance is zero
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 6.2 Implement `TransactionListRenderer`
    - Write `render(transactions)` — rebuilds `#transaction-list` using a `DocumentFragment`
    - Each `<li>` has class `transaction-item`, `data-id="{id}"`, child spans for name/category/amount, and a delete `<button class="delete-btn" aria-label="Delete {name}">✕</button>`
    - Apply category CSS class `category--{category}` to the category span
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 7. Implement ChartController
  - [x] 7.1 Implement `ChartController`
    - Write `init(canvasId)` — creates a Chart.js `'pie'` instance; colors: Food `#FF6384`, Transport `#36A2EB`, Fun `#FFCE56`; legend at `'bottom'`; `responsive: true`, `maintainAspectRatio: false`
    - Write `update(totalsByCategory)` — updates chart dataset and calls `chart.update()`
    - Write `showPlaceholder()` — hides canvas and shows "No spending data yet." text when no transactions exist; hide placeholder and show canvas otherwise
    - Add `role="img"` and `aria-label` describing the chart on the canvas element
    - Handle Chart.js CDN load failure: check `typeof Chart === 'undefined'`; show fallback text in `#chart-container` and continue without chart
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 8. Implement Input Form event handling and App bootstrap
  - [x] 8.1 Implement form helpers and event binding in `App`
    - Write `resetForm()`, `showError(message)`, `clearError()` targeting `#item-name`, `#amount`, `#category`, `#form-error`
    - Bind `#add-btn` click: read field values → call `Validator.validate()` → on failure call `showError()`; on success build `Transaction` object with id, name (trimmed), amount, category, `createdAt` and call `TransactionStore.add()`
    - Bind delete button clicks on `#transaction-list` using event delegation matching `.delete-btn`; call `TransactionStore.remove(data-id)`
    - Show storage-unavailable warning banner if `StorageManager` flagged unavailability
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.4, 5.4_

  - [x] 8.2 Implement unified `render()` function
    - Call `BalanceController.render(TransactionStore.getTotalBalance())`
    - Call `TransactionListRenderer.render(TransactionStore.getAll())`
    - Call `ChartController.update(TransactionStore.getTotalsByCategory())`; call `ChartController.showPlaceholder()` when list is empty
    - _Requirements: 2.1, 2.2, 3.1, 4.1, 4.2, 4.3_

  - [x] 8.3 Bootstrap `App.init()`
    - Load transactions from `StorageManager.load()`; populate `TransactionStore`
    - Call `ChartController.init('chart-canvas')`
    - Call `render()` to display persisted state
    - _Requirements: 5.3, 8.1_

- [~] 9. Checkpoint — Smoke test core feature end-to-end
  - Open `index.html` from file system; add a transaction; confirm list, balance, and chart all update; reload and confirm data persists. Ask the user if questions arise.

- [ ] 10. Implement optional features (Monthly Summary, Sort, Theme)
  - [~] 10.1 Implement `MonthlySummaryRenderer`
    - Write `render(groupedByMonth)` — builds monthly total rows inside `#monthly-summary`; hide section when no transactions exist
    - Wire into `render()` to call `MonthlySummaryRenderer.render(TransactionStore.getGroupedByMonth())`
    - _Requirements: 9.1, 9.2, 9.3_

  - [~] 10.2 Implement `SortController`
    - Write `getDirection()` and `toggle()` — cycles `null → 'asc' → 'desc' → null`
    - Add a sort button to `index.html`; bind click to `SortController.toggle()` and trigger `render()`
    - Update `TransactionListRenderer.render()` to accept a sorted list when sort is active: pass `TransactionStore.getSorted(SortController.getDirection())` when direction is non-null
    - _Requirements: 10.1, 10.2, 10.3_

  - [~] 10.3 Implement `ThemeController`
    - Write `apply(theme)` — sets `document.documentElement.dataset.theme`; calls `StorageManager.saveTheme(theme)`
    - Write `toggle()` — flips current theme and calls `apply()`
    - Write `init()` — calls `StorageManager.loadTheme()` and applies on startup; defaults to `'light'`
    - Add theme toggle button to `index.html` and bind click to `ThemeController.toggle()`
    - _Requirements: 11.1, 11.2, 11.3_

- [ ] 11. Apply accessibility and mobile polish
  - [~] 11.1 Audit and fix accessibility attributes
    - Ensure all interactive elements have `aria-label` or visible `<label>`; verify `#form-error` has `aria-live="polite"`; verify delete buttons have `aria-label="Delete {name}"`
    - Verify chart canvas has `role="img"` with descriptive `aria-label`
    - _Requirements: 7.3_

  - [~] 11.2 Verify responsive layout
    - Test CSS at 320px viewport: no horizontal scroll, no overflow; confirm touch targets ≥ 44×44px via computed styles
    - _Requirements: 7.1, 7.2, 7.3_

- [~] 12. Final checkpoint — Ensure all tests pass
  - Run full test suite; confirm all unit and property tests pass. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` and run via Jest (Node, no browser required)
- Checkpoints at steps 5, 9, and 12 provide incremental validation gates
- Property tests validate universal correctness properties; unit tests validate specific examples and edge cases
- The design has no backend, so no deployment or server tasks are included

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "2.3"] },
    { "id": 1, "tasks": ["2.2", "2.4", "3.1"] },
    { "id": 2, "tasks": ["3.2", "4.1"] },
    { "id": 3, "tasks": ["4.2", "6.1", "6.2", "7.1"] },
    { "id": 4, "tasks": ["8.1", "8.2"] },
    { "id": 5, "tasks": ["8.3"] },
    { "id": 6, "tasks": ["10.1", "10.2", "10.3"] },
    { "id": 7, "tasks": ["11.1", "11.2"] }
  ]
}
```
