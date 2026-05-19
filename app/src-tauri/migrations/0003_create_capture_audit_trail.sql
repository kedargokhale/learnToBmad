PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS capture_audit_trail (
    id INTEGER PRIMARY KEY,
    capture_transaction_id INTEGER NOT NULL UNIQUE,
    event_kind TEXT NOT NULL CHECK(event_kind IN ('save_persisted')),
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (capture_transaction_id) REFERENCES capture_transactions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_capture_audit_trail_transaction_id
    ON capture_audit_trail(capture_transaction_id);