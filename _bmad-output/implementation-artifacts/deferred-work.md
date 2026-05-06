# Deferred Work

## Deferred from: code review of 2-1-paste-to-parse-transaction-capture (2026-05-06)

- Balance amount confused with transaction amount — first INR-prefixed token wins; requires architectural parser redesign. Affects `extract_amount_minor` in `app/src-tauri/src/commands/capture.rs`. Consider adding a "balance" keyword sentinel to skip balance-labeled amounts in a future parser pass.
- No latency measurement or instrumentation for NFR1 — parse path is lightweight today but "measurable" is unverifiable. Consider adding optional timing telemetry to `service.ts` or a Vitest benchmark fixture in a future iteration.
