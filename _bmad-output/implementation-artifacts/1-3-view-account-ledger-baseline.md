# Story 1.3: View Account Ledger Baseline

## Metadata
- Story Key: 1-3-view-account-ledger-baseline
- Epic: Epic 1 - Start Private Ledger and Account Baseline
- Status: done
- Created: 2026-05-02T16:10:29.9073758+05:30
- Last Updated: 2026-05-02T17:00:00+05:30
- Source: _bmad-output/planning-artifacts/epics.md

## Story
As a user,
I want to view current balance and transaction history for an account,
So that I can verify ledger state before ongoing capture.

## Acceptance Criteria
1. Given an account with opening balance and saved transactions, when I open the ledger view, then I can see current balance and ordered transaction history, and results are consistent after app restart or reload.

## Tasks / Subtasks
- [x] Add native read commands for baseline ledger retrieval (AC: 1)
  - [x] Add a ledger read command in app/src-tauri/src/commands/ledger.rs that returns a typed command envelope for account summary and ordered entries.
  - [x] Keep read behavior deterministic by ordering history consistently (newest-first or oldest-first, choose one and enforce it in SQL and UI tests).
  - [x] Ensure command errors still use the existing code/message/hint/details envelope shape.
  - [x] Register new command(s) in app/src-tauri/src/lib.rs without widening capabilities.
- [x] Implement frontend ledger baseline surface and service adapters (AC: 1)
  - [x] Extend app/src/features/ledger/service.ts with typed invoke wrappers for ledger baseline read APIs.
  - [x] Add ledger baseline types/schema in app/src/features/ledger/schema.ts (or a colocated ledger view schema file in the same feature).
  - [x] Add a ledger baseline view component under app/src/features/ledger/components/ that renders account identity, current balance, and ordered history.
  - [x] Update app/src/App.tsx to show the baseline ledger view for an existing account while preserving first-run setup behavior.
- [x] Preserve and wire first-run to post-setup progression cleanly (AC: 1)
  - [x] Keep AccountSetupScreen behavior intact (validation, blocked reasons, duplicate handling, success banner).
  - [x] Add a controlled handoff from successful account creation to baseline ledger display.
  - [x] Ensure reload/startup path can discover existing account state and render the ledger baseline without requiring re-setup.
- [x] Add regression-focused tests for persistence and ordering (AC: 1)
  - [x] Add Rust command tests for reading account baseline and deterministic ordering.
  - [x] Add frontend tests in app/src/features/ledger/ledger.test.tsx for baseline rendering, empty-state handling, and post-create handoff.
  - [x] Verify persisted data survives app restart semantics by testing against SQLite-backed read paths (not only in-memory UI state).

## Dev Notes

### Story Intent
- Story 1.3 is the first read-focused ledger story. It must expose persisted account + ledger state to users and prove baseline continuity before transaction capture stories begin.
- This story extends Story 1.2 rather than replacing it. Keep account creation as the entry path when no account exists.

### Relevant Requirements
- FR5 is the direct target: users can view current account balance and transaction history.
- FR4 continuity still applies: ledger remains going-forward-only.
- NFR13 is critical: ledger consistency across restart and reload.
- NFR12 remains active: no silent data mutation in read flows.

### Current Codebase Reality (Read Before Editing)
- app/src/App.tsx currently renders only AccountSetupScreen.
- app/src/features/ledger/components/AccountSetupScreen.tsx currently handles form validation, backend submit, and success messaging for create-account.
- app/src/features/ledger/service.ts currently exposes only createLedgerAccount().
- app/src/features/ledger/schema.ts currently models only account setup form inputs and currency parsing.
- app/src-tauri/src/commands/ledger.rs currently exposes only create_account command and related tests.
- app/src-tauri/src/lib.rs registers only commands::ledger::create_account.
- app/src-tauri/migrations/0001_create_accounts_and_ledger_entries.sql currently supports accounts and opening_balance ledger entries.

### File-Level Change Guardrails (UPDATE Files)
- app/src-tauri/src/commands/ledger.rs
  - Current state: create_account request validation, SQL transaction write, and command envelope mapping.
  - This story changes: add read-side command(s) for account baseline + ordered entries.
  - Must preserve: create_account semantics, error codes, unique-account behavior, opening balance constraints, and existing tests.
- app/src-tauri/src/lib.rs
  - Current state: SQL plugin setup and create_account invoke handler.
  - This story changes: register new read command(s).
  - Must preserve: SQL preload/migration behavior and plugin initialization order.
- app/src/features/ledger/service.ts
  - Current state: typed invoke wrapper for create_account only.
  - This story changes: add typed wrappers for ledger baseline reads.
  - Must preserve: command envelope typing and naming conventions.
- app/src/features/ledger/schema.ts
  - Current state: account-setup Zod schema and currency parsing helper.
  - This story changes: add/read schemas and types for ledger baseline payloads if needed.
  - Must preserve: existing validation and parseCurrencyToMinorUnits behavior.
- app/src/features/ledger/components/AccountSetupScreen.tsx
  - Current state: first-run setup UI with blocked reasons, server error mapping, and success reset flow.
  - This story changes: optional callback/handoff for post-create transition to ledger view.
  - Must preserve: keyboard-friendly form behavior, blocked-state clarity, and duplicate error rendering.
- app/src/App.tsx
  - Current state: shell rendering account setup only.
  - This story changes: route/view selection between setup and baseline ledger screen.
  - Must preserve: existing CSS shell integration and deterministic initial render.
- app/src/features/ledger/ledger.test.tsx
  - Current state: tests for create flow validation and duplicate response handling.
  - This story changes: add view/read path tests and transition tests.
  - Must preserve: existing Story 1.2 regression coverage.

### Architecture Compliance
- Keep feature-first boundaries under app/src/features/ledger/.
- Keep native command responsibilities in app/src-tauri/src/commands/ledger.rs.
- Keep persistence reads/writes against SQLite through existing sqlx + tauri-plugin-sql setup.
- Keep frontend/native boundary typed and deterministic.
- Do not introduce network calls or cloud dependencies.

### Library and Framework Requirements
- Frontend: React 19.1.x, react-hook-form 7.74.x, zod 4.4.x, Tauri JS API v2.
- Native: Tauri v2, sqlx 0.8.6 (SQLite), tauri-plugin-sql v2.
- Continue using existing stack. Do not introduce alternate DB libraries or state frameworks for this story.

### Data and Query Requirements
- Ledger baseline should return:
  - Account identity (id, bank_name, account_number)
  - Current balance (derived from ledger_entries sum amount_minor for the account)
  - Ordered history entries (id, entry_kind, amount_minor, created_at)
- Ordering must be explicit and deterministic in SQL (for example, created_at then id as tie-breaker).
- Read command must not mutate stored data.

### UX Requirements
- Show account identity and current balance prominently.
- Show transaction history in clear ordered format with deterministic empty state.
- Preserve calm, trust-oriented visual language already established in app/src/App.css.
- Keep keyboard usability and clear state communication consistent with Story 1.2.

### Testing Requirements
- Rust tests should cover:
  - Baseline read succeeds after account creation.
  - Entry ordering is deterministic.
  - Empty history behavior is explicit and stable.
- Frontend tests should cover:
  - Existing account shows baseline view.
  - No account shows setup flow.
  - Successful account creation transitions to baseline view.
  - Existing Story 1.2 tests remain passing.

### Previous Story Intelligence (Story 1.2)
- Reuse the existing command envelope pattern exactly.
- Keep composite uniqueness at persistence layer; do not move that logic into UI-only checks.
- Preserve integer minor-unit money handling across boundaries.
- Preserve explicit blocked-state messaging; avoid generic errors.
- Build incrementally in existing ledger module structure; avoid scattering logic in App.tsx.

### Git Intelligence Summary
- Recent implementation centered in:
  - app/src-tauri/src/commands/ledger.rs
  - app/src-tauri/src/db/ledger.rs
  - app/src/features/ledger/components/AccountSetupScreen.tsx
  - app/src/features/ledger/service.ts
  - app/src/features/ledger/schema.ts
  - app/src/features/ledger/ledger.test.tsx
- Follow these established files and patterns for Story 1.3 to minimize regressions.

### Latest Technical Information
- React reference currently reflects v19.x patterns; keep components/hooks pure and avoid side effects during render.
- sqlx SQLite notes that native SQLite linkage can be semver-sensitive; stay with existing pinned stack and avoid adding alternate SQLite-linking crates.
- Tauri v2 remains the active major line; keep command boundary and plugin model aligned with v2 patterns already in this repo.

### Project Context Reference
- No project-context.md file was discovered via configured persistent_facts glob.

### References
- _bmad-output/planning-artifacts/epics.md (Epic 1, Story 1.3)
- _bmad-output/planning-artifacts/prd.md (FR4, FR5, NFR12, NFR13)
- _bmad-output/planning-artifacts/architecture.md (Core Architectural Decisions, Project Structure and Boundaries, Implementation Patterns)
- _bmad-output/planning-artifacts/ux-design-specification.md (Core User Experience, Journey Patterns, UX requirements)
- _bmad-output/implementation-artifacts/1-2-create-account-and-opening-balance-setup.md (previous story intelligence)
- app/src/App.tsx
- app/src/features/ledger/components/AccountSetupScreen.tsx
- app/src/features/ledger/service.ts
- app/src/features/ledger/schema.ts
- app/src/features/ledger/ledger.test.tsx
- app/src-tauri/src/commands/ledger.rs
- app/src-tauri/src/lib.rs
- app/src-tauri/migrations/0001_create_accounts_and_ledger_entries.sql

## Dev Agent Record

### Agent Model Used
GPT-5.3-Codex

### Debug Log References
- Workflow customization resolved manually because python3 was unavailable; defaults from skill customize.toml applied with no team/user overrides.
- Sprint status scanned in order and story 1-3-view-account-ledger-baseline selected as first ready-for-dev story.
- Red phase completed by adding Rust baseline read tests first and confirming failure due missing symbol.
- Green phase completed by implementing get_ledger_baseline command, deterministic SQL ordering, and command registration.
- Frontend flow implemented with startup baseline discovery, setup-to-baseline handoff, and dedicated baseline view component.
- Validation run: pnpm vitest run src/features/ledger/ledger.test.tsx, pnpm test, cargo test, and pnpm build.

### Completion Notes List
- Added native get_ledger_baseline command with typed response payload (account summary, current balance, ordered entries) and deterministic SQL ordering by created_at DESC, id DESC.
- Preserved existing error envelope shape and create_account behavior while registering the new read command in the Tauri invoke handler.
- Extended frontend typed service/schema contracts and added LedgerBaselineView for account identity, current balance, ordered history, and explicit empty-history state.
- Updated App startup flow to load persisted baseline, render setup when no account exists, and hand off from successful account creation to baseline display.
- Added and passed regression tests for native baseline reads (including empty account state and deterministic ordering semantics) and UI flow transitions.
- Verified end-to-end validation gates: targeted vitest run, full vitest run, full cargo test run, and production frontend build all passed.

### File List
- _bmad-output/implementation-artifacts/1-3-view-account-ledger-baseline.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- app/src-tauri/src/commands/ledger.rs
- app/src-tauri/src/lib.rs
- app/src/features/ledger/service.ts
- app/src/features/ledger/schema.ts
- app/src/features/ledger/components/AccountSetupScreen.tsx
- app/src/features/ledger/components/LedgerBaselineView.tsx
- app/src/App.tsx
- app/src/App.css
- app/src/features/ledger/ledger.test.tsx

### Review Findings
- [x] [Review][Patch] Wrap baseline fetch in try/catch/finally to prevent loading-state deadlock when invoke rejects [app/src/App.tsx:15]
- [x] [Review][Patch] Add rejection-path regression test to lock fallback-to-setup behavior [app/src/features/ledger/ledger.test.tsx:101]

### Change Log
- 2026-05-02: Created Story 1.3 context file with implementation guardrails, previous-story intelligence, and testing requirements.
- 2026-05-02: Implemented baseline ledger read command and deterministic ordering, added baseline UI flow with setup handoff, and completed Rust/UI regression tests. Story moved to review.
- 2026-05-02: Code review applied two patches: hardened baseline loading against rejected invokes and added rejection-path regression test. Manual install verification passed. Story done.
