# Story 3.10: Capture Surface Declutter and Primary Action Simplification

Status: review

## Story

As a user,
I want a cleaner capture surface with concise action labels,
so that I can complete parse-to-save flow without cognitive overload.

## Acceptance Criteria

1. Given the capture screen, when I review primary actions, then the save action label is concise (Save) and repeated explanatory copy is reduced while preserving required safety guidance.
2. Given save is blocked or requires decisions, when guidance is shown, then reasons remain explicit and actionable and visual hierarchy emphasizes next action over repeated instructional text.

## Tasks / Subtasks

- [x] Simplify capture action hierarchy and labels (AC: 1)
  - [x] Change primary save action label to Save and align aria/accessibility text accordingly.
  - [x] Keep parse affordance clear while reducing duplicate explanatory phrasing.
- [x] Declutter repeated copy across capture/readiness surfaces (AC: 1, 2)
  - [x] Consolidate overlapping guidance between TransactionInput and ReadinessStatus.
  - [x] Keep one clear next-safe-action message in blocked or failed states.
- [x] Preserve deterministic validation and gating semantics (AC: 2)
  - [x] Ensure button labeling changes do not alter validate-first and gate-before-write behavior.
  - [x] Keep mismatch-resolution and duplicate-decision requirements explicit and visible.
- [x] Tune visual hierarchy for next actions (AC: 2)
  - [x] Promote immediate next action controls over long instructional paragraphs.
  - [x] Keep progressive disclosure behavior (compact default, detail on demand).
- [x] Add regression and accessibility coverage (AC: 1, 2)
  - [x] Extend capture tests for Save label, reduced duplicate copy, and explicit blocked reasons.
  - [x] Verify keyboard-first flow and live-region confirmations still behave as intended.

## Dev Notes

### Story Foundation

- Epic objective: reduce cognitive load in the highest-frequency capture flow without weakening safety gates.
- Business value: faster comprehension and lower friction while preserving trust-critical validation behavior.
- Change trigger context: approved course correction on 2026-05-25 explicitly requires concise Save primary action and capture-surface declutter.
- Dependencies:
  - Upstream: Story 3.5 readiness semantics.
  - Upstream: Story 3.8 progressive disclosure and non-modal confirmation patterns.
  - Adjacent: Story 3.9 scope clarity work should not regress capture semantics.

### Current State of Files Likely to be UPDATED

- app/src/features/capture/components/TransactionInput.tsx
  - Current state: parse button plus secondary action labeled Run save validation, with verbose repeated explanatory copy in caption and hints.
  - This story changes: rename save action label to Save and remove redundant copy while retaining explicit blocked-reason visibility.
  - Must preserve: paste-triggered parse, manual parse option, save disabled behavior when blocked, and validate-first semantics.

- app/src/features/capture/components/ReadinessStatus.tsx
  - Current state: robust guidance and progressive details with several overlapping explanatory blocks.
  - This story changes: trim repeated prose and emphasize concise next-safe-action guidance.
  - Must preserve: semantic readiness states, mismatch and duplicate gate visibility, and friendly actionable tone.

- app/src/App.css
  - Current state: layout and component styling supports rich copy surfaces and existing button hierarchy.
  - This story changes: adjust visual hierarchy for decluttered capture UI and primary-action prominence.
  - Must preserve: visible focus states, non-color cues, desktop-first layout responsiveness.

- app/src/App.tsx
  - Current state: orchestrates save lifecycle and capture confirmation copy.
  - This story changes: keep confirmation and lifecycle messages concise where they currently duplicate information shown elsewhere.
  - Must preserve: runtime guard, deterministic save transitions, baseline refresh only after committed write.

- app/src/features/capture/capture.test.tsx
  - Current state: extensive readiness and save-flow regression coverage anchored to older label/copy patterns.
  - This story changes: update assertions for Save label and decluttered guidance while preserving behavior checks.
  - Must preserve: deterministic parse/save behavior and gate-enforcement test intent.

### Files that SHOULD remain unchanged unless strictly necessary

- app/src/features/capture/components/AccountMismatchResolver.tsx
- app/src/features/capture/components/DuplicateFlagIndicator.tsx
- app/src/features/ledger/components/LedgerBaselineView.tsx

Avoid unrelated ledger/dashboard changes in this UI-focused declutter story.

### Expected NEW Files (probable)

None required.

Optional only if it centralizes message text without over-abstracting:

- app/src/features/capture/copy.ts

### Architecture Compliance Guardrails

- Keep local-first behavior and typed Tauri command boundary unchanged.
- Keep save flow deterministic and validate-first; labeling is UX-only, not behavioral.
- Keep readiness and save-button availability derived from the same blocked/decision signals.
- No silent mutation or implicit write paths introduced by UI simplification.

### UX Guardrails

- Primary action text is Save.
- Remove duplicate explanatory text while preserving explicit safety guidance.
- Maintain progressive disclosure: compact by default, details when needed.
- Keep blocked reasons explicit, specific, and actionable.
- Preserve friendly copy tone and non-color state communication.

### Current Behavior Notes That Matter for Implementation

- TransactionInput currently uses Run save validation label and repeats validate-first explanation in multiple places.
- ReadinessStatus already contains rich actionable state cues; declutter should prioritize this as canonical guidance instead of duplicating in input panel.
- Save button disabled logic currently aligns with saveBlockedReasons and isSaving; this must remain unchanged.
- Existing success toast behavior is non-modal and auto-clearing; keep intact.

### Regression Risks to Prevent

- Do not turn Save label change into semantic flow change that bypasses validation gates.
- Do not remove blocked-reason visibility when trimming copy.
- Do not hide mismatch/duplicate decisions behind minimal copy changes.
- Do not regress keyboard behavior (Enter, Escape, Tab) and focus visibility.
- Do not regress live-region confirmations for save/correction completion.

### Previous Story Intelligence

From Story 3.8 and 3.5:

- Keep progressive disclosure and non-disruptive confirmation patterns.
- Keep readiness semantics and save button gating in sync.
- Preserve explicit decision gates for account mismatch and duplicate handling.
- Favor incremental edits over broad component rewrites.

### Git Intelligence Summary

Recent commits show capture/readiness flow has just been stabilized and must not regress:

- 7de31f0 Update sprint artifacts and add change proposal
- be409f3 Merge branch story-3-8
- 3edbbf2 Implement story 3.8 progressive disclosure and confirmation feedback
- e4e7304 Merge branch story-3-7 into main
- d0272e5 Implement story 3-7 insight summary components and ledger updates

Implication: declutter changes should be copy and hierarchy focused with strong regression coverage.

### Latest Technical Information

- Current project versions from app/package.json:
  - react: 19.1.0
  - zod: 4.4.1
  - react-hook-form: 7.74.0
  - vitest: 4.1.5
  - @tauri-apps/plugin-sql: 2.4.0
- Latest npm registry versions checked on 2026-05-25:
  - react: 19.2.6
  - zod: 4.4.3
  - react-hook-form: 7.76.1
  - vitest: 4.1.7
  - @tauri-apps/plugin-sql: 2.4.0
- Guidance for this story:
  - No dependency upgrades required.
  - Use current UI stack and test harness patterns already present in capture module.

### Project Context Reference

- No project-context.md file was discovered from the configured persistent fact glob.

### References

- _bmad-output/planning-artifacts/epics.md (Epic 3, Story 3.10)
- _bmad-output/planning-artifacts/prd.md (FR10, FR11, FR13, FR14, FR25)
- _bmad-output/planning-artifacts/architecture.md (typed boundary, deterministic command flow, local-first)
- _bmad-output/planning-artifacts/ux-design-specification.md (primary action minimal text, progressive disclosure, friendly actionable guidance)
- _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-25.md
- _bmad-output/implementation-artifacts/3-8-progressive-disclosure-and-confirmation-feedback.md
- _bmad-output/implementation-artifacts/3-5-capture-surface-and-readiness-state-components.md
- app/src/App.tsx
- app/src/App.css
- app/src/features/capture/components/TransactionInput.tsx
- app/src/features/capture/components/ReadinessStatus.tsx
- app/src/features/capture/components/CorrectionPanel.tsx
- app/src/features/capture/components/AccountMismatchResolver.tsx
- app/src/features/capture/components/DuplicateFlagIndicator.tsx
- app/src/features/capture/components/SaveConfirmationToast.tsx
- app/src/features/capture/capture.test.tsx
- app/package.json

## Story Completion Status

- Status set to: review
- Completion note: Story implementation completed with Save label simplification, capture/readiness copy declutter, and full regression verification.

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Workflow resolved through _bmad/scripts/resolve_customization.py for bmad-create-story.
- Sprint status, epics, PRD, architecture, UX, and course-correction artifacts analyzed.
- Story 3.5 and 3.8 artifacts reviewed for prior learnings and regression guardrails.
- Current capture component code and tests read to map exact update boundaries.
- Latest npm package versions checked on 2026-05-25.
- Workflow resolved through _bmad/scripts/resolve_customization.py for bmad-dev-story workflow activation.
- Updated sprint status to in-progress at start, then review after completion.
- Red phase: updated capture tests to require concise Save label and no duplicate save-guidance copy; confirmed failures before implementation.
- Green/refactor phase: updated capture UI copy and hierarchy while preserving blocked reasons and decision gates.
- Full validations executed: pnpm test (53/53 passing) and pnpm build (successful).

### Completion Notes List

- Captured Save label simplification and declutter goals without compromising validation safety requirements.
- Documented exact capture files to update and preservation constraints.
- Embedded explicit anti-regression rules for mismatch/duplicate gates and keyboard/accessibility behavior.
- Added focused test guidance to validate copy/hierarchy changes without behavior drift.
- Implemented Save as the primary capture action with aligned aria labeling and preserved disable/gating semantics.
- Reduced duplicate validation prose in capture/readiness surfaces while keeping explicit blocked reasons and next-safe-action language.
- Kept progressive disclosure behavior intact and tuned action prominence by de-emphasizing long instruction caption text.
- Added/updated regression coverage in capture and ledger suites for Save label and updated confirmation copy.

### File List

- _bmad-output/implementation-artifacts/3-10-capture-surface-declutter-and-primary-action-simplification.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- app/src/features/capture/components/TransactionInput.tsx
- app/src/features/capture/components/ReadinessStatus.tsx
- app/src/App.tsx
- app/src/App.css
- app/src/features/capture/capture.test.tsx
- app/src/features/ledger/ledger.test.tsx

## Change Log

- 2026-05-25: Created story context for 3.10 with capture-surface declutter and primary-action simplification guardrails.
- 2026-05-26: Implemented story 3.10 - Save primary action label, capture/readiness copy declutter, visual hierarchy tuning, and regression updates with full test/build validation.
