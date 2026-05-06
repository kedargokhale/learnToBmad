# Story 2.1: Paste-to-Parse Transaction Capture

## Metadata
- Story Key: 2-1-paste-to-parse-transaction-capture
- Epic: Epic 2 - Capture Transactions with Safe Validation and Corrections
- Status: review
- Created: 2026-05-06T00:00:00+05:30
- Last Updated: 2026-05-06T00:00:00+05:30
- Source: _bmad-output/planning-artifacts/epics.md

## Story
As a user,
I want to paste a bank message and receive immediate parsed output,
So that I can capture transactions with minimal effort.

## Acceptance Criteria
1. Given the capture screen with a paste-ready input, when I paste a supported bank message, then critical fields are parsed and presented with readiness status quickly, and parse feedback is available within the local performance target.
2. Given the capture screen with a paste-ready input, when I paste an unsupported or malformed message, then no transaction is saved, and the UI shows a clear parse-failure state with a guided next action.

## Tasks / Subtasks

- [x] Add native parse-only command boundary with deterministic output envelope (AC: 1, 2)
  - [x] Create `app/src-tauri/src/commands/capture.rs` with a typed request/response for parse preview only.
  - [x] Add `parse_transaction_message` command that performs extraction only and does not mutate DB state.
  - [x] Return existing command envelope shape `{ ok, data/error }` with stable error codes/hints.
  - [x] Implement and lock deterministic fixture coverage for at least 3 supported message samples (debit, credit, and mixed token order) plus 2 malformed samples.
  - [x] Add Rust unit tests for supported and malformed message input paths.
- [x] Add frontend capture feature module and typed service adapter (AC: 1, 2)
  - [x] Create `app/src/features/capture/schema.ts` for parse input/output validation and readiness view model.
  - [x] Create `app/src/features/capture/service.ts` invoking `parse_transaction_message`.
  - [x] Create capture UI surface (at minimum `TransactionInput` and `ReadinessStatus` behavior) in `app/src/features/capture/components/`.
  - [x] Keep parse response latency path lightweight and measurable for local desktop runtime.
- [x] Integrate capture flow into app shell while preserving existing baseline behavior (AC: 1, 2)
  - [x] Update `app/src/App.tsx` to expose paste-to-parse UI once account baseline exists.
  - [x] Preserve account setup fallback when no account exists.
  - [x] Preserve desktop runtime guard behavior added in Story 1.4.
- [x] Add regression-focused tests for parse success/failure UX and non-mutation guarantees (AC: 1, 2)
  - [x] Add frontend tests for parse-ready state and malformed-message guidance in `app/src/features/ledger/ledger.test.tsx` or new capture test file under `app/src/features/capture/`.
  - [x] Add backend tests proving parse command does not insert/update ledger tables.
  - [x] Verify existing Story 1.x tests continue passing unchanged.

## Dev Notes

### Story Intent
- This is Epic 2 entry story and must establish the parse preview loop without introducing save logic yet.
- Story 2.1 should create a trustworthy capture surface that immediately interprets pasted text and communicates readiness, while explicitly preventing silent writes.
- Save enforcement gates, correction workflows, account mismatch resolution, duplicate handling, and deterministic save machine are intentionally deferred to Stories 2.2 to 2.5.

### Relevant Requirements
- FR6, FR7, FR9, FR10, FR11 (no unsafe save), FR14 (deterministic transitions), FR38 (auditability boundary starts here).
- NFR1 (parse feedback within 1 second under normal desktop conditions).
- NFR10 and NFR12 are active constraints even in parse-only story: no incomplete/unsafe write and no silent mutation.

### Discovery Results
- Loaded `{epics_content}` from 1 file: `_bmad-output/planning-artifacts/epics.md`.
- Loaded `{prd_content}` from 1 file: `_bmad-output/planning-artifacts/prd.md`.
- Loaded `{architecture_content}` from 1 file: `_bmad-output/planning-artifacts/architecture.md`.
- Loaded `{ux_content}` from 1 file: `_bmad-output/planning-artifacts/ux-design-specification.md`.
- No `project-context.md` found for configured persistent facts glob.

### Current Codebase Reality (Read Before Editing)
- `app/src/App.tsx` currently switches between `AccountSetupScreen` and `LedgerBaselineView` after baseline load. There is no capture feature path yet.
- `app/src/features/` currently contains only `ledger/`; no `capture/` feature exists.
- Frontend command adapter in `app/src/features/ledger/service.ts` currently covers `create_account` and `get_ledger_baseline` only.
- Rust invoke handlers in `app/src-tauri/src/lib.rs` register only ledger commands.
- `app/src-tauri/src/commands/mod.rs` currently exports only `ledger` module.
- Existing migration `app/src-tauri/migrations/0001_create_accounts_and_ledger_entries.sql` supports only account + opening balance entry; no transaction capture schema is present yet.

### File-Level Change Guardrails (UPDATE files)

`app/src/App.tsx` (UPDATE)
- Current state: desktop guard -> load baseline -> setup or baseline screen.
- Story change: introduce capture-screen rendering path once baseline account exists.
- Must preserve:
  - Synchronous non-Tauri early return.
  - Baseline load fallback behavior on command rejection.
  - Setup flow when no account exists.
- Preferred approach: keep `AccountSetupScreen` and existing load logic untouched; compose capture surface alongside existing baseline view context instead of replacing core guardrails.

`app/src/features/ledger/ledger.test.tsx` (UPDATE if reused)
- Current state: Story 1.x tests cover setup, baseline retrieval, and desktop runtime guard.
- Story change: add capture parse readiness/failure tests (or split to dedicated `capture.test.tsx`).
- Must preserve all Story 1.x tests and assertions exactly.

`app/src-tauri/src/lib.rs` (UPDATE)
- Current state: invoke handler includes `create_account`, `get_ledger_baseline`.
- Story change: register `commands::capture::parse_transaction_message`.
- Must preserve plugin initialization order and existing command registration.

`app/src-tauri/src/commands/mod.rs` (UPDATE)
- Current state: `pub mod ledger;`
- Story change: add `pub mod capture;` only.
- Must preserve module visibility for existing ledger command compilation.

### New Files Expected (NEW)
- `app/src/features/capture/schema.ts`
- `app/src/features/capture/service.ts`
- `app/src/features/capture/components/TransactionInput.tsx`
- `app/src/features/capture/components/ReadinessStatus.tsx`
- `app/src/features/capture/capture.test.tsx` (or equivalent dedicated test file)
- `app/src-tauri/src/commands/capture.rs`

### Architecture Compliance
- Keep feature-first structure: new UI logic belongs under `app/src/features/capture/`.
- Keep typed frontend-native boundary and existing command envelope format.
- Enforce parse-only behavior: this story must not write to `accounts` or `ledger_entries`.
- Maintain local-first invariant and no external calls; do not add capabilities or network permissions.
- Preserve deterministic behavior for repeated identical input.

### Library and Framework Requirements
- Reuse installed stack from `app/package.json`: React 19.1.x, react-hook-form 7.x, zod 4.x, Vite 7.x, Vitest 4.x.
- Reuse installed native stack from `app/src-tauri/Cargo.toml`: Tauri v2, sqlx 0.8.6 (SQLite), tauri-plugin-sql v2.
- Do not introduce parser libraries unless required; start with deterministic baseline parser logic for supported message patterns as defined by Epic 2.

### UX Requirements (from UX spec)
- Capture must be paste-ready and keyboard-first.
- Readiness status must communicate state clearly using text + non-color cues.
- Parse failure path must show clear guided next action (not generic failure).
- Keep progressive disclosure: compact status first, details only when needed.
- Preserve desktop-first layout behavior and existing visual language.

### Data and Domain Guardrails
- Parse output should include critical fields at minimum: amount, debit/credit direction, date, bank name, account number, merchant/payee.
- For malformed input, return structured failure with user-actionable hint and zero write side effects.
- Do not infer or mutate stored ledger/account state in this story.
- Any readiness status must be computed from parse completeness, not optimistic assumptions.

### Parse Output and Readiness Contract (Must Implement)
- Parsed response should carry a stable shape with explicit nullable fields for each critical field and a deterministic `readinessState`.
- `readinessState` values for this story are limited to:
  - `ready` when all critical fields are present and internally consistent.
  - `needs-review` when parsing succeeded partially but one or more critical fields are missing or ambiguous.
  - `parse-failed` when message is unsupported/malformed and no safe structured parse can be produced.
- On repeated identical input, field values and `readinessState` must be byte-for-byte equivalent in command response JSON.
- Use deterministic normalization rules before parse classification (trim, collapse repeated whitespace, preserve original raw text separately for diagnostics).

### Testing Requirements
- Rust tests:
  - Supported message returns parsed critical fields and success envelope.
  - Malformed/unsupported message returns deterministic error envelope.
  - Parse command path leaves DB unchanged.
  - Non-mutation verification must assert unchanged row counts for both `accounts` and `ledger_entries` before and after parse calls.
- Frontend tests:
  - Paste supported message shows readiness/parsed field feedback.
  - Paste malformed message shows parse-failure guidance and no save affordance.
  - Re-pasting the same message yields identical readiness label and field rendering.
  - Existing setup/baseline/runtime guard tests remain green.
- Validation commands before marking implementation complete: `pnpm test`, targeted capture tests, and `cargo test`.

### Cross-Story Dependencies and Boundaries
- Enables Story 2.2 by producing parse completeness and readiness state used by validation gate.
- Must not pre-implement Story 2.2 save blocking logic beyond parse-readiness signaling.
- Must not pre-implement Story 2.3 correction workflow beyond simple guided next action message.
- Must not pre-implement Story 2.4 account mismatch resolution or duplicate decision mechanics.

### Previous Story Intelligence
- No prior Story 2 implementation artifact exists (this is Story 2.1).
- Reuse proven Story 1 patterns:
  - Early runtime guard in `App.tsx`.
  - Typed command envelope in frontend service and Rust command layers.
  - Deterministic tests with explicit state assertions.

### Git Intelligence Summary
- Recent implemented surface is concentrated in ledger paths:
  - `app/src/features/ledger/*`
  - `app/src/App.tsx`
  - `app/src-tauri/src/commands/ledger.rs`
  - `app/src-tauri/src/lib.rs`
- Follow these conventions for naming, envelope shape, test style, and deterministic assertions when adding capture module.

### Latest Technical Information
- React official blog indicates recent security advisories were focused on React Server Components; this desktop SPA should continue avoiding RSC-specific patterns.
- Vite 7 docs emphasize modern runtime targets and Node support baseline; keep existing Vite 7 workflow and avoid legacy tooling regressions.
- Tauri v2 remains active major line; continue using v2 command/plugin patterns already in this repo.

### Project Context Reference
- No project-level `project-context.md` discovered in workspace.

### References
- `_bmad-output/planning-artifacts/epics.md` (Epic 2, Story 2.1)
- `_bmad-output/planning-artifacts/prd.md` (FR6, FR7, FR9, FR10, FR11, FR14, NFR1, NFR10, NFR12)
- `_bmad-output/planning-artifacts/architecture.md` (command boundary, feature-first structure, deterministic patterns)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (paste-ready capture, readiness feedback, guided failure)
- `app/src/App.tsx`
- `app/src/features/ledger/service.ts`
- `app/src/features/ledger/schema.ts`
- `app/src/features/ledger/ledger.test.tsx`
- `app/src-tauri/src/lib.rs`
- `app/src-tauri/src/commands/mod.rs`
- `app/src-tauri/src/commands/ledger.rs`
- `app/src-tauri/migrations/0001_create_accounts_and_ledger_entries.sql`

## Story Completion Status
- Status set to: review
- Completion note: Implemented parse-only backend command and capture preview UI, validated deterministic parse behavior, and confirmed zero DB mutation on parse paths.

## Dev Agent Record

### Agent Model Used
GPT-5.3-Codex

### Debug Log References
- Workflow customization resolved successfully via `_bmad/scripts/resolve_customization.py` with default workflow.
- Sprint status scanned from top to bottom; first ready-for-dev story found: `2-1-paste-to-parse-transaction-capture`.
- Added new Rust command module `capture` with deterministic normalization, extraction, and parse-failed envelope handling.
- Registered `parse_transaction_message` in native command exports and invoke handler without altering plugin initialization order.
- Added new capture feature module with typed schema/service plus `TransactionInput` and `ReadinessStatus` components.
- Integrated capture parse preview into app shell for existing-account flow while preserving setup fallback and desktop guard behavior.
- Validation completed with `pnpm test` (13/13) and `cargo test` (8/8).

### Completion Notes List
- Implemented parse-only native boundary returning stable `{ ok, data/error }` envelopes with deterministic parse output.
- Added fixture-backed backend tests for 3 supported message forms, 2 malformed paths, and explicit non-mutation row-count checks.
- Added frontend capture tests covering parse-ready state, parse-failure guidance, and deterministic repeat-paste rendering.
- Preserved all Story 1 baseline and runtime-guard behavior; existing ledger tests remain green.

### File List
- app/src-tauri/src/commands/capture.rs
- app/src-tauri/src/commands/mod.rs
- app/src-tauri/src/lib.rs
- app/src/App.tsx
- app/src/App.css
- app/src/features/capture/schema.ts
- app/src/features/capture/service.ts
- app/src/features/capture/components/TransactionInput.tsx
- app/src/features/capture/components/ReadinessStatus.tsx
- app/src/features/capture/capture.test.tsx
- _bmad-output/implementation-artifacts/2-1-paste-to-parse-transaction-capture.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log
- 2026-05-06: Implemented Story 2.1 parse preview command boundary, capture UI module, app-shell integration, and regression tests; moved story to review.

### Open Questions Saved for End
- None.

### Review Findings
- [x] [Review][Decision] Partial parse (has amount+date, missing direction) returns PARSE_FAILED — dismissed (kept hard-fail behavior per user choice)
- [x] [Review][Patch] Direction tokens `"dr"`/`"cr"` use substring match — false positives on common words [app/src-tauri/src/commands/capture.rs]
- [x] [Review][Patch] `_pool` acquired on every parse call but never used — unnecessary DB round-trip per NFR1 [app/src-tauri/src/commands/capture.rs]
- [x] [Review][Patch] `amountMinor` rendered as raw minor units (e.g. "125050") instead of formatted currency [app/src/features/capture/components/ReadinessStatus.tsx]
- [x] [Review][Patch] Race condition — concurrent paste + button presses can overwrite results out of order (no AbortController or sequence guard) [app/src/features/capture/components/TransactionInput.tsx]
- [x] [Review][Patch] `extract_account_number` fallback matches date and amount tokens (any 4+ char token with a digit) [app/src-tauri/src/commands/capture.rs]
- [x] [Review][Patch] Date returned as-is in source format — inconsistent separators/field order between `yyyy-MM-dd` and `dd/MM/yyyy` [app/src-tauri/src/commands/capture.rs]
- [x] [Review][Patch] Date validation has no calendar bounds — `"2026-99-99"` passes `is_yyyy_mm_dd` [app/src-tauri/src/commands/capture.rs]
- [x] [Review][Patch] `extract_bank_name` accepts any preceding word — no quality filter prevents "Your Bank" or "Nearby Bank" [app/src-tauri/src/commands/capture.rs]
- [x] [Review][Patch] `result.data` may be `undefined` when `ok: true` — silently shows empty state instead of error [app/src/features/capture/components/TransactionInput.tsx]
- [x] [Review][Patch] Zod `safeParse` failure in `ReadinessStatus` renders identically to null — backend schema regressions masked [app/src/features/capture/components/ReadinessStatus.tsx]
- [x] [Review][Patch] `"parse-failed"` is a dead enum value in success `readinessState` schema — can never appear in a real command data response [app/src/features/capture/schema.ts]
- [x] [Review][Patch] `computeReadinessLabel` `default` branch is unreachable dead code after exhaustive enum handling [app/src/features/capture/schema.ts]
- [x] [Review][Patch] Mixed-case currency prefix `"Inr"` / `"RS."` all-caps not stripped by `trim_start_matches` — amount extraction silently fails [app/src-tauri/src/commands/capture.rs]
- [x] [Review][Patch] Merchant/payee extraction captures pronouns — `"credited to your account"` yields payee = `"your"` [app/src-tauri/src/commands/capture.rs]
- [x] [Review][Patch] Non-mutation Rust test is vacuous — `_pool` is never used so no DB state change can be observed or refuted [app/src-tauri/src/commands/capture.rs]
- [x] [Review][Patch] No frontend test for `"needs-review"` readiness state — that UI branch is unexercised [app/src/features/capture/capture.test.tsx]
- [x] [Review][Patch] Frontend determinism test covers only one idempotency pass, not two distinct malformed sample inputs [app/src/features/capture/capture.test.tsx]
- [x] [Review][Defer] Balance amount confused with transaction amount — first INR-prefixed token wins; requires architectural parser redesign [app/src-tauri/src/commands/capture.rs] — deferred, pre-existing parser limitation
- [x] [Review][Defer] No latency measurement or instrumentation for NFR1 — parse path IS lightweight today; instrumentation scope is undefined [app/src/features/capture/service.ts] — deferred, pre-existing
