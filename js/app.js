/**
 * Expense & Budget Visualizer
 * app.js — all application logic (vanilla JS, no frameworks)
 *
 * Module structure (IIFE):
 *   StorageManager        — read/write Local Storage
 *   Validator             — input validation rules
 *   TransactionStore      — in-memory store; single source of truth
 *   BalanceController     — renders #balance-display
 *   TransactionListRenderer — renders #transaction-list
 *   ChartController       — owns Chart.js instance
 *   MonthlySummaryRenderer  — renders #monthly-summary
 *   SortController        — manages sort direction state
 *   ThemeController       — manages dark/light theme
 *   App                   — bootstraps everything, wires events
 */
(function () {
  'use strict';

  /* ============================================================
     StorageManager
     ============================================================ */
  const StorageManager = (function () {
    const STORAGE_KEY = 'expense_transactions';
    const THEME_KEY   = 'expense_theme';

    /** @type {boolean} true when localStorage is available */
    let _available = true;

    function _checkAvailability() {
      if (typeof localStorage === 'undefined') return false;
      try {
        const test = '__storage_test__';
        localStorage.setItem(test, '1');
        localStorage.removeItem(test);
        return true;
      } catch (e) {
        return false;
      }
    }

    /**
     * Persist the transaction array to Local Storage.
     * @param {Transaction[]} transactions
     */
    function save(transactions) {
      if (!_available) return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
      } catch (e) {
        console.warn('[StorageManager] save() failed:', e);
        _available = false;
      }
    }

    /**
     * Load and parse the transaction array from Local Storage.
     * Returns [] and logs a warning on any error.
     * @returns {Transaction[]}
     */
    function load() {
      if (!_available) return [];
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          console.warn('[StorageManager] load() — stored data is not an array; resetting.');
          return [];
        }
        // Filter out malformed records; keep valid ones.
        return parsed.filter(function (t) {
          const ok =
            t &&
            typeof t.id === 'string' &&
            typeof t.name === 'string' &&
            typeof t.amount === 'number' &&
            ['Food', 'Transport', 'Fun'].includes(t.category) &&
            typeof t.createdAt === 'string';
          if (!ok) console.warn('[StorageManager] load() — skipping malformed record:', t);
          return ok;
        });
      } catch (e) {
        console.warn('[StorageManager] load() — JSON.parse failed:', e);
        return [];
      }
    }

    /**
     * Persist the selected theme.
     * @param {'light'|'dark'} theme
     */
    function saveTheme(theme) {
      if (!_available) return;
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (e) {
        console.warn('[StorageManager] saveTheme() failed:', e);
      }
    }

    /**
     * Load the persisted theme; defaults to 'light'.
     * @returns {'light'|'dark'}
     */
    function loadTheme() {
      try {
        const theme = localStorage.getItem(THEME_KEY);
        return theme === 'dark' ? 'dark' : 'light';
      } catch (e) {
        return 'light';
      }
    }

    /** @returns {boolean} Whether Local Storage is available */
    function isAvailable() {
      return _available;
    }

    // Run availability check immediately.
    _available = _checkAvailability();

    return { save, load, saveTheme, loadTheme, isAvailable };
  })();

  /* ============================================================
     Validator
     ============================================================ */
  const Validator = (function () {
    const VALID_CATEGORIES = ['Food', 'Transport', 'Fun'];

    /**
     * Validate form inputs.
     * @param {string} name
     * @param {string|number} amount
     * @param {string} category
     * @returns {{ valid: boolean, errors: string[] }}
     */
    function validate(name, amount, category) {
      const errors = [];

      if (!name || String(name).trim().length === 0) {
        errors.push('Please enter an item name.');
      }

      const num = parseFloat(amount);
      if (amount === '' || amount === null || amount === undefined || !isFinite(num) || num <= 0) {
        errors.push('Please enter a positive amount.');
      }

      if (!VALID_CATEGORIES.includes(category)) {
        errors.push('Please select a category.');
      }

      return { valid: errors.length === 0, errors };
    }

    return { validate };
  })();

  /* ============================================================
     TransactionStore
     ============================================================ */
  const TransactionStore = (function () {
    /** @type {Transaction[]} */
    let _transactions = [];

    /**
     * Generate a unique ID.
     * @returns {string}
     */
    function _generateId() {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
      return Date.now().toString(36) + Math.random().toString(36).slice(2);
    }

    /**
     * Add a transaction, persist, and trigger render.
     * @param {Transaction} transaction
     */
    function add(transaction) {
      _transactions.push(transaction);
      StorageManager.save(_transactions);
      render();
    }

    /**
     * Remove a transaction by id, persist, and trigger render.
     * @param {string} id
     */
    function remove(id) {
      _transactions = _transactions.filter(function (t) { return t.id !== id; });
      StorageManager.save(_transactions);
      render();
    }

    /**
     * Return a shallow copy of all transactions.
     * @returns {Transaction[]}
     */
    function getAll() {
      return _transactions.slice();
    }

    /**
     * Return the sum of all transaction amounts.
     * @returns {number}
     */
    function getTotalBalance() {
      return _transactions.reduce(function (sum, t) { return sum + t.amount; }, 0);
    }

    /**
     * Return per-category totals.
     * @returns {{ Food: number, Transport: number, Fun: number }}
     */
    function getTotalsByCategory() {
      return _transactions.reduce(
        function (acc, t) {
          if (acc.hasOwnProperty(t.category)) {
            acc[t.category] += t.amount;
          }
          return acc;
        },
        { Food: 0, Transport: 0, Fun: 0 }
      );
    }

    /**
     * Return transactions grouped by 'YYYY-MM'.
     * @returns {Object.<string, Transaction[]>}
     */
    function getGroupedByMonth() {
      return _transactions.reduce(function (acc, t) {
        const key = t.createdAt.slice(0, 7); // 'YYYY-MM'
        if (!acc[key]) acc[key] = [];
        acc[key].push(t);
        return acc;
      }, {});
    }

    /**
     * Return a sorted copy of the transaction list.
     * @param {'asc'|'desc'|null} direction
     * @returns {Transaction[]}
     */
    function getSorted(direction) {
      const copy = _transactions.slice();
      if (direction === 'asc') {
        copy.sort(function (a, b) { return a.amount - b.amount; });
      } else if (direction === 'desc') {
        copy.sort(function (a, b) { return b.amount - a.amount; });
      }
      return copy;
    }

    /**
     * Seed the store from persistent storage on startup.
     * @param {Transaction[]} transactions
     */
    function _init(transactions) {
      _transactions = transactions;
    }

    return {
      add,
      remove,
      getAll,
      getTotalBalance,
      getTotalsByCategory,
      getGroupedByMonth,
      getSorted,
      _generateId,
      _init,
    };
  })();

  /* ============================================================
     BalanceController
     ============================================================ */
  const BalanceController = (function () {
    /**
     * Format a number as currency (USD).
     * @param {number} value
     * @returns {string}
     */
    function _formatCurrency(value) {
  return `Rp. ${Number(value).toLocaleString('id-ID')}`;
}

    /**
     * Write the formatted balance to #balance-display.
     * @param {number} balance
     */
    function render(balance) {
      const el = document.getElementById('balance-display');
      if (el) el.textContent = _formatCurrency(balance);
    }

    return { render };
  })();

  /* ============================================================
     TransactionListRenderer
     ============================================================ */
  const TransactionListRenderer = (function () {
    /**
     * Format a number as currency.
     * @param {number} value
     * @returns {string}
     */
    function _formatCurrency(value) {
  return `Rp. ${Number(value).toLocaleString('id-ID')}`;
}

    /**
     * Rebuild #transaction-list from the provided array.
     * @param {Transaction[]} transactions
     */
    function render(transactions) {
      const list = document.getElementById('transaction-list');
      if (!list) return;

      const fragment = document.createDocumentFragment();

      if (transactions.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'transaction-list-empty';
        empty.textContent = 'No transactions yet. Add one above!';
        fragment.appendChild(empty);
      } else {
        transactions.forEach(function (t) {
          const li = document.createElement('li');
          li.className = 'transaction-item';
          li.dataset.id = t.id;

          const nameSpan = document.createElement('span');
          nameSpan.className = 'item-name';
          nameSpan.textContent = t.name;

          const catSpan = document.createElement('span');
          catSpan.className = 'item-category category--' + t.category;
          catSpan.textContent = t.category;

          const amtSpan = document.createElement('span');
          amtSpan.className = 'item-amount';
          amtSpan.textContent = _formatCurrency(t.amount);

          const delBtn = document.createElement('button');
          delBtn.className = 'delete-btn';
          delBtn.setAttribute('aria-label', 'Delete ' + t.name);
          delBtn.textContent = '✕';

          li.appendChild(nameSpan);
          li.appendChild(catSpan);
          li.appendChild(amtSpan);
          li.appendChild(delBtn);
          fragment.appendChild(li);
        });
      }

      list.innerHTML = '';
      list.appendChild(fragment);
    }

    return { render };
  })();

  /* ============================================================
     ChartController
     ============================================================ */
  const ChartController = (function () {
    let _chart = null;
    const COLORS = {
      Food:      '#FF6384',
      Transport: '#36A2EB',
      Fun:       '#FFCE56',
    };

    /**
     * Create the Chart.js pie instance.
     * @param {string} canvasId
     */
    function init(canvasId) {
      if (typeof Chart === 'undefined') {
        console.warn('[ChartController] Chart.js not loaded; chart disabled.');
        const container = document.getElementById('chart-container');
        if (container) {
          container.innerHTML = '<p class="chart-placeholder">Chart unavailable — CDN could not be reached.</p>';
        }
        return;
      }

      const canvas = document.getElementById(canvasId);
      if (!canvas) return;

      _chart = new Chart(canvas, {
        type: 'pie',
        data: {
          labels: ['Food', 'Transport', 'Fun'],
          datasets: [{
            data: [0, 0, 0],
            backgroundColor: [COLORS.Food, COLORS.Transport, COLORS.Fun],
            borderWidth: 2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
            },
          },
        },
      });
    }

    /**
     * Update chart data with new category totals.
     * @param {{ Food: number, Transport: number, Fun: number }} totals
     */
    function update(totals) {
      if (!_chart) return;
      _chart.data.datasets[0].data = [totals.Food, totals.Transport, totals.Fun];
      _chart.update();
    }

    /**
     * Show placeholder text when there is no data; hide when data exists.
     * @param {boolean} hasData
     */
    function showPlaceholder(hasData) {
      const canvas = document.getElementById('chart-canvas');
      const placeholder = document.getElementById('chart-placeholder');
      if (canvas) canvas.style.display = hasData ? 'block' : 'none';
      if (placeholder) placeholder.style.display = hasData ? 'none' : 'block';
    }

    return { init, update, showPlaceholder };
  })();

  /* ============================================================
     MonthlySummaryRenderer
     ============================================================ */
  const MonthlySummaryRenderer = (function () {
    function _formatCurrency(value) {
  return `Rp. ${Number(value).toLocaleString('id-ID')}`;
}

    /**
     * Render monthly totals inside #monthly-summary-content.
     * Hides the section when there are no transactions.
     * @param {Object.<string, Transaction[]>} groupedByMonth
     */
    function render(groupedByMonth) {
      const section = document.getElementById('monthly-summary');
      const content = document.getElementById('monthly-summary-content');
      if (!section || !content) return;

      const months = Object.keys(groupedByMonth).sort().reverse();

      if (months.length === 0) {
        section.hidden = true;
        return;
      }

      section.hidden = false;
      const fragment = document.createDocumentFragment();

      months.forEach(function (month) {
        const transactions = groupedByMonth[month];
        const total = transactions.reduce(function (sum, t) { return sum + t.amount; }, 0);

        const row = document.createElement('div');
        row.className = 'monthly-row';

        const monthSpan = document.createElement('span');
        monthSpan.className = 'monthly-row__month';
        monthSpan.textContent = month;

        const totalSpan = document.createElement('span');
        totalSpan.className = 'monthly-row__total';
        totalSpan.textContent = _formatCurrency(total);

        row.appendChild(monthSpan);
        row.appendChild(totalSpan);
        fragment.appendChild(row);
      });

      content.innerHTML = '';
      content.appendChild(fragment);
    }

    return { render };
  })();

  /* ============================================================
     SortController
     ============================================================ */
  const SortController = (function () {
    /** @type {'asc'|'desc'|null} */
    let _direction = null;

    /** @returns {'asc'|'desc'|null} */
    function getDirection() {
      return _direction;
    }

    /** Cycle: null → 'asc' → 'desc' → null */
    function toggle() {
      if (_direction === null)   _direction = 'asc';
      else if (_direction === 'asc')  _direction = 'desc';
      else                            _direction = null;
      _updateSortButton();
    }

    function _updateSortButton() {
      const btn = document.getElementById('sort-btn');
      if (!btn) return;
      if (_direction === 'asc')  btn.textContent = 'Sort ↑';
      else if (_direction === 'desc') btn.textContent = 'Sort ↓';
      else                            btn.textContent = 'Sort ↕';
    }

    return { getDirection, toggle };
  })();

  /* ============================================================
     ThemeController
     ============================================================ */
  const ThemeController = (function () {
    /**
     * Apply and persist a theme.
     * @param {'light'|'dark'} theme
     */
    function apply(theme) {
      document.documentElement.dataset.theme = theme;
      StorageManager.saveTheme(theme);
    }

    /** Flip the current theme. */
    function toggle() {
      const current = document.documentElement.dataset.theme;
      apply(current === 'dark' ? 'light' : 'dark');
    }

    /** Load and apply the persisted theme on startup. */
    function init() {
      apply(StorageManager.loadTheme());
    }

    return { apply, toggle, init };
  })();

  /* ============================================================
     Unified render()
     Called after every mutation to keep all views consistent.
     ============================================================ */
  function render() {
    const dir         = SortController.getDirection();
    const transactions = dir
      ? TransactionStore.getSorted(dir)
      : TransactionStore.getAll();
    const totals      = TransactionStore.getTotalsByCategory();
    const balance     = TransactionStore.getTotalBalance();
    const hasData     = transactions.length > 0;

    BalanceController.render(balance);
    TransactionListRenderer.render(transactions);
    ChartController.update(totals);
    ChartController.showPlaceholder(hasData);
    MonthlySummaryRenderer.render(TransactionStore.getGroupedByMonth());
  }

  /* ============================================================
     App — bootstrap, form helpers, event wiring
     ============================================================ */
  const App = (function () {
    /** Clear all form inputs. */
    function resetForm() {
      const nameEl  = document.getElementById('item-name');
      const amtEl   = document.getElementById('amount');
      const catEl   = document.getElementById('category');
      if (nameEl) nameEl.value = '';
      if (amtEl)  amtEl.value  = '';
      if (catEl)  catEl.value  = '';
    }

    /**
     * Display an inline validation error.
     * @param {string} message
     */
    function showError(message) {
      const el = document.getElementById('form-error');
      if (el) {
        el.textContent = message;
        el.style.display = '';
      }
    }

    /** Clear the inline validation error. */
    function clearError() {
      const el = document.getElementById('form-error');
      if (el) {
        el.textContent = '';
        el.style.display = 'none';
      }
    }

    /** Handle the Add Transaction button click. */
    function _handleAdd() {
      const name     = (document.getElementById('item-name')?.value ?? '').trim();
      const amount   = document.getElementById('amount')?.value ?? '';
      const category = document.getElementById('category')?.value ?? '';

      clearError();

      const result = Validator.validate(name, amount, category);
      if (!result.valid) {
        showError(result.errors[0]);
        return;
      }

      /** @type {Transaction} */
      const transaction = {
        id:        TransactionStore._generateId(),
        name:      name,
        amount:    parseFloat(amount),
        category:  category,
        createdAt: new Date().toISOString(),
      };

      TransactionStore.add(transaction);
      resetForm();
    const formModal = document.getElementById('form-modal');
if (formModal) formModal.hidden = true;
    }

    /** Handle delete via event delegation on #transaction-list. */
    function _handleDelete(event) {
      const btn = event.target.closest('.delete-btn');
      if (!btn) return;
      const li = btn.closest('.transaction-item');
      if (!li) return;
      const id = li.dataset.id;
      if (id) TransactionStore.remove(id);
    }

    /** Show the storage-unavailable warning banner. */
    function _showStorageWarning() {
      const el = document.getElementById('storage-warning');
      if (el) el.hidden = false;
    }

    /** Bootstrap the entire application. */
    function init() {
      // Theme
      ThemeController.init();

      // Storage availability check
      if (!StorageManager.isAvailable()) {
        _showStorageWarning();
      }

      // Load persisted transactions
      TransactionStore._init(StorageManager.load());

      // Chart
      ChartController.init('chart-canvas');

      // Initial render
      render();

      // Event: Add button
      const addBtn = document.getElementById('add-btn');
      if (addBtn) addBtn.addEventListener('click', _handleAdd);
      const openFormBtn = document.getElementById('open-form-btn');
const closeFormBtn = document.getElementById('close-form-btn');
const formModal = document.getElementById('form-modal');

if (openFormBtn && formModal) {
  openFormBtn.addEventListener('click', function () {
    formModal.hidden = false;
  });
}

if (closeFormBtn && formModal) {
  closeFormBtn.addEventListener('click', function () {
    formModal.hidden = true;
  });
}

if (formModal) {
  formModal.addEventListener('click', function (e) {
    if (e.target === formModal) {
      formModal.hidden = true;
    }
  });
}

      // Event: Submit on Enter within the form
      const form = document.getElementById('transaction-form');
      if (form) {
        form.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') _handleAdd();
        });
      }

      // Event: Delete (delegated)
      const list = document.getElementById('transaction-list');
      if (list) list.addEventListener('click', _handleDelete);

      // Event: Sort toggle
      const sortBtn = document.getElementById('sort-btn');
      if (sortBtn) {
        sortBtn.addEventListener('click', function () {
          SortController.toggle();
          render();
        });
      }

      // Event: Theme toggle
      const themeBtn = document.getElementById('theme-toggle');
      if (themeBtn) themeBtn.addEventListener('click', ThemeController.toggle.bind(ThemeController));

      // Clear error when user starts editing any field
      ['item-name', 'amount', 'category'].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', clearError);
      });
    }

    return { init };
  })();

  /* ============================================================
     Start the application when the DOM is ready.
     (Guard against Node/Jest environments where `document` is absent.)
     ============================================================ */
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', App.init);
    } else {
      App.init();
    }
  }

  /* ============================================================
     CommonJS exports for Node / Jest testing
     ============================================================ */
  /* istanbul ignore next */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Validator, StorageManager, TransactionStore };
  }

})();
