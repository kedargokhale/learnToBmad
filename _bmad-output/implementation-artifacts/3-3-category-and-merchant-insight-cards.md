# Story 3.3: Category and Merchant Insight Cards

Status: ready-for-dev

## Story

As a user,
I want clear category and merchant insight cards,
so that I can quickly understand where money is going.

## Acceptance Criteria

1. Given saved categorized transactions exist, when I view the dashboard, then category dominance and merchant focus cards render current period insights.
2. Given new transactions are saved, when dashboard data refresh runs, then insight card content updates deterministically from persisted data.

## Tasks / Subtasks

- [ ] Define dashboard insight contracts at the command boundary (AC: 1, 2)
  - [ ] Extend baseline/dashboard response shape to include category and merchant aggregates for current preset window.
  - [ ] Keep typed command envelope and deterministic field naming (`camelCase` to frontend).
- [ ] Implement backend category and merchant aggregation queries (AC: 1, 2)
  - [ ] Add read-only SQL aggregation for category totals and share percentage.
  - [ ] Add read-only SQL aggregation for top merchants with frequency and amount.
  - [ ] Ensure both queries are scoped to persisted rows only and are deterministic for identical inputs.
- [ ] Build UI story cards for insight rendering (AC: 1)
  - [ ] Add reusable story-card component primitive for compact insight presentation.
  - [ ] Add category dominance card and merchant focus card layouts with deterministic empty states.
  - [ ] Keep non-color cues (labels/icons/text) aligned to UX accessibility guidance.
- [ ] Integrate insight cards into current dashboard surface (AC: 1, 2)
  - [ ] Render cards in existing ledger/dashboard section without breaking capture flow.
  - [ ] Refresh insight values only after committed save path baseline refresh.
- [ ] Add regression coverage (AC: 1, 2)
  - [ ] Rust tests for aggregate correctness, deterministic ordering, and no-account empty states.
  - [ ] Frontend tests for card rendering, empty states, and post-save refresh behavior.
  - [ ] Keep Story 2.x deterministic save and Story 1.2 deferred onboarding tests green.

## Dev Notes

### Story Foundation

- Epic objective: transform categorized data into immediately useful spending visibility.
- Business value: first concrete dashboard payoff after capture and categorization groundwork.
- Dependencies:
  - Upstream: Story 3.1 category assignment metadata and Story 2.5 deterministic save/refresh behavior.
  - Parallel/adjacent: Story 3.2 learning quality can improve suggestions, but this story must work with existing category assignments.

### Current State of Files Likely to be UPDATED

- app/src/App.tsx
  - Current state: orchestrates parse/correction/save and renders baseline ledger view.
  - This story changes: integrate insight cards into main dashboard surface after baseline data load.
  - Must preserve: desktop runtime guard, save lifecycle transitions, baseline refresh only after `acceptedForWrite`.

- app/src/features/ledger/service.ts
  - Current state: fetches baseline with account + ordered entries.
  - This story changes: extend response typing for category and merchant insight payloads.
  - Must preserve: command envelope shape and existing call semantics.

- app/src/features/ledger/schema.ts
  - Current state: validates account and entry baseline schema only.
  - This story changes: add insight schemas and deterministic sort expectations in view models.
  - Must preserve: existing schema contracts used by current ledger rendering/tests.

- app/src/features/ledger/components/LedgerBaselineView.tsx
  - Current state: renders hero plus transaction history list.
  - This story changes: host InsightSummary region with category and merchant cards.
  - Must preserve: existing account summary and deterministic history display behavior.

- app/src-tauri/src/commands/ledger.rs
  - Current state: returns account summary, unified entry history, deterministic ordering.
  - This story changes: include computed category and merchant insight arrays in the baseline/dashboard response.
  - Must preserve: no mutation in read commands, stable ordering (`created_at DESC, id DESC`) for history, and empty baseline behavior.

- app/src/features/ledger/ledger.test.tsx
  - Current state: validates account setup and baseline rendering flows.
  - This story changes: add card rendering and refresh assertions.
  - Must preserve: onboarding correction behavior and runtime-guard regressions.

### Expected NEW Files (probable)

- app/src/features/dashboard/components/StoryCard.tsx
- app/src/features/dashboard/components/InsightSummary.tsx
- app/src/features/dashboard/schema.ts
- app/src/features/dashboard/dashboard.test.tsx

### Architecture Compliance Guardrails

- Local-first invariant only: no external API calls, no cloud-derived insights.
- Keep frontend-native typed boundary and standard `{ ok, data/error }` command envelope.
- Read-model only for this story: do not mutate capture/account records in insight retrieval.
- Deterministic aggregation required for identical persisted dataset and time preset.
- Preserve no-silent-mutation guarantees from Epic 2.

### UX Guardrails

- Render insights as compact story cards (category dominance, merchant focus) with clear headings.
- Provide deterministic empty states when no eligible transactions exist.
- Keep copy actionable and concise; no modal interruption for normal dashboard viewing.
- Preserve keyboard navigability and visible focus states for any interactive card controls.
- Ensure non-color-only communication in state badges and labels.

### Data Contract and Aggregation Requirements

- Category Dominance card minimum payload:
  - `categoryName`, `totalAmountMinor`, `sharePercent`, `transactionCount`
- Merchant Focus card minimum payload:
  - `merchantOrPayee`, `totalAmountMinor`, `transactionCount`, optional `lastSeenDate`
- Aggregation scope:
  - Current period preset used by dashboard baseline (no custom range in this story).
  - Use persisted transaction records only; exclude failed/blocked save attempts.
- Deterministic ordering:
  - Category card rows sorted by `totalAmountMinor DESC`, then name asc tiebreak.
  - Merchant card rows sorted by `totalAmountMinor DESC`, then `transactionCount DESC`, then name asc.

### Regression Risks to Prevent

- Do not break save-triggered deferred account confirmation behavior from Story 1.2 correction.
- Do not refresh cards on failed saves or validation-only blocked paths.
- Do not alter existing ledger entry sign handling (`debit` negative, `credit` positive) used in balance math.
- Do not introduce UI assumptions that require mobile-first behavior; MVP remains desktop-first.

### Previous Story Intelligence

From Story 3.1 context and Story 2.5 completion:
- Preserve deterministic state machine semantics (`idle -> validating -> persisting -> success/failed`).
- Keep audit-first mindset: no hidden writes from read surfaces.
- Keep incremental structure strategy: current repo is not yet fully split into all architecture target modules, so introduce dashboard files without destabilizing capture/ledger paths.
- Keep explicit blocked/empty guidance and non-color cues in status communication.

### Git Intelligence Summary

Recent commits show emphasis on onboarding flow correctness and deterministic behavior:
- 11b7a77 Merge branch Story_1-2_correction_course_implementation
- 096daf7 Implement Story 1.2 onboarding correction
- af86f57 Merge sprint_change_correct_course into main
- 17350a0 Correct-course updates for Story 1.2 and UX flow alignment
- be465b4 Commit changes

Implication: do not regress save-triggered onboarding and deterministic refresh semantics while adding dashboard cards.

### Latest Technical Information

- Current project versions (`app/package.json`): React 19.1.0, Zod 4.4.1, React Hook Form 7.74.0, Vitest 4.1.5, Tauri SQL plugin 2.4.0.
- Latest npm registry versions checked on 2026-05-20:
  - `react`: 19.2.6
  - `zod`: 4.4.3
  - `react-hook-form`: 7.76.0
  - `vitest`: 4.1.6
  - `@tauri-apps/plugin-sql`: 2.4.0
- Guidance for this story:
  - No dependency upgrades required for Story 3.3; stay on current locked versions to avoid unrelated migration risk.
  - Use existing React 19 and Zod 4 patterns already present in capture and ledger modules.

### Project Context Reference

- No `project-context.md` file discovered from configured persistent fact glob.

### References

- _bmad-output/planning-artifacts/epics.md (Epic 3, Story 3.3)
- _bmad-output/planning-artifacts/prd.md (FR19, FR20, FR21, FR24, FR25)
- _bmad-output/planning-artifacts/architecture.md (typed command boundary, deterministic behavior, local-first rules)
- _bmad-output/planning-artifacts/ux-design-specification.md (insight-first cards, progressive disclosure, accessibility cues)
- _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-19.md (onboarding flow guardrail)
- _bmad-output/implementation-artifacts/3-1-day-1-category-taxonomy-and-suggested-categorization.md
- _bmad-output/implementation-artifacts/2-5-deterministic-save-state-machine-and-audit-trail.md
- app/src/App.tsx
- app/src/features/ledger/service.ts
- app/src/features/ledger/schema.ts
- app/src/features/ledger/components/LedgerBaselineView.tsx
- app/src/features/ledger/ledger.test.tsx
- app/src-tauri/src/commands/ledger.rs
- app/src-tauri/src/commands/capture.rs
- app/src-tauri/src/db/ledger.rs
- app/package.json

## Story Completion Status

- Status set to: ready-for-dev
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Workflow configuration resolved through `_bmad/scripts/resolve_customization.py`.
- Sprint status, planning artifacts, architecture, UX, and prior implementation artifacts analyzed.
- Current codebase update targets reviewed in frontend and Rust command layers.

### Completion Notes List

- Story 3.3 context includes concrete update-file guardrails and deterministic aggregation requirements.
- Cross-story regression constraints (Story 1.2 correction and Story 2.5 deterministic save behavior) are explicitly preserved.
- Latest package-version intelligence included without forcing unnecessary dependency upgrades.

### File List

- _bmad-output/implementation-artifacts/3-3-category-and-merchant-insight-cards.md
