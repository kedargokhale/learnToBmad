PRAGMA foreign_keys = OFF;

CREATE TABLE capture_audit_trail_new (
    id INTEGER PRIMARY KEY,
    capture_transaction_id INTEGER NOT NULL,
    event_kind TEXT NOT NULL CHECK(event_kind IN ('save_persisted')),
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (capture_transaction_id) REFERENCES capture_transactions(id) ON DELETE CASCADE
);

INSERT INTO capture_audit_trail_new (id, capture_transaction_id, event_kind, payload_json, created_at)
SELECT id, capture_transaction_id, event_kind, payload_json, created_at
FROM capture_audit_trail;

DROP TABLE capture_audit_trail;
ALTER TABLE capture_audit_trail_new RENAME TO capture_audit_trail;

CREATE INDEX IF NOT EXISTS idx_capture_audit_trail_transaction_id
    ON capture_audit_trail(capture_transaction_id);

PRAGMA foreign_keys = ON;
