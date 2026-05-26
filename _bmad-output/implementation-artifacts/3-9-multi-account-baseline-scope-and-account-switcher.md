# Story 3.9: Multi-Account Baseline Scope and Account Switcher

Status: review

## Story

As a user,
I want all-accounts baseline visibility with optional account filtering,
so that I can trust where my transactions are shown when multiple accounts exist.

## Acceptance Criteria

1. Given multiple accounts with saved transactions, when I open the ledger baseline/dashboard surface, then baseline/history/insight data considers all accounts by default and the scope is clearly labeled as all-accounts.
2. Given I apply an account filter, when I select a specific account, then baseline/history/insight data reflects only that account and switching between all-accounts and filtered modes refreshes deterministically.

## Tasks / Subtasks

- [x] Introduce explicit baseline scope contract in backend and frontend (AC: 1, 2)
  - [x] Add scope metadata to baseline response (for example: all-accounts or account:<id>) so the UI can always render explicit context.
  - [x] Keep default baseline scope as all-accounts when multiple accounts exist.
- [x] Implement account-switcher/filter flow (AC: 2)
  - [x] Add account list retrieval and UI selection control for switching from all-accounts to a specific account.
  - [x] Ensure selected scope drives baseline/history/insight queries through one typed request path.
- [x] Preserve deterministic data behavior across scope changes (AC: 1, 2)
  - [x] Keep ordering guarantees for history and summaries when switching scopes repeatedly.
  - [x] Ensure failed/blocked saves do not trigger scope refresh side effects.
- [x] Keep read-model consistency for insight summary, trend, and running balance (AC: 1, 2)
  - [x] Ensure category, merchant, trend, and running-balance surfaces align with currently selected scope.
  - [x] Show clear scope labeling near baseline hero and/or insight region.
- [x] Add regression coverage for all-accounts default and filtered views (AC: 1, 2)
  - [x] Add Rust command tests for all-accounts aggregate default and account-filtered queries.
  - [x] Extend Vitest app/ledger tests to verify explicit scope labels, switching behavior, and deterministic refresh.

## Dev Notes

### Story Foundation

- Epic objective: eliminate account-scope ambiguity in baseline/history/insight views after multi-account capture/save.
- Business value: users stop interpreting filtered data as missing transactions and gain trust in ledger visibility.
- Change trigger context: approved course correction on 2026-05-25 requires all-accounts default plus optional account filter.
- Dependencies:
  - Upstream: Story 3.7 summary cards and Story 3.8 progressive disclosure patterns.
  - Upstream: Story 2.5 deterministic save/refresh behavior.
  - Upstream: Story 1.2 dashboard-first onboarding behavior.

### Current State of Files Likely to be UPDATED

- app/src-tauri/src/commands/ledger.rs
  - Current state: baseline read path hard-selects first account using ORDER BY id ASC LIMIT 1, then scopes balance/history/insights/running-balance/trend to that account id.
  - This story changes: add all-accounts default aggregation and account-filtered retrieval with explicit scope metadata.
  - Must preserve: deterministic ordering, stable error envelope shape, local-first command behavior, and existing category-update command semantics.

- app/src/features/ledger/service.ts
  - Current state: getLedgerBaseline has no scope parameter and expects a single-account shaped baseline payload.
  - This story changes: include optional scope request and expanded response typing (scope metadata and account options/filter context).
  - Must preserve: typed invoke boundary, existing command names unless intentionally versioned, and envelope handling.

- app/src/features/ledger/schema.ts
  - Current state: validates single-account baseline payload without scope metadata.
  - This story changes: add schema fields for scope context and account switcher options.
  - Must preserve: existing baseline validation contracts where still valid.

- app/src/features/ledger/components/LedgerBaselineView.tsx
  - Current state: renders one selected account summary and one history list without visible scope mode controls.
  - This story changes: add explicit all-accounts scope label and account switcher/filter controls.
  - Must preserve: deterministic history rendering, refresh button behavior, and category update affordance.

- app/src/App.tsx
  - Current state: fetches one baseline on load and after accepted write; no account-scope state.
  - This story changes: own selected scope state and request baseline refreshes against selected scope.
  - Must preserve: runtime guard, save lifecycle and gating rules, deferred account setup prompt, and refresh-after-commit only.

- app/src/features/ledger/ledger.test.tsx
  - Current state: fixtures and assertions are largely single-account assumptions.
  - This story changes: add all-accounts default and filtered-mode regression assertions.
  - Must preserve: onboarding correction and baseline fallback coverage.

### Files that SHOULD remain unchanged unless strictly necessary

- app/src/features/capture/components/ReadinessStatus.tsx
- app/src/features/capture/components/CorrectionPanel.tsx
- app/src/features/capture/components/TransactionInput.tsx

This story is about read-model scope clarity; avoid capture-flow churn unless required for cross-scope integrity.

### Expected NEW Files (probable)

- app/src/features/ledger/components/AccountScopeSwitcher.tsx

Optional only if it reduces duplication cleanly:

- app/src/features/ledger/schema-scope.ts

### Architecture Compliance Guardrails

- Local-first invariant remains non-negotiable: no remote calls for account listing or baseline scope switching.
- Preserve typed frontend-to-Tauri command boundary and error envelope structure.
- Keep deterministic ordering: history still ordered by created_at desc then id desc for display payloads.
- Keep deterministic scope switching: repeating same scope selection over unchanged data must yield stable outputs.
- Maintain backward-safe defaults for no-account and single-account states.

### UX Guardrails

- All-accounts must be explicit and visible by default when multiple accounts exist.
- Account filter state must be obvious and reversible.
- Scope labels must remove ambiguity (for example, all accounts versus one selected account).
- Do not hide scope context behind non-obvious controls.
- Keep keyboard accessibility and visible focus for switcher controls.

### Current Behavior Notes That Matter for Implementation

- The backend currently selects only the first account and propagates that scope to all derived views.
- Ledger hero copy currently implies a single-account baseline and should be revised for scope-aware wording.
- Existing insight summary and running balance components consume baseline data directly; once scope changes, both must reflect the same scope source-of-truth.
- Category update action currently refreshes baseline without scope argument; this can unintentionally reset or drift selected scope unless explicitly preserved.

### Regression Risks to Prevent

- Do not break deterministic save/refresh behavior while adding scope selection.
- Do not produce mixed-scope payloads (for example, all-accounts entries with single-account insights).
- Do not silently reset account scope after refresh, save, or category update.
- Do not regress no-account first-run fallback state.
- Do not regress ordering guarantees in history list.

### Previous Story Intelligence

From Story 3.8 and Story 3.7:

- Preserve compact and non-disruptive UX patterns while introducing new scope controls.
- Preserve refresh-after-accepted-write discipline from app orchestration.
- Keep deterministic summary-card ordering and explicit empty-state behavior.
- Avoid broad restructuring; prefer incremental extension of existing ledger and app surfaces.

### Git Intelligence Summary

Recent commits indicate stable capture and summary groundwork that this story must build on:

- 7de31f0 Update sprint artifacts and add change proposal
- be409f3 Merge branch story-3-8
- 3edbbf2 Implement story 3.8 progressive disclosure and confirmation feedback
- e4e7304 Merge branch story-3-7 into main
- d0272e5 Implement story 3-7 insight summary components and ledger updates

Implication: implement scope corrections without regressing 3.7/3.8 behavior.

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
  - No dependency upgrade is required to deliver Story 3.9.
  - Prioritize contract and scope correctness over library-version drift.

### Project Context Reference

- No project-context.md file was discovered from the configured persistent fact glob.

### References

- _bmad-output/planning-artifacts/epics.md (Epic 3, Story 3.9)
- _bmad-output/planning-artifacts/prd.md (FR5, FR19, FR20, FR21, FR22, FR23, FR24, FR25)
- _bmad-output/planning-artifacts/architecture.md (typed command boundary, deterministic flows, local-first constraint)
- _bmad-output/planning-artifacts/ux-design-specification.md (scope clarity, desktop layout, keyboard-first behavior)
- _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-25.md
- _bmad-output/implementation-artifacts/3-8-progressive-disclosure-and-confirmation-feedback.md
- _bmad-output/implementation-artifacts/3-7-insight-summary-story-components.md
- app/src-tauri/src/commands/ledger.rs
- app/src/App.tsx
- app/src/features/ledger/service.ts
- app/src/features/ledger/schema.ts
- app/src/features/ledger/components/LedgerBaselineView.tsx
- app/src/features/ledger/ledger.test.tsx
- app/package.json

## Story Completion Status

- Status set to: review
- Completion note: Scoped ledger baseline, account switcher, and regression coverage implemented and validated.

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Workflow resolved through _bmad/scripts/resolve_customization.py for bmad-create-story.
- Sprint status, epics, PRD, architecture, UX, and approved sprint change proposal analyzed.
- Previous Story 3 implementation artifacts reviewed for guardrails and regression risks.
- Current frontend and Rust ledger surfaces read to identify precise update boundaries.
- Latest npm package versions checked on 2026-05-25.
- Implemented scoped baseline contract, all-accounts default aggregation, account switcher UI, and scope-preserving refresh flow.
- Validated with `cargo test`, `npm test -- --run src/features/ledger/ledger.test.tsx`, and `npm run build`.

### Completion Notes List

- Captured all-accounts default requirement and optional account filter as explicit implementation tasks.
- Added file-level preserve/change guidance for backend query scope and frontend scope-state wiring.
- Embedded deterministic behavior and no-regression guardrails anchored to current code reality.
- Included test strategy for both Rust and Vitest layers.
- Delivered scoped ledger baseline data from Rust with all-accounts aggregation, explicit scope metadata, and filtered account reads.
- Added frontend scope selection state, account switcher UI, and scope-preserving refresh/save behavior.
- Added regression coverage for all-accounts default, filtered scope switching, and deterministic refresh.

### File List

- _bmad-output/implementation-artifacts/3-9-multi-account-baseline-scope-and-account-switcher.md
- app/src/App.css
- app/src/App.tsx
- app/src/features/ledger/components/AccountScopeSwitcher.tsx
- app/src/features/ledger/components/LedgerBaselineView.tsx
- app/src/features/ledger/ledger.test.tsx
- app/src/features/ledger/schema.ts
- app/src/features/ledger/service.ts
- app/src-tauri/src/commands/ledger.rs

## Change Log

- 2026-05-25: Created story context for 3.9 with multi-account baseline scope and account switcher guardrails.
- 2026-05-26: Implemented scoped baseline contract, all-accounts default aggregation, account switcher UI, and regression tests; story moved to review.
