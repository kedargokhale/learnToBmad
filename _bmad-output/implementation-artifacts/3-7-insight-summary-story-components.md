# Story 3.7: Insight Summary Story Components

Status: done

## Story

As a user,
I want insight components that present category, merchant, and trend narratives clearly,
so that I can quickly understand spending outcomes after each save.

## Acceptance Criteria

1. Given categorized transactions exist, when I view the dashboard, then StoryCard and InsightSummary components render category, merchant, and trend insights in a consistent layout.
2. Given values update after successful transaction saves, when dashboard data refresh runs, then insight summaries reflect the latest persisted data without manual reload.
3. Given there are no eligible transactions for an insight card, when I view the dashboard, then a deterministic empty state is shown and the UI provides a clear next action.

## Tasks / Subtasks

- [x] Consolidate the dashboard summary contract around existing insight data (AC: 1, 2, 3)
  - [x] Extend the current baseline/dashboard response shape so category, merchant, and trend narratives can be consumed through one typed summary path.
  - [x] Reuse category, merchant, and trend aggregates from Stories 3.3 and 3.4 instead of recomputing separate frontend-only narratives in multiple components.
- [x] Build reusable StoryCard and InsightSummary components (AC: 1, 3)
  - [x] Implement one consistent card shell for title, headline metric, supporting copy, optional badge, and supporting visual slot.
  - [x] Support category, merchant, and trend variants through typed props or normalized view models rather than copy-pasted layouts.
- [x] Integrate the insight summary into the current dashboard shell (AC: 1, 2)
  - [x] Render the summary in the existing ledger/dashboard area without breaking the capture surface or transaction history view.
  - [x] Keep dashboard refresh tied to the committed save path only, using the existing post-save baseline reload.
- [x] Implement deterministic empty states and next-action guidance (AC: 3)
  - [x] Show a deliberate empty-state card for each unavailable insight instead of leaving blank space.
  - [x] Provide concise next-action copy such as saving more categorized transactions or selecting a supported time preset.
- [x] Add regression and accessibility coverage (AC: 1, 2, 3)
  - [x] Add frontend tests for summary rendering, empty states, responsive card arrangement, and post-save refresh behavior.
  - [x] Add backend tests if summary contracts are assembled in Rust, covering deterministic card ordering and stable empty-state payloads.
  - [x] Keep Story 1.2 onboarding correction, Story 2.5 deterministic save behavior, and existing ledger ordering tests green.

### Review Findings

- [x] [Review][Patch] Partial insight payload can drop required cards instead of rendering deterministic per-kind fallbacks [app/src/features/dashboard/components/InsightSummary.tsx:56]
- [x] [Review][Patch] Category headline humanization only replaces the first underscore and can render malformed labels [app/src-tauri/src/commands/ledger.rs:1240]
- [x] [Review][Patch] Summary currency formatting regressed to non-localized fixed-string output [app/src-tauri/src/commands/ledger.rs:1343]
- [x] [Review][Patch] Trend/balance section aria label no longer matches rendered content after TrendAlertCard removal [app/src/features/ledger/components/LedgerBaselineView.tsx:66]
- [x] [Review][Patch] Responsive arrangement regression coverage for summary cards is still missing [app/src/features/ledger/ledger.test.tsx:453]

## Dev Notes

### Story Foundation

- Epic objective: turn the category, merchant, and trend work into one coherent dashboard payoff instead of three disconnected outputs.
- Business value: this is the narrative layer that answers "what changed" and "where did my money go" quickly after save.
- Dependencies:
  - Upstream: Story 3.3 category and merchant insight payloads.
  - Upstream: Story 3.4 trend alert and running-balance payloads.
  - Upstream: Story 2.5 deterministic save/refresh behavior.
  - Adjacent: Story 3.5 capture/readiness work must remain intact; this story should not alter capture gating semantics.

### Current State of Files Likely to be UPDATED

- app/src/App.tsx
  - Current state: orchestrates parse, correction, save, and baseline refresh; renders the capture surface followed by LedgerBaselineView.
  - This story changes: continue passing refreshed baseline data into the dashboard region while preserving the current save-triggered refresh behavior.
  - Must preserve: runtime guard, save lifecycle transitions, deferred account confirmation, and refresh only after `acceptedForWrite`.

- app/src/features/ledger/components/LedgerBaselineView.tsx
  - Current state: renders ledger hero content plus deterministic transaction history.
  - This story changes: host InsightSummary and StoryCard rendering in the existing dashboard area.
  - Must preserve: account summary visibility, refresh button behavior, and ordered history rendering.

- app/src/features/ledger/service.ts
  - Current state: typed contract includes account, ordered entries, and ordering metadata from `get_ledger_baseline`.
  - This story changes: extend response typing to carry the summary inputs or normalized summary payload.
  - Must preserve: command names, command envelope shape, and current fetch semantics.

- app/src/features/ledger/schema.ts
  - Current state: validates account and entry baseline data only.
  - This story changes: add schemas for summary card inputs and deterministic empty-state payloads.
  - Must preserve: existing account and ledger-entry validation contracts.

- app/src/App.css
  - Current state: provides the desktop-first app shell, capture grid, ledger hero/card styling, and focus visuals.
  - This story changes: add summary-grid and story-card layout rules that fit the current visual language.
  - Must preserve: desktop-first layout, visible focus styling, and current capture/ledger shell spacing.

- app/src/features/ledger/ledger.test.tsx
  - Current state: validates baseline loading paths, dashboard-first onboarding shell, and save-triggered account confirmation behavior.
  - This story changes: add assertions for summary rendering and post-save refresh behavior.
  - Must preserve: current onboarding and runtime-guard regressions.

- app/src-tauri/src/commands/ledger.rs
  - Current state: `get_ledger_baseline` returns account summary, combined ordered entries, and ordering metadata only.
  - This story changes: extend the existing baseline response with summary data first; do not assume a separate `dashboard.rs` command already exists.
  - Must preserve: read-only behavior, deterministic ordering (`created_at DESC, id DESC` for history), and the no-account empty baseline path.

### Expected NEW Files (probable)

- app/src/features/dashboard/components/StoryCard.tsx
- app/src/features/dashboard/components/InsightSummary.tsx
- app/src/features/dashboard/schema.ts
- app/src/features/dashboard/dashboard.test.tsx

Optional only if it removes duplication cleanly:

- app/src/features/dashboard/formatters.ts

Repository reality note: the architecture document shows a future `src/features/dashboard/` module, but the current codebase does not have that folder yet. Introduce it incrementally without forcing a broad store/selectors refactor.

### Architecture Compliance Guardrails

- Local-first only: no network calls and no cloud-derived insight composition.
- Keep the existing typed frontend-to-Tauri command boundary and `{ ok, data/error }` envelope.
- Extend `get_ledger_baseline` before introducing a command split; a later move to `dashboard.rs` is optional follow-up, not a prerequisite.
- Do not duplicate aggregation logic in multiple React components. Narrative formatting should flow through one typed adapter path.
- Preserve deterministic behavior: identical persisted rows and the same selected preset must yield the same summary content and empty states.

### UX Guardrails

- Follow the D2 + D5 direction from the UX spec: insight-first layout with narrative-driven story cards.
- Keep category, merchant, and trend cards visually consistent in heading structure, metric hierarchy, and supporting copy.
- Use deterministic empty states with clear next actions instead of blank containers.
- Preserve keyboard navigability and visible focus treatment for any interactive summary controls.
- Do not require modal interaction to understand routine dashboard insights.

### Insight Summary Contract Guidance

Prefer one normalized card view model per rendered card. Minimum useful fields:

- `kind`: `category`, `merchant`, or `trend`
- `title`
- `headline`
- `metricLabel`
- `metricValue`
- `supportingText`
- `badgeLabel` or status text when applicable
- `emptyState`: `{ title, detail, nextAction }`

Source-of-truth guidance:

- Numeric and aggregate values should continue to come from the typed backend payloads introduced for Stories 3.3 and 3.4.
- The summary layer may normalize or format copy, but it must not invent competing totals or run unsynchronized aggregate calculations in separate components.

### Regression Risks to Prevent

- Do not recompute category, merchant, and trend totals independently in each card and drift from backend truth.
- Do not refresh summary cards on failed save attempts, blocked validation, or parse-only changes.
- Do not remove the existing `No transactions yet.` baseline state when there is no account or no persisted data.
- Do not break transaction history ordering while adding summary cards.
- Do not assume a mobile-first card layout; MVP remains desktop-first, with responsive fallback only where current styles already support it.

### Previous Story Intelligence

From Stories 3.3, 3.4, and 3.5 plus Epic 2 implementation artifacts:

- Keep baseline refresh after committed write only.
- Prefer incremental structure changes because the repository does not yet fully match the long-form architecture tree.
- Preserve capture/readiness semantics while extending the dashboard surface.
- Keep deterministic empty-state and non-color cue patterns explicit.

### Git Intelligence Summary

Recent commits remain concentrated around onboarding correction and deterministic flow preservation:

- 11b7a77 Merge branch 'Story_1-2_correction_course_implementation'
- 096daf7 Implement Story 1.2 onboarding correction
- af86f57 Merge sprint_change_correct_course into main
- 17350a0 Correct-course updates for Story 1.2 and UX flow alignment
- be465b4 Commit changes

Implication: dashboard summary integration must not reintroduce setup-first behavior or non-deterministic refresh logic.

### Latest Technical Information

- Current project versions (`app/package.json`): React 19.1.0, Zod 4.4.1, React Hook Form 7.74.0, Vitest 4.1.5, Tauri SQL plugin 2.4.0.
- Latest npm registry versions checked on 2026-05-20:
  - `react`: 19.2.6
  - `zod`: 4.4.3
  - `react-hook-form`: 7.76.0
  - `vitest`: 4.1.6
  - `@tauri-apps/plugin-sql`: 2.4.0
- Guidance for this story:
  - No dependency upgrades are required for Story 3.7.
  - Prefer local components over adding a card or dashboard UI dependency just to render the summary shell.

### Project Context Reference

- No `project-context.md` file was discovered from the configured persistent fact glob.

### References

- _bmad-output/planning-artifacts/epics.md (Epic 3, Story 3.7)
- _bmad-output/planning-artifacts/prd.md (FR20, FR21, FR22, FR24, FR25)
- _bmad-output/planning-artifacts/architecture.md (dashboard module target, typed command boundary, deterministic data flow)
- _bmad-output/planning-artifacts/ux-design-specification.md (StoryCard, InsightSummary, D2+D5 dashboard direction, empty-state patterns)
- _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-19.md (onboarding flow guardrail)
- _bmad-output/implementation-artifacts/3-3-category-and-merchant-insight-cards.md
- _bmad-output/implementation-artifacts/3-4-trend-alerts-and-running-balance-visualization.md
- _bmad-output/implementation-artifacts/3-5-capture-surface-and-readiness-state-components.md
- _bmad-output/implementation-artifacts/2-5-deterministic-save-state-machine-and-audit-trail.md
- app/src/App.tsx
- app/src/App.css
- app/src/features/ledger/components/LedgerBaselineView.tsx
- app/src/features/ledger/service.ts
- app/src/features/ledger/schema.ts
- app/src/features/ledger/ledger.test.tsx
- app/src-tauri/src/commands/ledger.rs
- app/package.json

## Story Completion Status

- Status set to: ready-for-dev
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Implementation Plan

- Extend `get_ledger_baseline` with one normalized `insight_summary` card contract while reusing existing category, merchant, and trend aggregate outputs.
- Refactor dashboard card rendering to consume typed summary cards rather than composing separate per-insight layouts.
- Keep save-triggered refresh behavior unchanged and verify summaries only refresh through committed-write baseline reload.
- Add frontend and backend regression tests for deterministic card ordering and stable empty-state guidance payloads.

### Debug Log References

- Workflow configuration resolved through `_bmad/scripts/resolve_customization.py`.
- Sprint status, planning artifacts, architecture, UX, prior story artifacts, and current frontend/native dashboard surfaces analyzed.
- Package registry versions checked on 2026-05-20 for React, Zod, React Hook Form, Vitest, and Tauri SQL plugin.

### Completion Notes List

- Implemented a normalized `insightSummary` contract across backend and frontend with deterministic `category`, `merchant`, `trend` ordering and stable empty-state payloads.
- Refactored `StoryCard`/`InsightSummary` into a single reusable typed card shell supporting headline metric, supporting copy, optional badge, and explicit next-action empty states.
- Integrated summary cards in the ledger dashboard shell while preserving capture surface behavior, transaction history rendering, and post-`acceptedForWrite` refresh semantics.
- Added regression coverage in Vitest and Rust tests for summary rendering, empty states, deterministic ordering, and post-save card refresh behavior.
- Validation completed successfully:
  - `pnpm test` (43 passed)
  - `cargo test commands::ledger` (14 passed)

### File List

- _bmad-output/implementation-artifacts/3-7-insight-summary-story-components.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- app/src/App.css
- app/src/features/dashboard/components/InsightSummary.tsx
- app/src/features/dashboard/components/StoryCard.tsx
- app/src/features/ledger/components/LedgerBaselineView.tsx
- app/src/features/ledger/ledger.test.tsx
- app/src/features/ledger/schema.ts
- app/src/features/ledger/service.ts
- app/src-tauri/src/commands/ledger.rs

## Change Log

- 2026-05-25: Implemented Story 3.7 insight summary normalization, dashboard component refactor, deterministic empty states, and cross-layer regression tests; status moved to `review`.