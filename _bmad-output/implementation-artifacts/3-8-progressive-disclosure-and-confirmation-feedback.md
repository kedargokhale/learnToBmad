# Story 3.8: Progressive Disclosure and Confirmation Feedback

Status: ready-for-dev

## Story

As a user,
I want validation detail and confirmations to appear only when needed,
so that I can stay focused while still recovering quickly from issues.

## Acceptance Criteria

1. Given parse and validation have completed, when no issues are present, then the interface remains compact with a clear ready-to-save signal and detailed guidance is hidden by default.
2. Given a save or correction completes successfully, when the operation finishes, then the UI shows immediate non-disruptive success confirmation and does not require modal acknowledgment to continue.
3. Given validation fails, when guidance is shown, then error copy is friendly and actionable and each message states the next safe user action.

## Tasks / Subtasks

- [ ] Implement compact-by-default readiness presentation (AC: 1, 3)
  - [ ] Refactor the readiness surface so the always-visible layer shows only the current semantic state, key signal, and required action.
  - [ ] Hide detailed field-by-field guidance behind explicit expansion, focus, or issue-triggered disclosure rather than rendering the full breakdown at all times.
- [ ] Add non-disruptive success confirmation patterns (AC: 2)
  - [ ] Show lightweight success feedback after save and after correction completion using a toast or inline live-region surface.
  - [ ] Ensure confirmation clears automatically or remains unobtrusive without trapping focus or requiring dismissal.
- [ ] Rewrite validation and guidance copy to be friendly and actionable (AC: 3)
  - [ ] Ensure each blocked or failed state explains the next safe action in plain language.
  - [ ] Preserve explicit account-mismatch and duplicate-decision guidance when those gates are active.
- [ ] Keep progressive disclosure keyboard-first and deterministic (AC: 1, 2, 3)
  - [ ] Support Enter, Escape, Tab, and screen-reader announcement flows for expand/collapse and confirmation states.
  - [ ] Keep save-enable/disable behavior derived from the same source of truth already used by capture state logic.
- [ ] Add regression and accessibility coverage (AC: 1, 2, 3)
  - [ ] Extend capture tests for compact-ready state, expansion behavior, friendly error copy, and save/correction confirmation visibility.
  - [ ] Extend app-flow tests for non-modal save confirmation and no regression in save-triggered account setup.
  - [ ] Keep existing readiness-state, onboarding-correction, and deterministic save-state tests green.

## Dev Notes

### Story Foundation

- Epic objective: reduce cognitive load in the highest-frequency workflow while preserving trust and recovery clarity.
- Business value: the product feels calmer and faster without weakening the deterministic validation gates that protect ledger integrity.
- Dependencies:
  - Upstream: Story 3.5 capture/readiness state components.
  - Adjacent: Story 3.6 correction and confidence guidance components.
  - Upstream: Story 2.5 deterministic save-state machine and audit trail.
  - Upstream: Story 1.2 save-triggered onboarding correction.

### Current State of Files Likely to be UPDATED

- app/src/App.tsx
  - Current state: owns parse/save state, correction visibility, account-setup prompt, and post-save baseline refresh.
  - This story changes: coordinate non-modal confirmation state and keep compact readiness behavior consistent across parse, correction, and save.
  - Must preserve: runtime guard, deferred account confirmation, and refresh only after successful persisted write.

- app/src/features/capture/components/ReadinessStatus.tsx
  - Current state: always renders readiness banner plus a full parsed-field list and expanded save error details.
  - This story changes: make the default state compact, disclose detail only when needed, and improve message tone.
  - Must preserve: explicit mismatch and duplicate decision flows, non-color cues, and lifecycle-state messaging.

- app/src/features/capture/components/TransactionInput.tsx
  - Current state: shows parse and save buttons plus a full blocked-reasons list when saving is unavailable.
  - This story changes: align the visible ready-to-save signal and confirmation behavior with the compact-progressive-disclosure UX.
  - Must preserve: auto-parse on paste, disabled save behavior when blocked, and validate-first save semantics even if button text changes.

- app/src/features/capture/components/CorrectionPanel.tsx
  - Current state: renders blocked fields only and updates correction state as the user types.
  - This story changes: participate in progressive disclosure and emit a lightweight correction-complete confirmation.
  - Must preserve: blocked-field scoping, Enter apply behavior, Escape close behavior, and current keyboard-first flow unless intentionally versioned.

- app/src/features/capture/schema.ts
  - Current state: contains readiness enums, blocked-field derivation, copy helpers, and save-gate decision schemas.
  - This story changes: remain the single source of truth for semantic-state labels and any new disclosure-state labels or confirmation metadata.
  - Must preserve: deterministic readiness derivation and current enum contracts unless explicitly migrated.

- app/src/App.css
  - Current state: contains visual treatments for banners, blocked reasons, capture layout, and focus indicators.
  - This story changes: add compact readiness, disclosure, and toast/confirmation styling.
  - Must preserve: visible focus treatment, desktop-first layout, and the current visual language.

- app/src/features/capture/capture.test.tsx
  - Current state: validates parse guidance, readiness semantics, save blocking, and correction flows.
  - This story changes: add assertions for compact-by-default rendering, disclosure toggles, confirmation feedback, and improved copy.
  - Must preserve: existing deterministic readiness and blocked-save regressions.

- app/src/features/ledger/ledger.test.tsx
  - Current state: validates app-shell behavior around baseline loading and save-triggered account setup.
  - This story changes: add app-level confirmation assertions without regressing the account-confirmation flow.
  - Must preserve: dashboard-first first-run behavior and no forced setup on app load.

### Files that SHOULD remain unchanged unless strictly necessary

- app/src/features/capture/components/AccountMismatchResolver.tsx
- app/src/features/capture/components/DuplicateFlagIndicator.tsx

Prefer improving the surrounding readiness and message composition before changing these decision-gate components.

### Expected NEW Files (probable)

- app/src/features/capture/components/ValidationBadge.tsx
- app/src/features/capture/components/SaveConfirmationToast.tsx

Optional only if it reduces duplication cleanly:

- app/src/features/capture/components/DisclosureSection.tsx

Use new files only when they simplify the progressive-disclosure implementation. Do not scatter confirmation state across multiple unrelated components.

### Architecture Compliance Guardrails

- Local-first only: no network dependencies for validation, disclosure, or confirmation feedback.
- Keep the existing typed frontend-to-Tauri command boundary and `{ ok, data/error }` envelope untouched.
- UI compaction must not change save semantics; `attempt_transaction_save` still validates first and persists only after all gates pass.
- Keep readiness presentation and save button availability derived from the same blocked/dependency signals to avoid drift.
- Preserve deterministic behavior: the same parse/save inputs should produce the same visible readiness and confirmation states.

### UX Guardrails

- Follow the UX spec's progressive disclosure stages: compact readiness first, detailed explanation on issue/focus, and field-specific guidance only where needed.
- Use friendly, non-technical copy with a clear next action for every error or blocked state.
- Show non-disruptive confirmation for save and correction completion; no modal or blocking overlay.
- Keep action labels minimal and outcome-oriented. If the visible button label becomes `Save`, preserve validate-first behavior under the hood.
- Maintain non-color communication using icon, label, and explanatory text.

### Current Behavior Notes That Matter for Implementation

- `ReadinessStatus` currently shows the parsed critical-field list for every successful preview. This story should make that information collapsible or contextual, not remove diagnostic access entirely.
- `TransactionInput` currently disables the save action when `saveBlockedReasons.length > 0` and mirrors that via `aria-disabled`; this must stay synchronized with the readiness surface.
- `CorrectionPanel` currently writes correction values into the in-memory correction map as the user types, and Apply/Close primarily control visibility. If you change this to draft-and-commit semantics, scope that change explicitly and update tests; do not alter behavior accidentally while adding progressive disclosure.

### Confirmation and Messaging Guidance

Minimum confirmation behaviors:

- Save success: brief non-modal confirmation in a live region, ideally 2-3 seconds, with optional dashboard/insight follow-up text.
- Correction completion: immediate lightweight confirmation through state change and/or toast, without requiring any additional click.
- Failed validation: message names the problem and the next safe action, not just the internal reason.

Prefer messages in the tone already specified by UX examples:

- "What merchant was this for?" rather than raw schema-language error text.
- "Choose whether to save as new or skip this duplicate" rather than a generic duplicate failure.
- "Review the account mismatch before saving" rather than a vague blocked status.

### Regression Risks to Prevent

- Do not hide required mismatch-resolution or duplicate-decision controls behind collapsed UI with no visible cue.
- Do not introduce modal confirmation or force the user to acknowledge success before continuing.
- Do not desynchronize `ReadinessStatus` and `TransactionInput` save-enable logic.
- Do not accidentally clear the pasted message or correction context before the user finishes the flow.
- Do not break screen-reader announcements when adding auto-dismissing confirmation UI.

### Previous Story Intelligence

From Stories 3.5, 3.4, and Epic 2 artifacts:

- Preserve deterministic save-state transitions (`idle -> validating -> persisting -> success/failed`).
- Keep baseline refresh after committed write only.
- Favor incremental extension of existing capture components over broad restructuring.
- Maintain explicit non-color cues and keyboard-first interaction throughout the capture workflow.

### Git Intelligence Summary

Recent commit history still centers on onboarding correction and UX flow alignment:

- 11b7a77 Merge branch 'Story_1-2_correction_course_implementation'
- 096daf7 Implement Story 1.2 onboarding correction
- af86f57 Merge sprint_change_correct_course into main
- 17350a0 Correct-course updates for Story 1.2 and UX flow alignment
- be465b4 Commit changes

Implication: progressive-disclosure work must not regress dashboard-first first launch or reintroduce setup-first behavior.

### Latest Technical Information

- Current project versions (`app/package.json`): React 19.1.0, Zod 4.4.1, React Hook Form 7.74.0, Vitest 4.1.5, Tauri SQL plugin 2.4.0.
- Latest npm registry versions checked on 2026-05-20:
  - `react`: 19.2.6
  - `zod`: 4.4.3
  - `react-hook-form`: 7.76.0
  - `vitest`: 4.1.6
  - `@tauri-apps/plugin-sql`: 2.4.0
- Guidance for this story:
  - No dependency upgrade is required for Story 3.8.
  - Prefer a local confirmation component over adding a third-party toast library unless the current implementation proves insufficient.

### Project Context Reference

- No `project-context.md` file was discovered from the configured persistent fact glob.

### References

- _bmad-output/planning-artifacts/epics.md (Epic 3, Story 3.8)
- _bmad-output/planning-artifacts/prd.md (FR11, FR13, FR14, FR25)
- _bmad-output/planning-artifacts/architecture.md (typed command boundary, deterministic state flows, local-first constraint)
- _bmad-output/planning-artifacts/ux-design-specification.md (progressive disclosure stages, friendly copy, non-modal confirmation, empty-state patterns)
- _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-19.md (dashboard-first onboarding guardrail)
- _bmad-output/implementation-artifacts/3-5-capture-surface-and-readiness-state-components.md
- _bmad-output/implementation-artifacts/3-4-trend-alerts-and-running-balance-visualization.md
- _bmad-output/implementation-artifacts/2-5-deterministic-save-state-machine-and-audit-trail.md
- _bmad-output/implementation-artifacts/1-2-create-account-and-opening-balance-setup.md
- app/src/App.tsx
- app/src/App.css
- app/src/features/capture/components/ReadinessStatus.tsx
- app/src/features/capture/components/TransactionInput.tsx
- app/src/features/capture/components/CorrectionPanel.tsx
- app/src/features/capture/components/AccountMismatchResolver.tsx
- app/src/features/capture/components/DuplicateFlagIndicator.tsx
- app/src/features/capture/schema.ts
- app/src/features/capture/capture.test.tsx
- app/src/features/ledger/ledger.test.tsx
- app/package.json

## Story Completion Status

- Status set to: ready-for-dev
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- Workflow configuration resolved through `_bmad/scripts/resolve_customization.py`.
- Sprint status, planning artifacts, UX and architecture documents, prior story artifacts, and current capture source files analyzed.
- Package registry versions checked on 2026-05-20 for React, Zod, React Hook Form, Vitest, and Tauri SQL plugin.

### Completion Notes List

- Story 3.8 is anchored to the current capture implementation, including the always-expanded readiness surface and live in-memory correction behavior.
- Progressive disclosure is scoped as a UI-behavior improvement, not a rewrite of save semantics.
- Friendly copy, lightweight confirmation, and no-regression requirements for onboarding and save gating are explicit.

### File List

- _bmad-output/implementation-artifacts/3-8-progressive-disclosure-and-confirmation-feedback.md