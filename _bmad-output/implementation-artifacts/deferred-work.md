# Deferred Work

## Deferred from: code review of 2-1-paste-to-parse-transaction-capture (2026-05-06)

- Balance amount confused with transaction amount — first INR-prefixed token wins; requires architectural parser redesign. Affects `extract_amount_minor` in `app/src-tauri/src/commands/capture.rs`. Consider adding a "balance" keyword sentinel to skip balance-labeled amounts in a future parser pass.
- No latency measurement or instrumentation for NFR1 — parse path is lightweight today but "measurable" is unverifiable. Consider adding optional timing telemetry to `service.ts` or a Vitest benchmark fixture in a future iteration.

## Deferred from: code review of 3-4-trend-alerts-and-running-balance-visualization (2026-05-24)

- Audit possible duplicate counting across `ledger_entries` and `capture_transactions` in running-balance stream (`app/src-tauri/src/commands/ledger.rs:1224`). Kept deferred pending data-model confirmation that the two sources cannot represent the same business event.
- Optimize running-balance computation to avoid full-history fetch when only a 30d output is needed (`app/src-tauri/src/commands/ledger.rs:1224`). Kept deferred because this is performance hardening rather than an immediate correctness blocker for the current story.
- Define preset-window product behavior for Story 3.4 (multi-preset vs `30d`-only) deferred by user due to scope limiting and tight timeline.
