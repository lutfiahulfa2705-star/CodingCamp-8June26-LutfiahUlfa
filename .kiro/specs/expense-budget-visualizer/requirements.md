# Requirements Document

## Introduction

Expense & Budget Visualizer is a mobile-friendly web application that helps users track their daily spending. The application displays a running total balance, a scrollable transaction history, and a pie chart showing spending distribution by category. It runs entirely in the browser using HTML, CSS, and Vanilla JavaScript, with data persisted via the Local Storage API — no backend or build tooling required.

---

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single spending record consisting of an item name, a monetary amount, and a category.
- **Category**: A classification label for a transaction; one of: Food, Transport, Fun.
- **Balance**: The cumulative sum of all transaction amounts currently stored. Starts at zero when no transactions exist.
- **Transaction_List**: The scrollable UI component that renders all stored transactions.
- **Input_Form**: The UI form used to enter and submit new transactions.
- **Validator**: The client-side logic that checks that all required fields are present and well-formed before a transaction is saved.
- **Chart**: The pie chart rendered via Chart.js that shows the spending distribution across categories.
- **Storage**: The browser's Local Storage API used to persist transaction data client-side.
- **Monthly_Summary**: An optional view that aggregates and displays transactions grouped by calendar month.
- **Sort_Control**: An optional UI control that reorders the Transaction_List by transaction amount.
- **Theme_Toggle**: An optional UI control that switches the App between dark and light visual modes.

---

## Requirements

### Requirement 1: Input Form

**User Story:** As a user, I want to enter a transaction using a form with an item name, amount, and category, so that I can record my spending quickly.

#### Acceptance Criteria

1. THE Input_Form SHALL display a text field for item name, a numeric field for amount, and a dropdown selector containing exactly the options Food, Transport, and Fun.
2. WHEN the user submits the Input_Form, THE Validator SHALL verify that the item name field is non-empty, the amount field contains a positive number, and a category has been selected.
3. IF the Validator detects a missing or invalid field value, THEN THE Input_Form SHALL display an inline error message identifying the invalid field and prevent the transaction from being saved.
4. WHEN all fields pass validation and the user submits the Input_Form, THE App SHALL add a new Transaction to Storage and reset the Input_Form fields to their default empty state.

---

### Requirement 2: Transaction List

**User Story:** As a user, I want to see all my recorded transactions in a list, so that I can review my spending history at a glance.

#### Acceptance Criteria

1. THE Transaction_List SHALL display every Transaction stored in Storage, each showing the item name, amount formatted as a currency value, and category.
2. WHEN a new Transaction is added, THE Transaction_List SHALL update to include the new entry without requiring a page reload.
3. THE Transaction_List SHALL be scrollable when the number of displayed transactions exceeds the visible viewport height of the list container.
4. WHEN the user activates the delete control for a Transaction, THE App SHALL remove that Transaction from Storage and THE Transaction_List SHALL update to reflect the removal without requiring a page reload.

---

### Requirement 3: Total Balance

**User Story:** As a user, I want to see my total balance displayed prominently at the top of the page, so that I always know my current spending total.

#### Acceptance Criteria

1. THE App SHALL display the Balance at the top of the page on every render.
2. WHEN a Transaction is added, THE App SHALL recalculate the Balance as the sum of all stored transaction amounts and update the displayed value.
3. WHEN a Transaction is deleted, THE App SHALL recalculate the Balance as the sum of all remaining stored transaction amounts and update the displayed value.
4. WHILE no Transactions are stored, THE App SHALL display a Balance of zero.

---

### Requirement 4: Visual Chart

**User Story:** As a user, I want to see a pie chart of my spending by category, so that I can understand where my money is going.

#### Acceptance Criteria

1. THE Chart SHALL render a pie chart using the Chart.js library, where each slice represents one of the three categories: Food, Transport, and Fun.
2. WHEN the transaction data changes due to an addition or deletion, THE Chart SHALL update to reflect the new per-category spending totals without requiring a page reload.
3. WHILE no Transactions are stored, THE Chart SHALL display an empty or placeholder state that communicates no data is available.
4. THE Chart SHALL display a legend identifying each category and its corresponding color.

---

### Requirement 5: Data Persistence

**User Story:** As a user, I want my transactions to be saved between browser sessions, so that I do not lose my spending history when I close or refresh the page.

#### Acceptance Criteria

1. WHEN a Transaction is added, THE Storage SHALL serialize and write all current transactions to the browser's Local Storage under a consistent key.
2. WHEN a Transaction is deleted, THE Storage SHALL serialize and write the updated transaction list to Local Storage.
3. WHEN the App initializes, THE App SHALL read all transactions from Local Storage and restore the Transaction_List, Balance, and Chart to reflect the persisted data.
4. IF Local Storage is unavailable or returns malformed data, THEN THE App SHALL initialize with an empty transaction list and display a non-blocking warning to the user.

---

### Requirement 6: Technology Stack Compliance

**User Story:** As a developer, I want the App built with plain HTML, CSS, and Vanilla JavaScript, so that it runs without any build tools or framework dependencies.

#### Acceptance Criteria

1. THE App SHALL be structured using a single HTML file, exactly one CSS file located inside the `css/` directory, and exactly one JavaScript file located inside the `js/` directory.
2. THE App SHALL use no JavaScript frameworks or libraries other than Chart.js for the Chart.
3. THE App SHALL function correctly in the current stable releases of Chrome, Firefox, Edge, and Safari without polyfills or transpilation.
4. THE App SHALL operate as a standalone web application that can be opened directly from the file system without a backend server.

---

### Requirement 7: Mobile-Friendly Layout

**User Story:** As a mobile user, I want the App to be usable on small screens, so that I can track spending from my phone.

#### Acceptance Criteria

1. THE App SHALL use a responsive layout that adapts to viewport widths from 320px to 1280px without horizontal scrolling or content overflow.
2. THE Input_Form, Transaction_List, and Chart SHALL each remain legible and fully interactive at viewport widths of 320px or greater.
3. THE App SHALL use touch-friendly tap targets with a minimum size of 44×44 CSS pixels for all interactive controls.

---

### Requirement 8: Performance

**User Story:** As a user, I want the App to load quickly and respond without noticeable lag, so that recording transactions feels effortless.

#### Acceptance Criteria

1. THE App SHALL complete initial render and display stored transactions within 2 seconds on a standard broadband connection.
2. WHEN the user submits a transaction or deletes a transaction, THE App SHALL update the Transaction_List, Balance, and Chart within 200ms of the user action.

---

## Optional Features

### Requirement 9 (Optional): Monthly Summary View

**User Story:** As a user, I want to view a summary of my spending grouped by month, so that I can compare my expenditure across different time periods.

#### Acceptance Criteria

1. WHERE the Monthly_Summary feature is enabled, THE App SHALL provide a navigable view that groups Transactions by calendar month and displays the total amount spent per month.
2. WHEN the user navigates to the Monthly_Summary view, THE App SHALL display each month for which at least one Transaction exists, along with the sum of amounts for that month.
3. WHEN transactions are added or deleted, THE Monthly_Summary SHALL recalculate and display updated monthly totals.

---

### Requirement 10 (Optional): Sort Transactions by Amount

**User Story:** As a user, I want to sort my transaction list by amount, so that I can quickly identify my largest or smallest expenses.

#### Acceptance Criteria

1. WHERE the Sort_Control is present, THE Sort_Control SHALL allow the user to select ascending or descending order by transaction amount.
2. WHEN the user activates the Sort_Control, THE Transaction_List SHALL reorder its displayed entries according to the selected sort direction.
3. WHEN a new Transaction is added while a sort order is active, THE Transaction_List SHALL insert and display the new entry in its correct sorted position.

---

### Requirement 11 (Optional): Dark/Light Mode Toggle

**User Story:** As a user, I want to switch between dark and light visual themes, so that I can use the App comfortably in different lighting conditions.

#### Acceptance Criteria

1. WHERE the Theme_Toggle is present, THE Theme_Toggle SHALL switch the App between a dark color scheme and a light color scheme when activated.
2. WHEN the user activates the Theme_Toggle, THE App SHALL apply the selected theme to all visible UI components including the Transaction_List, Input_Form, Balance display, and Chart.
3. WHEN the App initializes, THE App SHALL apply the theme last selected by the user as stored in Local Storage, defaulting to the light theme if no preference has been saved.

---

## Non-Functional Requirements

### NFR-1: Simplicity

THE App SHALL present a clean, minimal interface that requires no installation steps, account creation, or configuration by the user prior to first use.

### NFR-2: Visual Design

THE App SHALL apply consistent typography, color hierarchy, and spacing such that all text is legible and interactive controls are visually distinct from static content.
