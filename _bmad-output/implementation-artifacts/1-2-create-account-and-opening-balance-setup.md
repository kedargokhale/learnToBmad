# Story 1.2: Create Account and Opening Balance Setup

## Metadata
- Story Key: 1-2-create-account-and-opening-balance-setup
- Epic: Epic 1 - Start Private Ledger and Account Baseline
- Status: done
- Created: 2026-05-01T11:14:36.4600043+05:30
- Last Updated: 2026-05-01T11:56:30+05:30
- Source: _bmad-output/planning-artifacts/epics.md

## Story
As a first-time user,
I want to create an account from pasted transaction context and set an opening balance,
So that I can start a reliable, forward-only ledger.

## Acceptance Criteria
1. Given no account exists for a bank/account-number pair, when I confirm bank and account number and enter opening balance, then a new account is created using bank+account-number composite uniqueness and the ledger starts from that opening balance in going-forward-only mode.

## Tasks / Subtasks
- [x] Establish the ledger persistence baseline for account setup (AC: 1)
  - [x] Add the first SQLite migration and database bootstrap under `app/src-tauri/migrations/` and `app/src-tauri/src/db/` for the minimal account and ledger tables needed by this story.
  - [x] Use architecture naming rules: snake_case plural tables, snake_case columns, `id` primary keys, and integer minor units for money values.
  - [x] Enforce composite uniqueness for bank name + account number at the persistence boundary so duplicate account creation fails deterministically.
  - [x] Preserve the going-forward-only ledger invariant when recording the opening balance; do not rely on silent mutable balance shortcuts.
- [x] Implement the native ledger command boundary for account creation (AC: 1)
  - [x] Replace the starter `greet` command path with ledger-focused command modules rooted at `app/src-tauri/src/commands/ledger.rs`.
  - [x] Return the standardized command envelope: success `{ ok: true, data: ... }`, failure `{ ok: false, error: { code, message, hint?, details? } }`.
  - [x] Register commands and database initialization through `app/src-tauri/src/lib.rs` without widening native capabilities beyond local-first needs.
- [x] Build the first-run account setup UI using the planned feature structure (AC: 1)
  - [x] Replace the starter React demo in `app/src/App.tsx` with a ledger entry surface that confirms bank, account number, and opening balance from pasted transaction context.
  - [x] Start the feature-first structure under `app/src/features/ledger/` rather than keeping business logic in `App.tsx`.
  - [x] Add the selected frontend foundations needed by this story where missing: React Hook Form + Zod for form constraints, Zustand only if local ledger setup state needs a shared feature slice, and Tailwind-aligned styling setup if introduced by the implementation.
  - [x] Keep the first-run flow keyboard-friendly with clear blocked-state reasons and focused correction messaging.
- [x] Add tests that lock the invariant in place (AC: 1)
  - [x] Add backend or integration coverage for composite uniqueness and opening-balance ledger initialization.
  - [x] Add frontend coverage for valid setup, invalid form input, and duplicate account responses mapped from the native error envelope.

### Review Findings
- [x] [Review][Patch] Use structured SQLite unique-constraint detection instead of brittle message substring matching [app/src-tauri/src/commands/ledger.rs:197]
- [x] [Review][Patch] Enforce opening-balance upper bounds and align DB constraint with command validation to prevent extreme integer values [app/src-tauri/src/commands/ledger.rs:180]
- [x] [Review][Patch] Add database-level `amount_minor` range check to match command-level financial bounds [app/src-tauri/migrations/0001_create_accounts_and_ledger_entries.sql:12]
- [x] [Review][Patch] Ensure SQLite foreign-key enforcement is explicitly enabled on the runtime connection [app/src-tauri/migrations/0001_create_accounts_and_ledger_entries.sql:1]
- [x] [Review][Patch] Reset/clear success state and form values after successful account creation to avoid stale-success UI state [app/src/features/ledger/components/AccountSetupScreen.tsx:80]
- [x] [Review][Patch] Add a whitespace-only form input regression test to lock trim-based required validation [app/src/features/ledger/ledger.test.tsx:76]

## Dev Notes

### Story Intent
- This is the first real domain story after the starter scaffold. The codebase still contains the default Tauri greeting UI and a single `greet` command, so this story should establish the first ledger-shaped vertical slice rather than layering new logic onto the starter demo.
- The outcome is a first-run account setup path that anchors the ledger safely and becomes the base for Story 1.3 ledger viewing.

### Relevant Requirements
- FR1-FR4 drive this story: create account from pasted context, composite account identity, opening balance setup, and a going-forward-only ledger model.
- NFR10 and NFR12 are the main integrity constraints here: no unsafe writes and no silent mutation.
- PRD first-run journey expects account confirmation and opening balance entry before the user sees downstream insight value.

### Current Codebase Reality
- `app/src/App.tsx` is still the starter Tauri greeting form and should not remain the long-term implementation surface.
- `app/src/main.tsx` only mounts `App` with no routing or providers yet.
- `app/src-tauri/src/lib.rs` currently registers only `greet` and the SQL/opener plugins.
- `app/src-tauri/Cargo.toml` already includes `tauri-plugin-sql` with SQLite support, so this story should build on that instead of reworking Story 1.1 scaffolding.
- `app/package.json` does not yet include the architecture-selected UI/form/state libraries beyond React and Tauri APIs.

### Architecture Guardrails
- Keep all persistence concerns inside `app/src-tauri/migrations/` and `app/src-tauri/src/db/`.
- Put account and ledger native commands under `app/src-tauri/src/commands/ledger.rs`.
- Put frontend ledger code under `app/src/features/ledger/` with `schema.ts`, `service.ts`, `store.ts`, and `selectors.ts` patterns where they are needed.
- Keep UI/native contracts typed and map persistence snake_case to UI camelCase at the boundary.
- Never surface raw native errors directly to the UI.
- Keep all financial data local-first; no network dependency or remote API path is allowed.

### UX Guardrails
- The first useful flow is: open app, see paste-ready surface, confirm fields that matter, enter opening balance, save safely.
- Safety gates must explain what is missing and why; blocked states cannot be generic.
- Keep the interaction keyboard-first and deterministic.
- Prefer a focused first-run setup surface over a dense multi-panel screen.

### Suggested Implementation Shape
- Create the minimal vertical slice needed for this story instead of trying to realize the whole target architecture at once.
- A reasonable slice is:
  - database init + first migration
  - ledger/account command module
  - minimal typed service on the frontend that invokes account-creation commands
  - account setup form with validation and success/error states
- Defer non-essential dashboard, categorization, parser breadth, and import/export concerns to later stories.

### Testing Notes
- Validate duplicate account rejection at the database-backed path, not just with frontend form checks.
- Validate opening balance handling with integer minor units to avoid floating-point drift.
- Verify app restart compatibility where practical so Story 1.3 can rely on persisted account state.

### Project Structure Notes
- The architecture target structure is ahead of the current repository state. Create only the directories and files needed for Story 1.2, but align names and boundaries with the architecture document so later stories extend rather than rename.
- Avoid spreading ledger domain logic across `App.tsx`, random shared utilities, and inline Tauri command strings. Establish one clean path now.

### References
- `_bmad-output/planning-artifacts/epics.md` - Epic 1 / Story 1.2
- `_bmad-output/planning-artifacts/prd.md` - Journey 1, Account & Transaction Ledger Management, Project Scoping
- `_bmad-output/planning-artifacts/architecture.md` - Core Architectural Decisions, Project Structure & Boundaries, Implementation Patterns & Consistency Rules
- `_bmad-output/planning-artifacts/ux-design-specification.md` - Journey 1: First Useful Insight in Minutes, Journey Patterns, Flow Optimization Principles
- `_bmad-output/implementation-artifacts/1-1-set-up-initial-project-from-starter-template.md` - previous story baseline

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- Sprint status reviewed before story creation.
- Current app surface inspected to anchor implementation notes to the real codebase.
- Native ledger command, migration registration, and SQL capability scope implemented for the first persistence slice.
- Frontend account setup form built under the ledger feature boundary with RHF + Zod and mapped native error handling.
- Validation completed with `cargo test`, `pnpm test`, and `pnpm build`.

### Completion Notes List

- Story context created from Epic 1, PRD, architecture, UX, and current repository state.
- Story is ready for development.
- Added the first SQLite migration, preload configuration, and typed DB access for local ledger account setup.
- Implemented `create_account` native command with deterministic duplicate rejection and explicit opening-balance ledger entry creation.
- Replaced the starter React demo with a first-run account setup screen under `src/features/ledger/` using React Hook Form + Zod.
- Added backend tests for opening-balance initialization and composite uniqueness, plus frontend tests for valid submit, invalid amount input, and duplicate-account responses.

### File List

- _bmad-output/implementation-artifacts/1-2-create-account-and-opening-balance-setup.md
- app/package.json
- app/pnpm-lock.yaml
- app/src/App.css
- app/src/App.tsx
- app/src/features/ledger/components/AccountSetupScreen.tsx
- app/src/features/ledger/ledger.test.tsx
- app/src/features/ledger/schema.ts
- app/src/features/ledger/service.ts
- app/src/test/setup.ts
- app/src-tauri/Cargo.toml
- app/src-tauri/capabilities/default.json
- app/src-tauri/migrations/0001_create_accounts_and_ledger_entries.sql
- app/src-tauri/src/commands/ledger.rs
- app/src-tauri/src/commands/mod.rs
- app/src-tauri/src/db/ledger.rs
- app/src-tauri/src/db/mod.rs
- app/src-tauri/src/lib.rs
- app/src-tauri/tauri.conf.json
- app/vitest.config.ts

### Change Log

- 2026-05-01: Created Story 1.2 context file and marked the story ready-for-dev.
- 2026-05-01: Implemented account setup persistence, native ledger command envelope, first-run setup UI, and validation coverage; story moved to review.