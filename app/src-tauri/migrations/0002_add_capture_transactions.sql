PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS capture_transactions (
    id INTEGER PRIMARY KEY,
    account_id INTEGER NOT NULL,
    transaction_fingerprint TEXT NOT NULL UNIQUE,
    raw_text TEXT NOT NULL,
    normalized_text TEXT NOT NULL,
    amount_minor INTEGER NOT NULL CHECK(amount_minor >= 0 AND amount_minor <= 999999999),
    direction TEXT NOT NULL CHECK(direction IN ('debit', 'credit')),
    transaction_date TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    merchant_or_payee TEXT NOT NULL,
    mismatch_resolution TEXT NOT NULL,
    duplicate_decision TEXT NOT NULL,
    save_state TEXT NOT NULL CHECK(save_state IN ('persisted')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_capture_transactions_account_created_at_id
    ON capture_transactions(account_id, created_at DESC, id DESC);