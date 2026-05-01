PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bank_name, account_number)
);

CREATE TABLE IF NOT EXISTS ledger_entries (
    id INTEGER PRIMARY KEY,
    account_id INTEGER NOT NULL,
    entry_kind TEXT NOT NULL,
    amount_minor INTEGER NOT NULL CHECK(amount_minor >= 0 AND amount_minor <= 999999999),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    CHECK(entry_kind IN ('opening_balance'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_entries_account_entry_kind
    ON ledger_entries(account_id, entry_kind);