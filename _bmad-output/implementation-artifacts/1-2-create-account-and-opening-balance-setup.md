# Story 1.2: Deferred Account Confirmation on First Captured Transaction

Status: done

## Metadata
- Story Key: 1-2-create-account-and-opening-balance-setup
- Epic: Epic 1 - Start Private Ledger and Account Baseline
- Created: 2026-05-01T11:14:36.4600043+05:30
- Last Updated: 2026-05-19T23:59:00+05:30
- Source: _bmad-output/planning-artifacts/epics.md
- Change Driver: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-19.md

## Story
As a first-time user,
I want to start from an empty dashboard and only be prompted for account details when save detects a new account,
so that I can capture transactions with minimal first-run friction while preserving a reliable, forward-only ledger.

## Acceptance Criteria
1. Given first launch with no accounts, when I open the app, then I see an empty dashboard with a paste-ready capture surface.
2. Given I paste a message and click Save, when the parsed account does not exist, then the system prompts account confirmation and opening balance before persistence and creates the account with bank+account-number composite uniqueness.
3. Given I paste a message and click Save, when the parsed account already exists and validation passes, then the transaction is saved directly into that account.

## Correct Course Context (2026-05-19)
- Approved correction: onboarding is dashboard-first, not setup-first.
- Account creation remains in scope, but only as a save-triggered conditional branch.
- Existing Story 1.2 implementation data is preserved below as historical context; this file is now the canonical correction guide for re-alignment.

## Tasks / Subtasks
- [x] Align first-run UI contract to dashboard-first behavior (AC: 1)
  - [x] Ensure `app/src/App.tsx` keeps account setup hidden on initial load when no baseline account exists.
  - [x] Keep empty dashboard copy and paste-ready capture as the first-run default.
  - [x] Remove or reword setup-first language in onboarding text and headings.
- [x] Enforce save-triggered conditional account prompt (AC: 2)
  - [x] Gate account setup prompt behind explicit Save attempt when no matching account exists.
  - [x] Ensure save path checks parsed account existence deterministically before opening setup prompt.
  - [x] Persist account creation with opening balance only after user confirmation, preserving composite uniqueness and opening-entry invariants.
- [x] Preserve direct existing-account save path (AC: 3)
  - [x] Keep existing-account route in `attempt_transaction_save` without showing account setup prompt.
  - [x] Preserve mismatch and duplicate decision gates from Story 2.4.
  - [x] Preserve deterministic save-state transitions and audit-trail guarantees from Story 2.5.
- [x] Close UX contract conflicts (AC: 1, 2, 3)
  - [x] Ensure runtime behavior follows explicit Save-only flow.
  - [x] Avoid any implicit or automatic save behavior in Journey 1 runtime.
- [x] Add regression coverage for corrected onboarding contract (AC: 1, 2, 3)
  - [x] Keep and extend `app/src/features/ledger/ledger.test.tsx` for: no prompt on load, prompt on first save with no account, no prompt when account exists.
  - [x] Add backend tests for account-exists decision behavior if command boundary evolves.

## Dev Notes

### Story Intent
- This is a correction story, not a greenfield story.
- Primary objective: keep completed integrity work and re-align onboarding trigger semantics.
- Do not reintroduce setup-first flow through UI text, branching, or tests.

### Relevant Requirements
- FR1: account creation for non-existing parsed account during save flow.
- FR3: opening balance entry during save-triggered new-account creation.
- FR4: going-forward-only ledger invariants remain unchanged.
- FR11, FR13, FR14: strict save validation, guided correction, deterministic state transitions.
- NFR10, NFR12, NFR13, NFR14: zero unsafe writes, no silent mutation, deterministic outcomes.

### Current Codebase Reality (Read Before Editing)
- `app/src/App.tsx`
  - Current state: first-run baseline can render empty dashboard and only opens `AccountSetupScreen` after save attempt when no baseline account exists.
  - Story change: make account-existence check explicit against parsed account identity, not just baseline presence.
  - Must preserve: save lifecycle state machine, correction flow, mismatch/duplicate decisions, desktop runtime guard.
- `app/src/features/ledger/components/AccountSetupScreen.tsx`
  - Current state: setup-first copy still says "First-run ledger setup" and assumes initial setup framing.
  - Story change: reframe as conditional account confirmation dialog/surface triggered by save-time detection.
  - Must preserve: RHF+Zod validation, blocked reasons, duplicate-account envelope handling.
- `app/src/features/ledger/ledger.test.tsx`
  - Current state: already includes save-triggered prompt regression coverage.
  - Story change: strengthen assertions for parsed-account existence branch and ensure no setup-first fallback regressions.
  - Must preserve: existing tests proving hidden prompt on load and visible prompt only after first save attempt in no-account state.
- `app/src-tauri/src/commands/capture.rs`
  - Current state: deterministic validation and persistence path expects resolved account context, with mismatch and duplicate gates.
  - Story change: support explicit "parsed account does not exist" signaling if needed by frontend orchestration.
  - Must preserve: atomic persistence, deterministic fingerprinting, duplicate-skip behavior, audit trail writes.
- `app/src-tauri/src/commands/ledger.rs`
  - Current state: `create_account` enforces composite uniqueness and opening-balance invariants.
  - Story change: no weakening of uniqueness, validation bounds, or error envelope contracts.
  - Must preserve: deterministic duplicate rejection and transactionally consistent account+opening-entry writes.

### Architecture Compliance Guardrails
- Keep typed frontend-to-Tauri command boundary and standardized envelope contracts.
- Keep all persistence and uniqueness guarantees in native command + DB layer.
- Respect feature boundaries:
  - account and ledger behavior in `src/features/ledger/` and `src-tauri/src/commands/ledger.rs`
  - capture/save orchestration in `src/features/capture/` and `src-tauri/src/commands/capture.rs`
- No external network calls for core flow.

### Library and Framework Requirements
- Use existing stack only; do not introduce new state/form frameworks.
- Frontend: React 19, React Hook Form 7.x, Zod 4.x.
- Native: Tauri v2 commands, SQLx 0.8.x transaction boundaries.
- Keep command names unique and registered via single `generate_handler!` surface.

### Latest Technical Information
- Tauri v2 docs confirm command names must be unique and commands are invoked by string name from frontend.
- SQLx 0.8 docs confirm transaction should end with commit or rollback; rollback occurs on drop if still in progress.
- React 19 `useState` behavior is batched/snapshot-based; do not depend on immediate post-set state reads inside event handlers.

### UX Guardrails
- First launch UX must be empty dashboard + paste-ready capture.
- Journey 1 must use explicit save-triggered branching for account confirmation.
- Any wording or behavior suggesting implicit auto-save is out of scope for this corrected story.
- Keep blocked-save reasons explicit and actionable.

### Testing Requirements
- Frontend regression tests for onboarding branch conditions are mandatory.
- Save-time branch tests must prove all three AC paths.
- Preserve existing Story 2.1-2.5 behavior and tests; this story must not regress deterministic save and audit behavior.

### Previous Story Intelligence (Story 1.1)
- Story 1.1 established local-first desktop foundation and no-network core flow.
- Correction work must build on current foundation, not re-scaffold runtime, tooling, or packaging setup.

### Git Intelligence Summary
- Recent commits are concentrated on Story 2.5 deterministic save and review patches.
- Correction implementation should leverage current save pipeline instead of building parallel onboarding logic.

### Project Context Reference
- No project-context.md file was discovered.

### References
- _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-19.md
- _bmad-output/planning-artifacts/epics.md
- _bmad-output/planning-artifacts/prd.md
- _bmad-output/planning-artifacts/architecture.md
- _bmad-output/planning-artifacts/ux-design-specification.md
- _bmad-output/implementation-artifacts/1-1-set-up-initial-project-from-starter-template.md
- app/src/App.tsx
- app/src/features/ledger/components/AccountSetupScreen.tsx
- app/src/features/ledger/ledger.test.tsx
- app/src/features/ledger/service.ts
- app/src/features/capture/service.ts
- app/src-tauri/src/commands/capture.rs
- app/src-tauri/src/commands/ledger.rs

## Story Completion Status
- Status set to: review
- Completion note: Story implementation completed for the deferred account confirmation flow. The dashboard now stays first-run friendly, account confirmation appears only on save-triggered new-account detection, and regression coverage protects the corrected onboarding contract.

## Historical Implementation Snapshot
- 2026-05-01 implementation delivered setup-first Story 1.2 behavior with strong ledger invariants and tests.
- 2026-05-19 course-correction approved to defer account confirmation until first qualifying save.
- This section preserves historical facts while the active story contract above governs future implementation.

## Dev Agent Record

### Agent Model Used
GPT-5.3-Codex

### Debug Log References
- Workflow activation resolved from skill customization.
- Sprint status, epics, PRD, architecture, UX, previous story artifact, implementation files, and recent git commits analyzed.
- Story rewritten as correction-focused ready-for-dev context.
- Reworded the onboarding surface to remove setup-first framing and keep the first-run dashboard paste-ready.
- Added an explicit parsed-account identity check before opening the account confirmation surface on save.
- Extended frontend regression coverage to assert the deferred confirmation heading and preserve the existing-account save path.
- Validated with `pnpm vitest run src/features/ledger/ledger.test.tsx`, `pnpm vitest run`, and `pnpm build`.

### Completion Notes List
- Reframed Story 1.2 to deferred account confirmation on first captured transaction.
- Captured code-level guardrails for update files that must be touched and behavior that must be preserved.
- Added explicit anti-regression constraints to protect Story 2 deterministic save and audit behavior.
- Updated `app/src/App.tsx` so first-run remains dashboard-first, with save-time prompting guarded by parsed account identity.
- Reworded `AccountSetupScreen` to an account confirmation surface instead of a first-run setup flow.
- Extended `app/src/features/ledger/ledger.test.tsx` to assert the new copy and preserve no-prompt/load and existing-account flows.
- Confirmed the app test suite and build pass after the change.

### File List
- _bmad-output/implementation-artifacts/1-2-create-account-and-opening-balance-setup.md
- app/src/App.tsx
- app/src/features/ledger/components/AccountSetupScreen.tsx
- app/src/features/ledger/ledger.test.tsx

### Change Log
- 2026-05-20: Re-aligned Story 1.2 onboarding to dashboard-first behavior and deferred account confirmation to save-time detection.