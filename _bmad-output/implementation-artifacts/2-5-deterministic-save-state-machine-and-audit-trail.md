# Story 2.5: Deterministic Save State Machine and Audit Trail

## Metadata
- Story Key: 2-5-deterministic-save-state-machine-and-audit-trail
- Epic: Epic 2 - Capture Transactions with Safe Validation and Corrections
- Status: ready-for-dev
- Created: 2026-05-14T00:00:00+05:30
- Last Updated: 2026-05-14T00:00:00+05:30
- Source: _bmad-output/planning-artifacts/epics.md

## Story
As a user,
I want deterministic parse-validate-save-refresh behavior with history,
So that repeated inputs produce predictable trusted results.

## Acceptance Criteria
1. Given the same message input and ruleset, when the parse-validate-save flow is executed repeatedly, then outcomes are deterministic and dashboard refresh follows successful save, and transaction and correction history is persisted for auditability.
2. Given a save attempt fails validation or command execution, when the flow returns control to the user, then dashboard totals and trends do not refresh from unsaved data, and no hidden ledger mutation is introduced.

## Tasks / Subtasks

- [ ] Implement explicit save state machine orchestration (AC: 1, 2)
  - [ ] Define frontend save lifecycle states (idle, validating, blocked, persisting, success, failed) in capture flow orchestration.
  - [ ] Ensure deterministic transitions only; no implicit fallback transitions.
- [ ] Implement first write path for transaction persistence (AC: 1, 2)
  - [ ] Update `app/src-tauri/src/commands/capture.rs` save command to persist when validation and explicit decisions pass.
  - [ ] Use SQL transaction boundaries so transaction row + audit row are committed atomically.
  - [ ] Return deterministic success payload with stable identifiers and timestamps.
- [ ] Add migration(s) for transaction and audit trail persistence (AC: 1)
  - [ ] Add ordered migration files under `app/src-tauri/migrations/` for transaction rows and audit history.
  - [ ] Update `app/src-tauri/src/db/ledger.rs` migration list without modifying existing migration semantics in place.
- [ ] Refresh ledger/dashboard surfaces only after successful write (AC: 1, 2)
  - [ ] Update `app/src/App.tsx` to refresh baseline only on successful persistence response.
  - [ ] Ensure failed paths leave ledger/dashboard presentation unchanged.
- [ ] Add deterministic and no-mutation regression coverage (AC: 1, 2)
  - [ ] Add Rust tests for atomic commit/rollback guarantees and deterministic repeated-save outcomes.
  - [ ] Extend `app/src/features/capture/capture.test.tsx` with success path refresh and failure no-mutation behavior.
  - [ ] Preserve all Story 2.1 to 2.4 behavior and tests.

## Dev Notes

### Story Intent
- Story 2.5 is the first story in Epic 2 that persists transaction writes.
- It must finalize deterministic save orchestration and introduce auditability for capture and correction decisions.
- It must not regress strict validation gates and explicit decision requirements from Stories 2.2 to 2.4.

### Relevant Requirements
- FR14: deterministic parse-validate-save-refresh loop.
- FR38: transaction and correction history for auditability.
- NFR10: hard block on missing critical fields.
- NFR12: no silent data mutation.
- NFR13: ledger consistency across reload/restart.
- NFR14: deterministic conflict/duplicate outcomes for same inputs and rules.

### Discovery Results
- Loaded `{epics_content}` from `_bmad-output/planning-artifacts/epics.md`.
- Loaded `{prd_content}` from `_bmad-output/planning-artifacts/prd.md`.
- Loaded `{architecture_content}` from `_bmad-output/planning-artifacts/architecture.md`.
- Loaded `{ux_content}` from `_bmad-output/planning-artifacts/ux-design-specification.md`.
- Loaded previous story intelligence from Story 2.2 context and newly prepared Story 2.3/2.4 contexts.

### Current Codebase Reality (Read Before Editing)
- `app/src-tauri/migrations/0001_create_accounts_and_ledger_entries.sql`
  - `ledger_entries.entry_kind` currently allows only `opening_balance`.
  - Current schema cannot store transaction capture entries yet.
- `app/src-tauri/src/db/ledger.rs`
  - Registers only migration version 1.
  - Exposes `sqlite_pool`, no write helper methods yet.
- `app/src-tauri/src/commands/capture.rs`
  - Save command currently validates then returns success with `acceptedForWrite: false` and explicit no-write scope.
- `app/src/App.tsx`
  - Refreshes baseline when save response indicates acceptance; current backend never accepts write.
- `app/src/features/capture/service.ts`
  - Save result contract is validation-centric and will need persistence success shape updates.

### File-Level Change Guardrails (UPDATE files)

`app/src-tauri/src/commands/capture.rs` (UPDATE)
- Current state: validation-gate only, explicit rollback path.
- Story change: add deterministic write execution after all gate conditions pass.
- Must preserve: parse behavior, deterministic error envelopes, validation ordering, and explicit no-write for failed paths.

`app/src-tauri/src/db/ledger.rs` (UPDATE)
- Current state: migration list with only version 1 and pool accessor.
- Story change: register new migrations and, if needed, add helper functions for transactional inserts.
- Must preserve: existing database URL and initialization semantics.

`app/src/App.tsx` (UPDATE)
- Current state: parse/save orchestration and baseline refresh on accepted save.
- Story change: adapt to persisted-save success contract and deterministic state-machine transitions.
- Must preserve: runtime guard, baseline load fallback, account setup path.

`app/src/features/capture/service.ts` (UPDATE)
- Current state: save result assumes validation-only pass with deferred write.
- Story change: extend result types for persisted-save success data.
- Must preserve: command names and envelope handling.

`app/src/features/capture/schema.ts` (UPDATE)
- Current state: blocked-field and parse schemas.
- Story change: add save-state machine and persisted-result schema helpers.
- Must preserve: critical-field derivation and existing parse/gate semantics.

`app/src/features/capture/components/ReadinessStatus.tsx` (UPDATE)
- Current state: displays parse and validation gate outcomes.
- Story change: include deterministic persistence state and success confirmation cues.
- Must preserve: existing failure and blocked guidance messaging.

`app/src/features/capture/capture.test.tsx` (UPDATE)
- Current state: parse and gate-focused tests.
- Story change: add persistence success and rollback/no-mutation assertions.
- Must preserve: all prior tests for Stories 2.1 to 2.4.

### New Files Expected (NEW)
- `app/src-tauri/migrations/0002_add_transaction_entry_kinds.sql`
- `app/src-tauri/migrations/0003_create_capture_audit_trail.sql`
- `app/src/features/capture/components/SaveSuccessConfirmation.tsx` (optional if status rendering complexity warrants component split)

### Architecture Compliance
- Use ordered, versioned migrations only.
- Keep typed frontend-native command contracts.
- Enforce validate-first gate before any write.
- Keep atomicity guarantees for transaction and audit persistence.
- Keep no-network local-first boundary.

### Library and Framework Requirements
- Reuse Tauri v2, sqlx 0.8.x, tauri-plugin-sql stack already installed.
- Keep React 19 + Vitest test conventions.
- Do not introduce additional ORM layers or state managers.

### UX Requirements (from UX spec)
- Keep save feedback immediate and non-disruptive.
- Preserve explicit blocked-state reasons for failures.
- Ensure post-save confirmation is concise and does not force modal interruption.
- Keep keyboard flow consistent in repeated capture-save cycles.

### Data and Domain Guardrails
- Same input + same rules + same decisions must produce deterministic outcome.
- Failed validation or execution must not mutate ledger or audit tables.
- Successful write must record transaction and corresponding audit history together.
- Dashboard/baseline refresh must happen only after successful commit.

### Testing Requirements
- Rust tests:
  - Atomic commit: transaction and audit rows both persisted on success.
  - Atomic rollback: neither row persisted when any write step fails.
  - Deterministic outcomes for repeated identical valid and invalid save attempts.
- Frontend tests:
  - Save success updates ledger snapshot after commit.
  - Save failure leaves ledger snapshot unchanged.
  - Save-state transitions follow defined deterministic state machine.
- Regression tests:
  - Preserve all Story 2.1 to 2.4 parse, validation, correction, mismatch, and duplicate behaviors.

### Cross-Story Dependencies and Boundaries
- Depends on Story 2.4 resolved mismatch/duplicate decision model.
- Completes Epic 2 save behavior and auditability baseline.
- Must not pull in Epic 3 categorization or dashboard-storycard feature scope.

### Previous Story Intelligence
- Story 2.2 established hard validation gate and no-mutation behavior.
- Story 2.3 and 2.4 establish correction/retry and explicit decision surfaces.
- Story 2.5 must compose these without relaxing gate guarantees.

### Git Intelligence Summary
- Latest commits and file history indicate capture flow is centered in `capture.rs`, `App.tsx`, and capture feature components/tests.
- Extend existing conventions rather than introducing parallel patterns.

### Latest Technical Information
- Tauri v2 command guidance confirms single `generate_handler!` registration with unique command names.
- SQLx transaction semantics guarantee rollback when not committed; explicit rollback and error mapping should remain deterministic.
- React state updates are batched/snapshot-based; save state machine should avoid stale state during rapid retries.

### Project Context Reference
- No project-level `project-context.md` discovered.

### References
- `_bmad-output/planning-artifacts/epics.md` (Epic 2, Story 2.5)
- `_bmad-output/planning-artifacts/prd.md` (FR14, FR38, NFR10, NFR12, NFR13, NFR14)
- `_bmad-output/planning-artifacts/architecture.md` (atomic transactions, migration discipline, command boundary)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (confirmation feedback, guided failures)
- `_bmad-output/implementation-artifacts/2-2-critical-field-validation-gate-before-save.md`
- `_bmad-output/implementation-artifacts/2-3-guided-correction-and-retry-flow.md`
- `_bmad-output/implementation-artifacts/2-4-account-mismatch-resolution-and-duplicate-flagging.md`
- `app/src-tauri/migrations/0001_create_accounts_and_ledger_entries.sql`
- `app/src-tauri/src/db/ledger.rs`
- `app/src-tauri/src/commands/capture.rs`
- `app/src/App.tsx`
- `app/src/features/capture/service.ts`
- `app/src/features/capture/schema.ts`
- `app/src/features/capture/components/ReadinessStatus.tsx`
- `app/src/features/capture/capture.test.tsx`

## Story Completion Status
- Status set to: ready-for-dev
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used
GPT-5.3-Codex

### Debug Log References
- Workflow activation and artifact discovery completed.
- Epic 2 backlog stories analyzed with current schema and command boundaries.

### Completion Notes List
- Created story context with atomic write, deterministic state-machine, and audit-trail guardrails.

### File List
- _bmad-output/implementation-artifacts/2-5-deterministic-save-state-machine-and-audit-trail.md
