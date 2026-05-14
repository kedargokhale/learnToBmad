# Story 2.3: Guided Correction and Retry Flow

## Metadata
- Story Key: 2-3-guided-correction-and-retry-flow
- Epic: Epic 2 - Capture Transactions with Safe Validation and Corrections
- Status: review
- Created: 2026-05-14T00:00:00+05:30
- Last Updated: 2026-05-14T00:40:00+05:30
- Source: _bmad-output/planning-artifacts/epics.md

## Story
As a user,
I want focused correction for flagged fields,
So that I can recover quickly and complete capture safely.

## Acceptance Criteria
1. [FR13][FR14][NFR10][NFR12] Given parse issues are detected, when I open correction controls, then only required fields and format guidance are shown with real-time validation, and I can retry save immediately after corrections pass validation.

### Acceptance Criteria Traceability
- AC1 -> FR13, FR14, NFR10, NFR12

## Tasks / Subtasks

- [x] Add focused correction workflow in capture UI (AC: 1)
  - [x] Create `app/src/features/capture/components/CorrectionPanel.tsx` for field-level correction controls.
  - [x] Render only currently blocked critical fields using `deriveBlockedFieldReasons` outputs.
  - [x] Show deterministic, actionable hints per field from existing blocked-reason guidance.
  - [x] Keep keyboard-first behavior (predictable tab flow, Enter to apply, Escape to close).
- [x] Add real-time correction validation and retry orchestration (AC: 1)
  - [x] Extend capture state orchestration in `app/src/App.tsx` to hold corrected values without losing parse context.
  - [x] Recompute blocked fields immediately after each correction edit.
  - [x] Enable save retry only when all critical fields are valid.
  - [x] Reuse existing `attemptTransactionSave` command path; do not add new backend command in this story.
- [x] Integrate correction visibility into readiness surfaces (AC: 1)
  - [x] Update `ReadinessStatus` to expose correction entry points only when blocked fields exist.
  - [x] Keep parse and save status communication using non-color cues.
- [x] Add deterministic regression coverage (AC: 1)
  - [x] Extend `app/src/features/capture/capture.test.tsx` with correction flow tests.
  - [x] Verify blocked fields shrink deterministically as fields are corrected.
  - [x] Verify save retry is unavailable until all critical fields are valid.
  - [x] Preserve all existing Story 2.1 and 2.2 tests unchanged.

## Dev Notes

### Story Intent
- This story adds correction UX and retry behavior only.
- Backend validation remains in Story 2.2 command paths; this story must not introduce persistence.
- Deterministic correction behavior is mandatory: same inputs and same edits must produce same blocked-field outcomes.

### Relevant Requirements
- FR13: users can review blocked saves, correct missing or ambiguous fields, and retry save.
- FR14: deterministic parse-validate-save transitions.
- NFR10: zero-tolerance for saving transactions with missing critical fields.
- NFR12: no silent mutation.

### Discovery Results
- Loaded `{epics_content}` from `_bmad-output/planning-artifacts/epics.md`.
- Loaded `{prd_content}` from `_bmad-output/planning-artifacts/prd.md`.
- Loaded `{architecture_content}` from `_bmad-output/planning-artifacts/architecture.md`.
- Loaded `{ux_content}` from `_bmad-output/planning-artifacts/ux-design-specification.md`.
- Loaded previous story intelligence from `_bmad-output/implementation-artifacts/2-2-critical-field-validation-gate-before-save.md`.

### Current Codebase Reality (Read Before Editing)
- `app/src/features/capture/schema.ts`
  - Provides critical-field schemas and deterministic blocked-field derivation.
  - Already encodes required fields and ambiguity logic.
- `app/src/features/capture/service.ts`
  - Provides `parse_transaction_message` and `attempt_transaction_save` adapters.
- `app/src/features/capture/components/TransactionInput.tsx`
  - Handles parse triggering and save-attempt button behavior.
- `app/src/features/capture/components/ReadinessStatus.tsx`
  - Displays parse results and save validation errors.
- `app/src/App.tsx`
  - Central orchestration for parse preview, save attempt, and baseline refresh.
- `app/src-tauri/src/commands/capture.rs`
  - Save command validates deterministically and intentionally does not persist writes yet.

### File-Level Change Guardrails (UPDATE files)

`app/src/App.tsx` (UPDATE)
- Current state: parse + save-gate orchestration.
- Story change: add correction state and retry flow orchestration.
- Must preserve: desktop runtime guard, baseline loading behavior, account setup fallback, existing parse/save error handling.

`app/src/features/capture/schema.ts` (UPDATE)
- Current state: blocked-field derivation and display-name mappings.
- Story change: add correction form schemas and helper utilities for corrected field payloads.
- Must preserve: critical field order, ambiguity rules, and readiness-label mappings.

`app/src/features/capture/components/ReadinessStatus.tsx` (UPDATE)
- Current state: parse and save-gate status rendering.
- Story change: integrate correction panel trigger and corrected-values preview.
- Must preserve: parse-failure and save-error rendering paths.

`app/src/features/capture/components/TransactionInput.tsx` (UPDATE only if needed)
- Current state: parse input and save button.
- Story change: optional hook-up to correction open/close callbacks.
- Must preserve: race-order protection, deterministic parse trigger behavior.

`app/src/features/capture/capture.test.tsx` (UPDATE)
- Current state: parse success/failure, save-gate blocked reasons.
- Story change: add correction + retry scenarios with deterministic assertions.
- Must preserve: all existing test cases and expected outputs.

### New Files Expected (NEW)
- `app/src/features/capture/components/CorrectionPanel.tsx`

### Architecture Compliance
- Keep feature-first frontend structure under `app/src/features/capture/`.
- Reuse existing typed command envelope and service adapters.
- Keep validation enforcement in backend command layer; UI must not bypass backend checks.
- Keep local-first invariant (no external network calls).

### Library and Framework Requirements
- Reuse current stack in `app/package.json`: React 19.x, Zod 4.x, Vitest 4.x.
- Do not add new form libraries for this story; leverage existing React state + Zod patterns.

### UX Requirements (from UX spec)
- Show only required correction fields, not full-form overload.
- Provide immediate field-level validation feedback.
- Keep progressive disclosure and non-color-only state communication.
- Maintain keyboard-first flow and clear next-action guidance.

### Data and Domain Guardrails
- Corrections in this story are in-memory view-model edits until validation succeeds.
- Do not persist correction history or ledger writes in Story 2.3.
- Save retry remains blocked while any required field is missing or ambiguous.

### Testing Requirements
- Frontend tests:
  - [FR13][NFR10] Blocked fields render in CorrectionPanel with field-specific hints.
  - [FR13][FR14] Correcting one field reduces blocked reasons deterministically.
  - [NFR10][NFR12] Save button remains disabled until blocked list is empty.
  - [FR13][FR14][NFR12] Retry save runs existing save-attempt path and surfaces backend outcome.
- Deterministic negative-path scenarios:
  - [FR13][FR14][NFR10] Repeated invalid corrections keep save blocked with identical blocked-field ordering and identical hint text.
  - [FR14][NFR12] Retry save on unresolved corrections returns deterministic error envelope and leaves ledger baseline unchanged.
  - [FR13][FR14] Alternating invalid/valid edits on the same field always recompute the same blocked-state transitions for identical edit sequences.
  - [NFR10][NFR12] Parse-failed or ambiguous payload paths must never unlock save and must not trigger any mutation side effects.
- Regression tests:
  - [FR14][NFR12] Preserve all Story 2.1 and Story 2.2 test behavior unchanged.

### Cross-Story Dependencies and Boundaries
- Depends on Story 2.2 save-gate command and blocked-field detail shape.
- Enables Story 2.4 by establishing deterministic correction/retry UI patterns.
- Must not implement account mismatch resolution (Story 2.4).
- Must not implement persistence/audit writes (Story 2.5).

### Previous Story Intelligence
- Story 2.2 established deterministic blocked-field ordering and backend gate behavior.
- Keep frontend and backend validation semantics aligned to avoid false-ready states.
- Preserve explicit blocked-save reasons in UI while adding correction affordances.

### Git Intelligence Summary
- Recent commits show capture work centered on `capture.rs`, `App.tsx`, and `app/src/features/capture/*`.
- Reuse current naming/envelope/test patterns from those changes.

### Latest Technical Information
- Tauri v2 command docs (updated Nov 2025): keep command names globally unique and registered in one `generate_handler!` list.
- SQLx transactions: rollback semantics should be explicit in validation paths where no write should occur.
- React `useState` behavior: state updates are batched and snapshot-based; correction orchestration should avoid stale-state races.

### Project Context Reference
- No project-level `project-context.md` discovered.

### References
- `_bmad-output/planning-artifacts/epics.md` (Epic 2, Story 2.3)
- `_bmad-output/planning-artifacts/prd.md` (FR13, FR14, NFR10, NFR12)
- `_bmad-output/planning-artifacts/architecture.md` (typed boundaries, deterministic behavior patterns)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (focused correction, progressive disclosure, keyboard-first)
- `_bmad-output/implementation-artifacts/2-2-critical-field-validation-gate-before-save.md`
- `app/src/App.tsx`
- `app/src/features/capture/schema.ts`
- `app/src/features/capture/service.ts`
- `app/src/features/capture/components/TransactionInput.tsx`
- `app/src/features/capture/components/ReadinessStatus.tsx`
- `app/src/features/capture/capture.test.tsx`
- `app/src-tauri/src/commands/capture.rs`

## Story Completion Status
- Status set to: review
- Completion note: Guided correction and retry flow implemented with deterministic blocked-field recomputation and full regression validation.

## Dev Agent Record

### Agent Model Used
GPT-5.3-Codex

### Debug Log References
- Workflow activation and artifact discovery completed.
- Full sprint status parsed; story selected from Epic 2 backlog set.
- Existing code paths inspected for frontend and Rust capture flow.
- Implemented correction panel and schema-backed in-memory correction orchestration in capture UI.
- Ran `pnpm test -- src/features/capture/capture.test.tsx`, `pnpm test`, and `pnpm build` successfully.

### Completion Notes List
- Created story context with explicit update-file guardrails, deterministic correction rules, and regression test requirements.
- Added deterministic negative-path test scenarios covering repeated invalid corrections, retry-failure determinism, and non-mutation guarantees.
- Added focused `CorrectionPanel` with blocked-only field rendering, hint guidance, and keyboard-first controls (Enter apply, Escape close).
- Added correction payload helpers in schema and wired App orchestration to recompute blocked fields immediately on edits.
- Updated readiness surface to expose guided correction entry only when blocked fields exist and preserve non-color state communication.
- Extended capture regression tests for correction visibility, deterministic blocked-field shrinking, and save retry gating.

### File List
- app/src/App.tsx
- app/src/features/capture/schema.ts
- app/src/features/capture/components/CorrectionPanel.tsx
- app/src/features/capture/components/ReadinessStatus.tsx
- app/src/features/capture/capture.test.tsx
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/2-3-guided-correction-and-retry-flow.md

## Change Log
- 2026-05-14: Implemented guided correction panel, in-memory correction orchestration, readiness integration, and deterministic correction/retry regression tests for Story 2.3.
