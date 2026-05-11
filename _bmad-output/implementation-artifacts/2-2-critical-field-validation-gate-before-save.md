# Story 2.2: Critical-Field Validation Gate Before Save

## Metadata
- Story Key: 2-2-critical-field-validation-gate-before-save
- Epic: Epic 2 - Capture Transactions with Safe Validation and Corrections
- Status: done
- Created: 2026-05-11T13:00:51+05:30
- Last Updated: 2026-05-11T13:25:00+05:30
- Source: _bmad-output/planning-artifacts/epics.md

## Story
As a user,
I want unsafe saves blocked with clear reasons,
So that incomplete transactions never enter my ledger.

## Acceptance Criteria
1. Given one or more critical fields are missing or ambiguous, when I attempt to save, then save is blocked with explicit missing-field guidance, and no ledger write occurs until all critical fields are valid.
2. Given an attempted save is blocked by validation, when the user reviews the ledger state, then no partial write or implicit mutation exists, and previously saved data remains unchanged.

## Tasks / Subtasks

- [x] Add explicit save command with hard validation gate (AC: 1, 2)
  - [x] Add a new Tauri command for transaction save attempt that accepts parsed payload and account context but validates before any write.
  - [x] Return existing envelope shape `{ ok, data/error }` with deterministic `VALIDATION_FAILED` codes and actionable field-level hints.
  - [x] Enforce required critical fields: `amountMinor`, `direction`, `transactionDate`, `bankName`, `accountNumber`, `merchantOrPayee`.
  - [x] Ensure ambiguous values are treated as invalid for this gate.
  - [x] Do not perform fallback writes or inferred defaults for missing critical fields.
- [x] Integrate save-gate UX on capture surface with explicit blocked reasons (AC: 1)
  - [x] Add a disabled/blocked save affordance in capture flow with visible, textual reason(s).
  - [x] Keep guidance deterministic and concise (field names + next action), no generic failure copy.
  - [x] Preserve non-color communication for state (label + icon/text + color).
- [x] Guarantee zero mutation on blocked validation paths (AC: 2)
  - [x] Wrap save path in transaction-safe boundary and exit before writes on any validation failure.
  - [x] Verify no mutation to `accounts` and `ledger_entries` when validation blocks.
  - [x] Keep baseline queries and existing account setup behavior unchanged.
- [x] Add deterministic regression tests (AC: 1, 2)
  - [x] Rust tests for blocked save (missing/ambiguous critical fields) with explicit no-write assertions.
  - [x] Rust tests for valid-input gate pass response that is deterministic and does not mutate ledger tables in this story scope.
  - [x] Frontend tests for blocked-save reason visibility and unchanged ledger view after failed save attempt.
  - [x] Preserve and rerun Story 1.x and Story 2.1 suites.

### Review Findings
- [x] [Review][Patch] Add transactionDate format ambiguity check to frontend blocked-reason derivation [app/src/features/capture/schema.ts:115]
- [x] [Review][Patch] Align deterministic readiness fixture with backend date contract (YYYY-MM-DD) [app/src/features/capture/capture.test.tsx:186]
- [x] [Review][Patch] Avoid substring-based ambiguous text false positives for valid merchant/bank/account names [app/src-tauri/src/commands/capture.rs:316]

## Dev Notes

### Story Intent
- Story 2.2 introduces the first write-protection boundary for transaction capture: no incomplete critical-field payload may pass the save boundary.
- This story is about deterministic validation gate behavior and no-write guarantees, not full correction UX (Story 2.3), mismatch + duplicate policy (Story 2.4), or complete save state machine/audit orchestration (Story 2.5).
- Scope decision for this story: implement save-attempt validation gate and blocked-save UX. Do not introduce new persisted transaction-write behavior unless explicitly approved as scope pull-in.

### Relevant Requirements
- FR11: block save when critical fields are missing and explain what is required.
- FR14: deterministic parse-validate-save transitions.
- FR38: preserve user-level auditability (do not inject hidden writes).
- NFR10: zero-tolerance for saving missing critical fields.
- NFR12: no silent data mutation.

### Discovery Results
- Loaded `{epics_content}` from `_bmad-output/planning-artifacts/epics.md`.
- Loaded `{prd_content}` from `_bmad-output/planning-artifacts/prd.md`.
- Loaded `{architecture_content}` from `_bmad-output/planning-artifacts/architecture.md`.
- Loaded `{ux_content}` from `_bmad-output/planning-artifacts/ux-design-specification.md`.
- No `project-context.md` discovered for configured persistent facts.

### Previous Story Intelligence (2.1)
- Story 2.1 established parse-only boundary and readiness presentation; save behavior is still intentionally absent.
- Recent 2.1 review fixes indicate parser edge risks and schema mismatches can happen; this story must treat parser output as untrusted until validation gate passes.
- Existing capture UI already communicates parse status and error guidance; extend, do not replace.

### Current Codebase Reality (Read Before Editing)
- `app/src/features/capture/schema.ts`
  - `parseReadinessStateSchema` allows `ready | needs-review` only.
  - `computeReadinessLabel` currently maps parse states, not save-gate states.
- `app/src/features/capture/service.ts`
  - Exposes `parse_transaction_message` only.
  - `ParsePreviewData` still includes `parse-failed` in TypeScript union (inconsistent with zod schema).
- `app/src/features/capture/components/TransactionInput.tsx`
  - Supports parse triggers and pushes preview/error to parent.
  - No save-attempt action exists yet.
- `app/src/features/capture/components/ReadinessStatus.tsx`
  - Displays parse outcomes and missing-field presence hints.
  - Currently states save is out of scope.
- `app/src/App.tsx`
  - Hosts parse preview and baseline view in account-existing state.
  - No transaction save-attempt orchestration exists.
- `app/src-tauri/src/commands/capture.rs`
  - Provides `parse_transaction_message` command and deterministic parse envelope.
  - No validation-gated transaction save command currently present.
- `app/src-tauri/src/commands/ledger.rs`
  - Currently supports account creation and baseline read paths.
- `app/src-tauri/migrations/0001_create_accounts_and_ledger_entries.sql`
  - `ledger_entries.entry_kind` check currently permits only `opening_balance`.
  - Save story may require schema evolution if transaction rows are written in this story.

### File-Level Change Guardrails (UPDATE files)

`app/src/features/capture/schema.ts` (UPDATE)
- Current state: parse-only readiness labels.
- Story change: add explicit save-gate state and blocked reason shape used by UI.
- Must preserve: parse schema compatibility for existing 2.1 tests.

`app/src/features/capture/service.ts` (UPDATE)
- Current state: parse command adapter only.
- Story change: add typed adapter for validation-gated save-attempt command.
- Must preserve: existing `parseTransactionMessage` behavior and envelope typing.

`app/src/features/capture/components/ReadinessStatus.tsx` (UPDATE)
- Current state: parse readiness + parse failure guidance.
- Story change: include save-gate visibility with explicit missing/ambiguous field reasons.
- Must preserve: parse preview rendering and existing error messaging flow.

`app/src/features/capture/components/TransactionInput.tsx` (UPDATE)
- Current state: parse trigger surface.
- Story change: expose save-attempt action (or callback) without regressing parse race protections.
- Must preserve: sequence ordering guard and parse-only safety semantics.

`app/src/App.tsx` (UPDATE)
- Current state: capture parse state + ledger baseline composition.
- Story change: orchestrate save-attempt result state and re-fetch baseline only on successful save.
- Must preserve: unsupported-runtime guard and no-account setup fallback.

`app/src/features/capture/capture.test.tsx` (UPDATE)
- Current state: parse success/failure coverage.
- Story change: add blocked-save reason visibility and no-ledger-change assertions in UI flow.
- Must preserve: all existing parse determinism tests.

`app/src-tauri/src/commands/capture.rs` (UPDATE)
- Current state: parse command only.
- Story change: add deterministic validation gate command for save attempts.
- Must preserve: parse command behavior and existing deterministic error envelope conventions.

`app/src-tauri/src/lib.rs` (UPDATE)
- Current state: registers ledger + parse command handlers.
- Story change: register new save-gate command in same single `generate_handler!` list.
- Must preserve: plugin init and existing command registrations.

`app/src-tauri/src/commands/mod.rs` (UPDATE only if module boundaries change)
- Keep module declarations minimal and consistent.

`app/src-tauri/migrations/0001_create_accounts_and_ledger_entries.sql` (UPDATE only if transaction row write is implemented now)
- If this story performs real transaction inserts, add migration(s) instead of mutating existing migration semantics in place.
- If persistence is deferred to 2.5, keep migration unchanged and implement validate-only gate result for now.

### New Files Expected (Conditional)
- `app/src-tauri/migrations/0002_add_transaction_entry_kind.sql` (if writes are introduced in Story 2.2).
- `app/src-tauri/src/commands/capture_save_validation.rs` (optional split if command file size/clarity requires separation).

### Architecture Compliance
- Keep feature-first frontend structure and typed Tauri command boundary.
- Keep deterministic `{ ok, data/error }` envelopes; no raw native errors to UI.
- Enforce validation gate in command/domain layer, not UI-only.
- Keep local-first invariants; no network calls, no additional capabilities.
- If schema evolves, use ordered versioned migrations only.

### Library and Framework Requirements
- Reuse installed stack in `app/package.json`: React 19.x, Zod 4.x, Vitest 4.x.
- Reuse installed native stack in `app/src-tauri/Cargo.toml`: Tauri v2 + SQL plugin + sqlx.
- Use Tauri v2 command registration pattern with module-level unique command names (per current docs).
- Keep Zod strict parsing for backend envelope validation and field-level error mapping.

### UX Requirements (from UX spec)
- Explicit blocked-state reason for disabled save action (not just disabled visual).
- Progressive disclosure: compact state first, field-level details on focus/intent.
- Non-color-only communication for blocked vs needs-review vs ready semantics.
- Keyboard-first operation and predictable focus behavior maintained.

### Data and Domain Guardrails
- Validation gate must fail when any critical field is missing or ambiguous.
- Blocked save must produce deterministic field list ordering and deterministic error code/hint.
- Blocked save must not mutate `accounts`, `ledger_entries`, or derived dashboard state.
- Valid-input gate pass response in this story must remain non-mutating and deterministic.

### Testing Requirements
- Rust tests:
  - Missing/ambiguous critical fields return `VALIDATION_FAILED` with stable field-specific details.
  - Blocked save leaves row counts unchanged for `accounts` and `ledger_entries`.
  - Determinism: repeated invalid payloads return equivalent error envelopes.
- Frontend tests:
  - Blocked-save UI shows explicit reason and next action.
  - Save affordance remains unavailable until all critical fields are valid.
  - Ledger baseline view remains unchanged after blocked attempts.
  - Existing parse success/failure/determinism tests remain green.
- Validation commands before story completion:
  - `pnpm test`
  - targeted capture tests (`pnpm test -- capture` or configured equivalent)
  - `cargo test`

### Cross-Story Dependencies and Boundaries
- Depends on Story 2.1 parse output envelope and readiness-state baseline.
- Enables Story 2.3 correction/retry UX by surfacing precise validation failures.
- Must not pre-implement Story 2.4 mismatch + duplicate decision workflow.
- Must not pre-implement full Story 2.5 deterministic save state machine/audit orchestration beyond this gate.

### Git Intelligence Summary
- Recent commits are focused on Story 2.1 capture module behavior and test hardening:
  - `2f140a6` Fix capture service and tests for manual testing
  - `965ae9e` Merge branch `Sprint_2.1_PasteToParseCapture`
  - `c2e1ef8` feat: Implement Story 2.1
- Follow existing naming and envelope patterns from those changes rather than introducing new contract styles.

### Latest Technical Information
- Tauri v2 docs (updated Nov 2025) reinforce single `invoke_handler(generate_handler![...])` registration and module-prefixed command paths in Rust while invoking by command name from frontend.
- Zod 4 is stable; keep strict schema validation and typed parse boundaries.
- Vitest 4 guidance remains aligned with existing setup; use deterministic test naming and `*.test.*` conventions.

### Project Context Reference
- No project-level `project-context.md` discovered.

### References
- `_bmad-output/planning-artifacts/epics.md` (Epic 2, Story 2.2)
- `_bmad-output/planning-artifacts/prd.md` (FR11, FR14, FR38, NFR10, NFR12)
- `_bmad-output/planning-artifacts/architecture.md` (typed command boundary, deterministic envelope, migration discipline)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (blocked-state reasons, progressive disclosure, keyboard-first)
- `app/src/features/capture/schema.ts`
- `app/src/features/capture/service.ts`
- `app/src/features/capture/components/TransactionInput.tsx`
- `app/src/features/capture/components/ReadinessStatus.tsx`
- `app/src/features/capture/capture.test.tsx`
- `app/src/App.tsx`
- `app/src-tauri/src/commands/capture.rs`
- `app/src-tauri/src/commands/ledger.rs`
- `app/src-tauri/src/lib.rs`
- `app/src-tauri/migrations/0001_create_accounts_and_ledger_entries.sql`

## Story Completion Status
- Status set to: review
- Completion note: Implemented deterministic save-attempt validation gate with explicit blocked-field guidance and verified zero mutation on blocked and pass paths.

## Dev Agent Record

### Agent Model Used
GPT-5.3-Codex

### Debug Log References
- Workflow customization resolved via `_bmad/scripts/resolve_customization.py` for `bmad-create-story`.
- Full `sprint-status.yaml` parsed top-to-bottom; first backlog story identified as `2-2-critical-field-validation-gate-before-save`.
- Planning artifacts, previous story implementation artifact, and current code surfaces were analyzed end-to-end.
- Implemented backend command `attempt_transaction_save` with deterministic field-order validation and transaction rollback no-write boundary.
- Added frontend save affordance with explicit blocked reasons and save-gate result panels.
- Validation run results: `pnpm test` (18/18 passing), `cargo test` (23/23 passing).

### Completion Notes List
- Created Story 2.2 implementation guide with explicit save-gate, no-mutation, and deterministic error-envelope requirements.
- Added file-level guardrails for both frontend and Rust command layers.
- Included cross-story boundaries to avoid pre-implementing Stories 2.3-2.5 behavior.
- Added save-attempt adapter/types and critical-field derivation helpers for deterministic blocked-save guidance.
- Added Rust save-gate regression tests for missing and ambiguous critical fields, determinism, and no database mutation assertions.
- Added frontend capture tests for blocked-save reason visibility and unchanged ledger snapshot after blocked save attempts.

### File List
- app/src-tauri/src/commands/capture.rs
- app/src-tauri/src/lib.rs
- app/src/features/capture/schema.ts
- app/src/features/capture/service.ts
- app/src/features/capture/components/TransactionInput.tsx
- app/src/features/capture/components/ReadinessStatus.tsx
- app/src/features/capture/capture.test.tsx
- app/src/App.tsx
- _bmad-output/implementation-artifacts/2-2-critical-field-validation-gate-before-save.md

## Appended: Last Commit Changes (2026-05-11)

- Commit: `e06ebecab8a72a58c0ef6f48a382e89aeb03cb93`
- Title: `feat: implement story 2.2 critical-field save validation gate`
- Branch: `Sprint_2-2_critical-field-validation`

### Files Changed
- Added: `_bmad-output/implementation-artifacts/2-2-critical-field-validation-gate-before-save.md`
- Modified: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Modified: `app/src-tauri/src/commands/capture.rs`
- Modified: `app/src-tauri/src/lib.rs`
- Modified: `app/src/App.tsx`
- Modified: `app/src/features/capture/capture.test.tsx`
- Modified: `app/src/features/capture/components/ReadinessStatus.tsx`
- Modified: `app/src/features/capture/components/TransactionInput.tsx`
- Modified: `app/src/features/capture/schema.ts`
- Modified: `app/src/features/capture/service.ts`

## Change Log
- 2026-05-11: Implemented Story 2.2 save-attempt validation gate and capture UX blocked-save guidance; added deterministic no-mutation tests in frontend and Rust suites.
