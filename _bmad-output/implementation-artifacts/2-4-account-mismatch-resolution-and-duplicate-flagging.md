# Story 2.4: Account Mismatch Resolution and Duplicate Flagging

## Metadata
- Story Key: 2-4-account-mismatch-resolution-and-duplicate-flagging
- Epic: Epic 2 - Capture Transactions with Safe Validation and Corrections
- Status: review
- Created: 2026-05-14T00:00:00+05:30
- Last Updated: 2026-05-14T00:00:00+05:30
- Source: _bmad-output/planning-artifacts/epics.md

## Story
As a user,
I want account mismatches and duplicates handled transparently,
So that I can avoid silent ledger corruption.

## Acceptance Criteria
1. Given a parsed message with account format mismatch or possible duplicate, when the system evaluates save readiness, then mismatch requires explicit resolution before write, and duplicates are flagged with user-visible choice while preserving deterministic outcomes.
2. Given both account mismatch and duplicate signals are present, when the user resolves mismatch but does not resolve duplicate choice, then the save path remains blocked where explicit decision is required, and final behavior is deterministic for the same inputs.

## Tasks / Subtasks

- [x] Add mismatch and duplicate decision contracts to save-attempt flow (AC: 1, 2)
  - [x] Extend `SaveTransactionAttemptPayload` to carry explicit mismatch resolution and duplicate decision values.
  - [x] Ensure payload fields are typed and deterministic in `app/src/features/capture/service.ts`.
- [x] Implement backend mismatch + duplicate detection in validation gate (AC: 1, 2)
  - [x] Update `app/src-tauri/src/commands/capture.rs` save-attempt logic to detect account mismatch conditions.
  - [x] Add deterministic duplicate candidate detection using stable ruleset.
  - [x] Return structured blocking details for unresolved mismatch/duplicate decisions.
  - [x] Keep this story as validation and decision-gating only; do not persist write rows yet.
- [x] Implement explicit frontend resolution UX (AC: 1, 2)
  - [x] Create `app/src/features/capture/components/AccountMismatchResolver.tsx`.
  - [x] Create `app/src/features/capture/components/DuplicateFlagIndicator.tsx`.
  - [x] Update `ReadinessStatus` and/or `App.tsx` to enforce composite rule: mismatch and duplicate decisions both required when both signals exist.
  - [x] Keep messaging deterministic and non-color-only.
- [x] Add deterministic regression coverage (AC: 1, 2)
  - [x] Extend `app/src/features/capture/capture.test.tsx` for mismatch-only, duplicate-only, and both-signals scenarios.
  - [x] Add Rust tests for deterministic mismatch detection and duplicate flagging outputs.
  - [x] Preserve all Story 2.1, 2.2, and 2.3 test behavior unchanged.

## Dev Notes

### Story Intent
- Story 2.4 introduces explicit user decision points for account mismatch and duplicates.
- This is still pre-persistence gate behavior: decisions determine save eligibility but do not write transactions in this story.
- The highest risk is non-deterministic blocking behavior when both signals are present.

### Relevant Requirements
- FR8: detect account format variance and prompt user resolution.
- FR12: detect duplicate transactions and flag while allowing save with explicit marker.
- FR14: deterministic parse-validate-save transitions.
- NFR12 and NFR14: no silent mutation and deterministic outcomes.

### Discovery Results
- Loaded `{epics_content}` from `_bmad-output/planning-artifacts/epics.md`.
- Loaded `{prd_content}` from `_bmad-output/planning-artifacts/prd.md`.
- Loaded `{architecture_content}` from `_bmad-output/planning-artifacts/architecture.md`.
- Loaded `{ux_content}` from `_bmad-output/planning-artifacts/ux-design-specification.md`.
- Loaded previous story intelligence from `_bmad-output/implementation-artifacts/2-2-critical-field-validation-gate-before-save.md` and newly prepared Story 2.3 context.

### Current Codebase Reality (Read Before Editing)
- `app/src/features/capture/service.ts`
  - Save-attempt payload currently includes account context and parsed payload only.
- `app/src/features/capture/schema.ts`
  - Has critical-field and blocked-reason semantics but no mismatch/duplicate decision models yet.
- `app/src/App.tsx`
  - Orchestrates parse/save state and blocked reasons, with no mismatch/duplicate choice flow.
- `app/src/features/capture/components/ReadinessStatus.tsx`
  - Renders validation errors but no explicit mismatch resolver or duplicate decision UI.
- `app/src-tauri/src/commands/capture.rs`
  - Performs critical-field validation gate and deterministic non-write response.
  - Does not yet evaluate account mismatch against account context or duplicate-candidate policy.

### File-Level Change Guardrails (UPDATE files)

`app/src-tauri/src/commands/capture.rs` (UPDATE)
- Current state: critical-field validation only, no persistence.
- Story change: add deterministic account mismatch and duplicate-candidate detection in gate response logic.
- Must preserve: parse command behavior, current envelope shape, and no-write behavior in Story 2.4.

`app/src/features/capture/service.ts` (UPDATE)
- Current state: no mismatch/duplicate decision fields in save payload.
- Story change: add typed decision payload fields and response details parsing.
- Must preserve: existing command names and envelope handling.

`app/src/features/capture/schema.ts` (UPDATE)
- Current state: critical-field and blocked-field schemas.
- Story change: define mismatch/duplicate decision enums and helper label mappings.
- Must preserve: existing critical-field order and ambiguity logic.

`app/src/App.tsx` (UPDATE)
- Current state: parse/save orchestration with blocked reasons.
- Story change: add state for mismatch resolution and duplicate decision; enforce composite blocking rule.
- Must preserve: runtime guard, baseline load fallback, and account setup path.

`app/src/features/capture/components/ReadinessStatus.tsx` (UPDATE)
- Current state: parse and save-gate status presentation.
- Story change: surface mismatch and duplicate signals, and wire decision components.
- Must preserve: existing parse and validation feedback.

`app/src/features/capture/capture.test.tsx` (UPDATE)
- Current state: parse and validation-gate tests.
- Story change: add deterministic tests for mismatch/duplicate resolution combinations.
- Must preserve: existing tests and expected outputs.

### New Files Expected (NEW)
- `app/src/features/capture/components/AccountMismatchResolver.tsx`
- `app/src/features/capture/components/DuplicateFlagIndicator.tsx`

### Architecture Compliance
- Keep command boundary typed and deterministic.
- Keep no-silent-mutation invariant: decisions are explicit and user-visible.
- Keep feature-first module boundaries under `app/src/features/capture/`.
- Avoid adding unrelated state managers or libraries.

### Library and Framework Requirements
- Reuse current React 19 + Zod + Vitest stack.
- Reuse Rust/Tauri/sqlx stack already present.
- Keep error details serialized in stable, frontend-parseable shape.

### UX Requirements (from UX spec)
- Explicit blocked reasons and next actions.
- Non-color-only communication for mismatch and duplicate states.
- Keep correction and readiness flows compact (progressive disclosure).
- Preserve keyboard-first interactions.

### Data and Domain Guardrails
- Mismatch must always require explicit resolution.
- Duplicate can allow eventual save only after explicit user choice when applicable.
- If both signals exist, both decisions must be resolved before passing gate.
- Do not persist transactions or audit rows in this story.

### Testing Requirements
- Rust tests:
  - Mismatch detection deterministic for same inputs.
  - Duplicate-candidate detection deterministic for same inputs/rules.
  - Composite unresolved-state response is stable and blocks save.
- Frontend tests:
  - Mismatch-only scenario blocks until resolution selected.
  - Duplicate-only scenario blocks until decision selected if policy requires explicit decision.
  - Both-signals scenario requires both resolutions before retry.
- Regression tests:
  - Preserve all prior Story 2.1 to 2.3 test expectations.

### Cross-Story Dependencies and Boundaries
- Depends on Story 2.3 correction and retry UX foundation.
- Enables Story 2.5 by producing fully resolved save-decision state.
- Must not introduce write persistence or audit logging (Story 2.5 scope).

### Previous Story Intelligence
- Story 2.2 and 2.3 establish deterministic blocked-field and retry semantics.
- Keep UI and backend decision semantics aligned to avoid false-positive/false-ready states.

### Git Intelligence Summary
- Recent commits concentrated around capture flow and save gate behavior (`capture.rs`, `App.tsx`, `capture.test.tsx`).
- Follow current error-envelope and test conventions.

### Latest Technical Information
- Tauri v2 command docs: command names remain globally unique and invoked without module prefixes.
- SQLx transaction model: keep explicit rollback in non-write gate paths.
- React state update model: avoid stale-state bugs when composing mismatch and duplicate resolution state.

### Project Context Reference
- No project-level `project-context.md` discovered.

### References
- `_bmad-output/planning-artifacts/epics.md` (Epic 2, Story 2.4)
- `_bmad-output/planning-artifacts/prd.md` (FR8, FR12, FR14, NFR12, NFR14)
- `_bmad-output/planning-artifacts/architecture.md` (typed command boundary, deterministic contracts)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (clear guidance, progressive disclosure, keyboard-first)
- `_bmad-output/implementation-artifacts/2-2-critical-field-validation-gate-before-save.md`
- `_bmad-output/implementation-artifacts/2-3-guided-correction-and-retry-flow.md`
- `app/src-tauri/src/commands/capture.rs`
- `app/src/App.tsx`
- `app/src/features/capture/schema.ts`
- `app/src/features/capture/service.ts`
- `app/src/features/capture/components/ReadinessStatus.tsx`
- `app/src/features/capture/capture.test.tsx`

## Story Completion Status
- Status set to: review
- Completion note: Story implementation completed with deterministic mismatch/duplicate decision gating and full frontend/backend regression coverage.

## Dev Agent Record

### Agent Model Used
GPT-5.3-Codex

### Debug Log References
- Workflow activation and artifact discovery completed.
- Epic 2 backlog stories analyzed end-to-end with current codebase constraints.
- Updated sprint status to in-progress and executed Story 2.4 implementation sequence.
- Implemented frontend mismatch/duplicate decision contracts and UI resolution components.
- Implemented backend account mismatch and duplicate candidate detection with structured blocking details.
- Executed `pnpm test` in app workspace: all 24 tests passing.
- Executed `cargo test` in src-tauri workspace: all 29 tests passing.

### Completion Notes List
- Created story context with deterministic mismatch/duplicate guardrails and composite decision rules.
- Added typed decision contracts in capture schema/service for mismatch and duplicate handling.
- Added `AccountMismatchResolver` and `DuplicateFlagIndicator` components and wired them into readiness/save gating UX.
- Added backend decision-gating signals (`accountMismatch`, `duplicateCandidate`) with deterministic fingerprints and explicit decision requirements.
- Added frontend regression tests for mismatch-only, duplicate-only, and both-signals gating scenarios.
- Added Rust regression tests for mismatch detection, duplicate detection, and composite decision requirements.

### File List
- _bmad-output/implementation-artifacts/2-4-account-mismatch-resolution-and-duplicate-flagging.md
- app/src/features/capture/schema.ts
- app/src/features/capture/service.ts
- app/src/features/capture/components/ReadinessStatus.tsx
- app/src/features/capture/components/AccountMismatchResolver.tsx
- app/src/features/capture/components/DuplicateFlagIndicator.tsx
- app/src/features/capture/capture.test.tsx
- app/src/App.tsx
- app/src-tauri/src/commands/capture.rs
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log
- 2026-05-16: Implemented Story 2.4 mismatch/duplicate decision gating across frontend and backend; added deterministic tests; moved story status to review.
