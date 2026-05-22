CREATE TABLE IF NOT EXISTS transaction_categories (
    code TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    sort_order INTEGER NOT NULL UNIQUE
);

INSERT OR IGNORE INTO transaction_categories (code, display_name, sort_order) VALUES
    ('groceries', 'Groceries', 1),
    ('dining', 'Dining', 2),
    ('transport', 'Transport', 3),
    ('shopping', 'Shopping', 4),
    ('utilities', 'Utilities', 5),
    ('entertainment', 'Entertainment', 6),
    ('healthcare', 'Healthcare', 7),
    ('education', 'Education', 8),
    ('salary', 'Salary', 9),
    ('investment', 'Investment', 10),
    ('transfer', 'Transfer', 11),
    ('other', 'Other', 12);

ALTER TABLE capture_transactions ADD COLUMN suggested_category TEXT NOT NULL DEFAULT 'other';
ALTER TABLE capture_transactions ADD COLUMN final_category TEXT NOT NULL DEFAULT 'other';
ALTER TABLE capture_transactions ADD COLUMN category_source TEXT NOT NULL DEFAULT 'suggested' CHECK(category_source IN ('suggested', 'user-override'));

CREATE TABLE capture_audit_trail_new (
    id INTEGER PRIMARY KEY,
    capture_transaction_id INTEGER NOT NULL,
    event_kind TEXT NOT NULL CHECK(event_kind IN ('save_persisted', 'category_updated')),
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
