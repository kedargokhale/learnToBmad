# Story 3.5: Capture Surface and Readiness State Components

Status: ready-for-dev

## Story

As a user,
I want capture components that clearly communicate save readiness,
so that I can move from paste to safe save with minimal confusion.

## Acceptance Criteria

1. Given the capture screen, when I paste or edit a transaction message, then TransactionInput and ReadinessStatus are available with consistent semantic states.
2. Given the capture screen, when I paste or edit a transaction message, then blocked, needs-review, ready, and duplicate states are visibly distinguishable.
3. Given parse and validation complete successfully, when I return focus to capture, then readiness state remains consistent and save action availability matches the current validation result.

## Tasks / Subtasks

- [ ] Align capture-surface state model with explicit readiness semantics (AC: 1, 2, 3)
  - [ ] Keep a single deterministic mapping from parse/save outcomes to UI readiness state labels.
  - [ ] Preserve current lifecycle states (`idle`, `validating`, `blocked`, `persisting`, `success`, `failed`) while adding clearer semantic presentation.
- [ ] Implement readiness-state communication components (AC: 1, 2)
  - [ ] Ensure TransactionInput and ReadinessStatus are always visible in the capture region once runtime is valid.
  - [ ] Add or refine reusable state indicators for blocked, needs-review, ready, and duplicate flows with icon + label + text (non-color-only communication).
- [ ] Keep correction and decision workflows integrated with readiness state (AC: 2, 3)
  - [ ] Ensure CorrectionPanel opens only for blocked fields and closes without state drift.
  - [ ] Preserve account-mismatch and duplicate-decision controls as gating decisions that clearly affect save availability.
- [ ] Enforce save availability consistency with current validation result (AC: 3)
  - [ ] Save action enablement must derive from the latest blocked-field and decision-gate state only.
  - [ ] Returning focus to capture must not reset or desynchronize readiness state.
- [ ] Add regression and accessibility coverage (AC: 1, 2, 3)
  - [ ] Expand tests for readiness rendering and save-enable/disable transitions after parse, correction, and decision changes.
  - [ ] Add assertions for non-color cues and keyboard flow continuity (Tab/Enter/Escape) across capture state transitions.

## Dev Notes

### Story Foundation

- Epic objective: make capture-state communication explicit and trustworthy so users can move quickly without unsafe saves.
- Business value: reduces confusion in the highest-frequency workflow and reinforces trust in deterministic validation gates.
- Dependencies:
  - Upstream: Story 2.5 deterministic save state machine and audit-safe save path.
  - Upstream: Story 1.2 corrected onboarding flow (dashboard-first, save-triggered account confirmation).
  - Adjacent: Story 3.1 category context and Story 3.3/3.4 dashboard work should not alter capture readiness semantics.

### Current State of Files Likely to be UPDATED

- app/src/App.tsx
  - Current state: central orchestrator for parse preview, correction map, save lifecycle, mismatch/duplicate decisions, and baseline refresh.
  - This story changes: tighten readiness communication wiring and keep save-action availability aligned with computed blocked/decision reasons.
  - Must preserve: desktop runtime guard, deferred account-confirmation behavior, refresh only after `acceptedForWrite`.

- app/src/features/capture/components/TransactionInput.tsx
  - Current state: paste-to-parse entry surface with parse action and save-validation trigger.
  - This story changes: refine capture-surface presentation and save-action semantics so visual/readiness cues match actual save eligibility.
  - Must preserve: auto-parse on paste, explicit parse action, deterministic disabled behavior when blocked.

- app/src/features/capture/components/ReadinessStatus.tsx
  - Current state: renders parse status, blocked reasons, lifecycle banners, and mismatch/duplicate controls.
  - This story changes: standardize and clarify semantic state communication for blocked, needs-review, ready, and duplicate flows.
  - Must preserve: guided correction entry point, non-color cues, lifecycle/status detail messaging.

- app/src/features/capture/components/CorrectionPanel.tsx
  - Current state: shows blocked fields only and supports keyboard-first apply/close behavior.
  - This story changes: ensure correction interactions consistently update readiness state without drift.
  - Must preserve: blocked-field scoping, Enter apply behavior, Escape close behavior.

- app/src/features/capture/schema.ts
  - Current state: owns readiness enums, blocked-field derivation, correction application, and save-gate decision schemas.
  - This story changes: remain the single source of truth for readiness semantics and label derivation.
  - Must preserve: deterministic blocked-field derivation and existing enum contracts unless explicitly versioned.

- app/src/features/capture/service.ts
  - Current state: typed parse and save command contracts over Tauri invoke.
  - This story changes: only adjust contract shapes if readiness-state payload requirements truly change.
  - Must preserve: command names, command envelope shape, and existing payload compatibility.

- app/src/features/capture/capture.test.tsx
  - Current state: broad deterministic tests for parse, readiness, correction, and save blocking rules.
  - This story changes: extend coverage for semantic-state consistency and focus-return save availability checks.
  - Must preserve: existing deterministic and blocked-save regression assertions.

- app/src/App.css
  - Current state: semantic banner styling, capture layout, keyboard focus visuals, and desktop-first responsive behavior.
  - This story changes: add or refine styles for readiness-state distinguishability and consistent semantic surfaces.
  - Must preserve: current visual language, focus visibility, and desktop-first baseline.

### Files that SHOULD remain unchanged unless strictly necessary

- app/src/features/capture/components/AccountMismatchResolver.tsx
- app/src/features/capture/components/DuplicateFlagIndicator.tsx

These components already provide explicit decision gates; prefer integrating through existing props/state before introducing parallel logic.

### Expected NEW Files (probable)

- app/src/features/capture/components/ValidationBadge.tsx (optional reusable primitive for semantic state)
- app/src/features/capture/components/ReadinessLegend.tsx (optional helper only if it reduces duplication)

Note: new files are optional. If existing components can support ACs cleanly, prefer incremental edits over structural churn.

### Architecture Compliance Guardrails

- Local-first invariant only: no network dependencies for capture readiness state.
- Keep typed frontend-to-Tauri boundary and standard `{ ok, data/error }` envelope.
- Readiness presentation must not mutate persisted data.
- Deterministic behavior is mandatory: same parse/save inputs must yield the same readiness and save-enabled state.
- Preserve validate-first gate discipline and no-silent-mutation behavior.

### UX Guardrails

- Keep progressive disclosure: compact readiness first, details on demand.
- Use non-color-only communication for all major states (icon + label + explanatory text).
- Keep action labels minimal and outcome-oriented.
- Maintain keyboard-first interaction patterns and visible focus states.
- Ensure blocked-save reasons remain explicit and actionable.

### Readiness-State Contract Guidance

Minimum semantic states that must be visibly distinguishable in capture surface:
- `ready`
- `needs-review`
- `blocked`
- `duplicate-flagged` (decision required or duplicate warning visible)

State derivation guidance:
- `ready` only when blocked fields are empty and required decisions are complete.
- `needs-review` when parse preview exists but at least one critical field is missing/ambiguous.
- `blocked` when save-gate conditions prevent persistence.
- `duplicate-flagged` when duplicate signal is present; save behavior must still follow explicit decision logic.

### Regression Risks to Prevent

- Do not regress Story 1.2 corrected onboarding path (no forced setup on first load).
- Do not permit save action when any critical field is unresolved or required decisions are unset.
- Do not desynchronize state between ReadinessStatus display and TransactionInput save button disabled logic.
- Do not reset readiness state unexpectedly when returning focus to capture fields.
- Do not break deterministic state transitions used by current save lifecycle messaging.

### Previous Story Intelligence

From Story 3.4 context and earlier Epic 2/3 implementation artifacts:
- Keep baseline refresh after committed write only.
- Preserve deterministic save-state semantics and audit-safe persistence behavior.
- Prefer incremental extension of existing capture module over broad restructuring.
- Keep explicit, concise, non-color cues in all state-critical messaging.

### Git Intelligence Summary

Recent commit patterns emphasize onboarding correction and deterministic flow preservation:
- 11b7a77 Merge branch Story_1-2_correction_course_implementation
- 096daf7 Implement Story 1.2 onboarding correction
- af86f57 Merge sprint_change_correct_course into main
- 17350a0 Correct-course updates for Story 1.2 and UX flow alignment
- be465b4 Commit changes

Most relevant recent file changes:
- app/src/App.tsx
- app/src/features/ledger/components/AccountSetupScreen.tsx
- app/src/features/ledger/ledger.test.tsx

Implication: story 3.5 must preserve corrected onboarding behavior while improving capture readiness communication.

### Latest Technical Information

- Current project versions (`app/package.json`): React 19.1.0, Zod 4.4.1, React Hook Form 7.74.0, Vitest 4.1.5, Tauri SQL plugin 2.4.0.
- Latest npm registry versions checked on 2026-05-20:
  - `react`: 19.2.6
  - `zod`: 4.4.3
  - `react-hook-form`: 7.76.0
  - `vitest`: 4.1.6
  - `@tauri-apps/plugin-sql`: 2.4.0
- Guidance for this story:
  - No dependency upgrade is required for Story 3.5.
  - Prefer existing React + Zod + Vitest patterns in capture module to avoid unrelated migration risk.

### Project Context Reference

- No `project-context.md` file discovered from configured persistent fact glob.

### References

- _bmad-output/planning-artifacts/epics.md (Epic 3, Story 3.5)
- _bmad-output/planning-artifacts/prd.md (FR10, FR11, FR13, FR14, FR25)
- _bmad-output/planning-artifacts/architecture.md (typed boundary, deterministic flows, local-first invariant)
- _bmad-output/planning-artifacts/ux-design-specification.md (capture surface, readiness communication, progressive disclosure, keyboard-first patterns)
- _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-19.md (onboarding correction guardrail)
- _bmad-output/implementation-artifacts/3-4-trend-alerts-and-running-balance-visualization.md
- _bmad-output/implementation-artifacts/3-3-category-and-merchant-insight-cards.md
- _bmad-output/implementation-artifacts/3-1-day-1-category-taxonomy-and-suggested-categorization.md
- _bmad-output/implementation-artifacts/2-5-deterministic-save-state-machine-and-audit-trail.md
- app/src/App.tsx
- app/src/App.css
- app/src/features/capture/components/TransactionInput.tsx
- app/src/features/capture/components/ReadinessStatus.tsx
- app/src/features/capture/components/CorrectionPanel.tsx
- app/src/features/capture/components/AccountMismatchResolver.tsx
- app/src/features/capture/components/DuplicateFlagIndicator.tsx
- app/src/features/capture/schema.ts
- app/src/features/capture/service.ts
- app/src/features/capture/capture.test.tsx
- app/package.json

## Story Completion Status

- Status set to: ready-for-dev
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Workflow configuration resolved through `_bmad/scripts/resolve_customization.py`.
- Sprint status, planning artifacts, UX and architecture documents, prior story artifacts, and current capture source files analyzed.
- Git history and latest package intelligence captured on 2026-05-20.

### Completion Notes List

- Story 3.5 context is aligned to current code reality (capture module-centric implementation; no non-existent CapturePanel dependency).
- Readiness-state semantics and save-enable consistency are defined as explicit non-regression requirements.
- Existing onboarding correction and deterministic save behavior are preserved as hard guardrails.

### File List

- _bmad-output/implementation-artifacts/3-5-capture-surface-and-readiness-state-components.md
