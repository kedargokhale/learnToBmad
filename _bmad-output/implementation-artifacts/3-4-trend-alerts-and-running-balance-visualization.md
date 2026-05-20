# Story 3.4: Trend Alerts and Running Balance Visualization

Status: ready-for-dev

## Story

As a user,
I want trend alerts and running balance visualization,
so that I can monitor spending changes and financial trajectory.

## Acceptance Criteria

1. Given historical transactions across time windows, when I open dashboard trends, then trend alert logic compares against baseline and flags significant changes.
2. Given historical transactions across time windows, when I open dashboard trends, then running balance trend is displayed correctly for selected preset windows.

## Tasks / Subtasks

- [ ] Define trend and running-balance contracts at the command boundary (AC: 1, 2)
  - [ ] Extend ledger baseline response to include trend alert summary and running-balance points for the active preset window.
  - [ ] Keep typed command envelope and deterministic field naming (`camelCase` in frontend payloads).
- [ ] Implement backend trend alert aggregation (AC: 1)
  - [ ] Add read-only SQL aggregation to compare current window spend against moving baseline.
  - [ ] Return explicit threshold metadata and explainable alert reason fields.
  - [ ] Keep deterministic outcomes for identical persisted data and identical preset window.
- [ ] Implement backend running-balance series generation (AC: 2)
  - [ ] Produce ordered balance points using persisted entries plus capture transactions with debit negative and credit positive handling.
  - [ ] Ensure stable ordering and no hidden mutation.
- [ ] Build dashboard trend visualization UI (AC: 1, 2)
  - [ ] Add trend alert card and running-balance visualization region with deterministic empty states.
  - [ ] Keep non-color communication (labels/icons/text) for alert severity and readiness.
- [ ] Integrate trends into existing dashboard surface (AC: 1, 2)
  - [ ] Render trend regions in ledger/dashboard area without breaking capture and account-confirmation flow.
  - [ ] Refresh trend data only after committed save path baseline refresh.
- [ ] Add regression coverage (AC: 1, 2)
  - [ ] Rust tests for trend-threshold determinism, baseline comparison correctness, and stable running-balance ordering.
  - [ ] Frontend tests for trend alert rendering, running-balance chart/list rendering, and post-save refresh behavior.
  - [ ] Preserve Story 1.2 deferred account-confirmation behavior and Story 2.5 deterministic save-state semantics.

## Dev Notes

### Story Foundation

- Epic objective: provide explainable spending movement visibility beyond category/merchant snapshots.
- Business value: this story delivers change-detection and trajectory visibility, enabling users to react earlier to spend drift.
- Dependencies:
  - Upstream: Story 2.5 deterministic save/refresh and ledger consistency behavior.
  - Upstream: Story 3.1 category-ready data model (trend calculations should work with existing persisted transaction records).
  - Adjacent: Story 3.3 card layout patterns are a visual and structural reference, but Story 3.4 must remain implementable even if 3.3 was only contexted.

### Current State of Files Likely to be UPDATED

- app/src/App.tsx
  - Current state: orchestrates parse/correction/save, refreshes baseline only when `acceptedForWrite` is true, preserves deferred account confirmation flow.
  - This story changes: consume and display trend/running-balance payloads in dashboard section.
  - Must preserve: runtime guard, save lifecycle transitions, and no refresh on failed save.

- app/src/features/ledger/service.ts
  - Current state: typed contract includes account + entries + ordering.
  - This story changes: extend response types with trend alert and running-balance fields.
  - Must preserve: command envelope typing and existing call semantics.

- app/src/features/ledger/schema.ts
  - Current state: validates baseline account and entries only.
  - This story changes: add schemas for trend alert payload and running-balance points.
  - Must preserve: existing account/entry schema compatibility and parse strictness.

- app/src/features/ledger/components/LedgerBaselineView.tsx
  - Current state: renders account baseline hero and deterministic transaction history list.
  - This story changes: host trend alert region and running-balance visualization in the existing dashboard area.
  - Must preserve: account summary visibility, history ordering display, and refresh button behavior.

- app/src/App.css
  - Current state: desktop-first two-column styling and semantic state surfaces.
  - This story changes: add styles for trend card and running-balance visualization states.
  - Must preserve: established visual language, focus visibility, and desktop-first baseline.

- app/src-tauri/src/commands/ledger.rs
  - Current state: computes current balance and ordered combined entries, returns `LedgerBaselineResponse`.
  - This story changes: compute and include trend alert summary + running-balance timeline data.
  - Must preserve: read-only behavior, deterministic ordering (`created_at DESC, id DESC` for history), empty baseline semantics.

- app/src/features/ledger/ledger.test.tsx
  - Current state: validates baseline loading paths, deferred account confirmation behavior, and desktop runtime guard.
  - This story changes: add assertions for trend/running-balance rendering and refresh behavior.
  - Must preserve: all onboarding correction and runtime-guard regressions.

### Files that MAY be UPDATED depending on implementation choice

- app/src-tauri/src/db/ledger.rs
  - Update only if a new migration is strictly required for trend performance or persisted pre-aggregation.
  - Prefer query-only implementation first to avoid unnecessary schema churn.

### Expected NEW Files (probable)

- app/src/features/dashboard/components/TrendAlertCard.tsx
- app/src/features/dashboard/components/RunningBalanceView.tsx
- app/src/features/dashboard/components/InsightSummary.tsx (if dashboard surface is consolidated)
- app/src/features/dashboard/schema.ts
- app/src/features/dashboard/dashboard.test.tsx

### Architecture Compliance Guardrails

- Local-first invariant only: no external API calls for trend or balance calculations.
- Keep typed frontend-to-Tauri command boundary and standard `{ ok, data/error }` envelope.
- This story is read-model focused: do not mutate transaction/account records during trend reads.
- Deterministic outputs are mandatory for same persisted dataset and same preset window.
- Preserve no-silent-mutation and validate-first invariants from Epic 2.

### UX Guardrails

- Follow insight-first dashboard behavior from UX spec: compact signal first, details on focus/expand.
- Trend alerts must be explainable, not opaque: include baseline context and reason text.
- Provide deterministic empty states when there is insufficient history for trend detection.
- Keep keyboard navigability and visible focus states for any interactive trend controls.
- Maintain non-color-only communication for alert states.

### Data Contract and Aggregation Requirements

- Trend alert payload minimum fields:
  - `windowPreset`, `currentSpendMinor`, `baselineSpendMinor`, `deltaPercent`, `thresholdPercent`, `isAlert`, `reason`
- Running-balance payload minimum fields:
  - `windowPreset`, `points[]` where each point has `timestamp`, `balanceMinor`, `deltaMinor`, `entryId`, `entryKind`
- Aggregation scope:
  - Preset windows only (no custom range picker in this story): `7d`, `30d`, `90d`, `all` (or project-defined equivalents).
  - Use persisted account + transaction rows only; exclude unsaved/blocked attempts.
- Deterministic ordering:
  - Running-balance points sorted ascending by event time with id tiebreak.
  - Dashboard history list ordering remains descending (`created_at DESC, id DESC`) and must not be altered.

### Regression Risks to Prevent

- Do not regress Story 1.2 corrected onboarding flow: first launch remains dashboard-first; account confirmation remains save-triggered for new parsed account.
- Do not refresh trend cards/charts on failed save or blocked validation paths.
- Do not break existing balance sign handling (`debit` negative, `credit` positive) used in baseline calculations.
- Do not introduce mobile-first assumptions; MVP remains desktop-first with minimum supported width behavior.

### Previous Story Intelligence

From Story 3.3 context and Story 2.5 completion:
- Keep deterministic save lifecycle semantics (`idle -> validating -> persisting -> success/failed`) unchanged.
- Preserve baseline-refresh-after-commit-only behavior.
- Favor incremental structure changes because current repository does not yet fully match long-form target architecture tree.
- Keep guidance and empty states explicit and concise, with non-color cues.

### Git Intelligence Summary

Recent commits are concentrated around onboarding correction and deterministic behavior preservation:
- 11b7a77 Merge branch Story_1-2_correction_course_implementation
- 096daf7 Implement Story 1.2 onboarding correction
- af86f57 Merge sprint_change_correct_course into main
- 17350a0 Correct-course updates for Story 1.2 and UX flow alignment
- be465b4 Commit changes

Implication: trend visualization work must not reintroduce setup-first assumptions or non-deterministic refresh behavior.

### Latest Technical Information

- Current project versions (`app/package.json`): React 19.1.0, Zod 4.4.1, React Hook Form 7.74.0, Vitest 4.1.5, Tauri SQL plugin 2.4.0.
- Latest npm registry versions checked on 2026-05-20:
  - `react`: 19.2.6
  - `zod`: 4.4.3
  - `react-hook-form`: 7.76.0
  - `vitest`: 4.1.6
  - `@tauri-apps/plugin-sql`: 2.4.0
  - `recharts`: 3.8.1
- Guidance for this story:
  - No dependency upgrade is required for Story 3.4; preserve lockfile stability.
  - If charting library is introduced, prefer minimal deterministic rendering with existing stack first; avoid introducing heavyweight visualization dependencies unless a concrete gap is proven.

### Project Context Reference

- No `project-context.md` file discovered from configured persistent fact glob.

### References

- _bmad-output/planning-artifacts/epics.md (Epic 3, Story 3.4)
- _bmad-output/planning-artifacts/prd.md (FR22, FR23, FR24, FR25)
- _bmad-output/planning-artifacts/architecture.md (typed command boundary, deterministic behavior, local-first constraints)
- _bmad-output/planning-artifacts/ux-design-specification.md (insight-first dashboard, progressive disclosure, accessibility cues)
- _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-19.md (onboarding guardrail)
- _bmad-output/implementation-artifacts/3-3-category-and-merchant-insight-cards.md
- _bmad-output/implementation-artifacts/3-1-day-1-category-taxonomy-and-suggested-categorization.md
- _bmad-output/implementation-artifacts/2-5-deterministic-save-state-machine-and-audit-trail.md
- app/src/App.tsx
- app/src/App.css
- app/src/features/ledger/service.ts
- app/src/features/ledger/schema.ts
- app/src/features/ledger/components/LedgerBaselineView.tsx
- app/src/features/ledger/ledger.test.tsx
- app/src-tauri/src/commands/ledger.rs
- app/src-tauri/src/db/ledger.rs
- app/package.json

## Story Completion Status

- Status set to: ready-for-dev
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Workflow configuration resolved via `_bmad/scripts/resolve_customization.py`.
- Sprint status, planning artifacts, architecture, UX, and prior implementation artifacts analyzed.
- Current codebase update targets reviewed in frontend and Rust command layers.

### Completion Notes List

- Story 3.4 context includes explicit non-regression guardrails for onboarding and deterministic save-refresh behavior.
- Trend and running-balance data contracts are defined for deterministic implementation and testability.
- Latest package intelligence included without forcing unrelated dependency upgrades.

### File List

- _bmad-output/implementation-artifacts/3-4-trend-alerts-and-running-balance-visualization.md
