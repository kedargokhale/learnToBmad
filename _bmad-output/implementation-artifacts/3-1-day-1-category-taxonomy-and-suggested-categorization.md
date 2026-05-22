# Story 3.1: Day-1 Category Taxonomy and Suggested Categorization

Status: done

## Story

As a user,
I want predefined categories and initial category suggestions,
so that insights are useful from the first transactions.

## Acceptance Criteria

1. Given a newly initialized app, when transactions are parsed and saved, then each transaction is assigned a suggested category from the predefined taxonomy.
2. Given a suggested category, I can override the suggestion before save.
3. Given a saved transaction, I can override the category after save.

## Tasks / Subtasks

- [x] Define Day-1 category taxonomy and persistence contract (AC: 1)
  - [x] Add a migration for taxonomy seed and transaction category fields (idempotent, ordered migration only).
  - [x] Add backend read/write model for category suggestion + explicit override source.
- [x] Generate suggestion during parse-save flow (AC: 1)
  - [x] Extend capture save path to include `suggestedCategory`, `finalCategory`, and `categorySource` metadata.
  - [x] Keep deterministic behavior for same input + same ruleset.
- [x] Support pre-save override in capture UI (AC: 2)
  - [x] Add category selector to capture flow once parse preview exists.
  - [x] Preserve hard validation gates for critical fields (category must not bypass required-field checks).
- [x] Support post-save override in ledger/dashboard surface (AC: 3)
  - [x] Add category edit action for persisted rows.
  - [x] Persist edit history in audit trail with non-destructive updates.
- [x] Add regression and acceptance tests (AC: 1, 2, 3)
  - [x] Rust tests for deterministic category assignment and override persistence.
  - [x] Frontend tests for pre-save override and post-save edit behavior.
  - [x] Ensure Story 2.1-2.5 tests remain green.

### Review Findings

- [x] [Review][Patch] Persisted suggested category can be client-influenced, breaking deterministic save behavior [app/src-tauri/src/commands/capture.rs:726]
- [x] [Review][Patch] Post-save category update ignores persisted save-state guard and can mutate non-persisted rows [app/src-tauri/src/commands/ledger.rs:271]
- [x] [Review][Patch] Post-save category update always forces category_source to user-override [app/src-tauri/src/commands/ledger.rs:271]
- [x] [Review][Patch] Migration v0005 can fail mid-flight and leave foreign key enforcement unsafe (merged blind+edge finding) [app/src-tauri/migrations/0005_add_transaction_categories.sql:1]
- [x] [Review][Patch] Zero-amount transactions render as missing amount in readiness UI [app/src/features/capture/components/ReadinessStatus.tsx:125]
- [x] [Review][Patch] Ledger category update can issue duplicate writes and unhandled async refresh failures [app/src/features/ledger/components/LedgerBaselineView.tsx:110]
- [x] [Review][Patch] No-op category updates still write and append audit events [app/src-tauri/src/commands/ledger.rs:357]
- [x] [Review][Patch] Unknown/new category codes can hard-fail strict frontend schema validation [app/src/features/capture/schema.ts:81]
- [x] [Review][Patch] Missing negative-path tests for invalid category, missing transaction, and non-persisted-state rejection [app/src/features/ledger/ledger.test.tsx:296]

## Dev Notes

### Story Foundation

- Epic objective: unlock first useful spending insights by ensuring every saved transaction is category-ready from day 1.
- Business value: immediate category coverage is a prerequisite for Story 3.3 and 3.4 insight cards.
- Story dependency chain:
  - Upstream: Epic 2 deterministic parse-validate-save and audit trail.
  - Downstream: 3.2 learning loop, 3.3 category/merchant cards, 3.4 trend cards.

### Current State of Files Likely to be UPDATED

- app/src-tauri/src/commands/capture.rs
  - Current state: parse + save gate + deterministic persistence + capture audit writing.
  - This story changes: include category suggestion at save, support override inputs, and record category metadata/audit events.
  - Must preserve: all critical-field validation gates, mismatch/duplicate decision gating, deterministic envelopes, atomic write semantics.

- app/src-tauri/src/commands/ledger.rs
  - Current state: baseline account + entries projection with deterministic ordering.
  - This story changes: include category information in ledger/baseline payloads and expose category-edit command path.
  - Must preserve: stable ordering (`created_at DESC, id DESC`), balance computation, and empty-state behavior.

- app/src-tauri/src/db/ledger.rs
  - Current state: ordered migration registration through v4.
  - This story changes: register next migration version for category schema additions.
  - Must preserve: existing migration order and plugin initialization behavior.

- app/src/App.tsx
  - Current state: desktop guard, parse/correction/save orchestration, save lifecycle, conditional first-account prompt.
  - This story changes: integrate category suggestion display + override controls in existing capture loop and post-save edit trigger.
  - Must preserve: save lifecycle transitions, baseline refresh only after committed save, no browser-runtime fallback regressions.

- app/src/features/capture/schema.ts
  - Current state: parse preview schema, blocked field derivation, correction map, save lifecycle labels.
  - This story changes: add category schema fields and validation for category override payload.
  - Must preserve: existing critical-field semantics and correction utilities.

- app/src/features/capture/service.ts
  - Current state: parse/save command envelopes and payloads for capture persistence.
  - This story changes: extend parse/save contracts with category suggestion and override fields.
  - Must preserve: command names, envelope structure, and deterministic response handling.

- app/src/features/capture/components/TransactionInput.tsx
  - Current state: paste-to-parse surface and save trigger.
  - This story changes: add category suggestion/override input in capture context.
  - Must preserve: keyboard-first behavior and blocked-save reason visibility.

- app/src/features/capture/components/ReadinessStatus.tsx
  - Current state: parse/save readiness banners, blocked field listing, mismatch/duplicate decisions, success confirmation.
  - This story changes: display suggested category and category source clarity.
  - Must preserve: non-color cues, failure messaging, and decision-state UX.

- app/src/features/capture/capture.test.tsx
  - Current state: parse/readiness/correction/save deterministic regression suite.
  - This story changes: add tests for suggestion visibility and pre-save override.
  - Must preserve: all Story 2.1-2.5 regression assertions.

### Expected NEW Files (probable)

- app/src-tauri/migrations/0005_add_transaction_categories.sql
- app/src/features/capture/components/CategorySuggestionField.tsx
- app/src/features/ledger/components/CategoryEditControl.tsx
- app/src/features/categorization/schema.ts (if feature module is introduced now)
- app/src/features/categorization/service.ts (if feature module is introduced now)

### Architecture Compliance Guardrails

- Local-first only: no network calls for suggestion generation or category lookup.
- Keep typed frontend-native command boundary and standard error envelope.
- Use ordered/versioned SQLite migration discipline only (no in-place migration edits).
- Deterministic outcomes required for repeated identical input and rule set.
- Preserve atomicity and no-silent-mutation guarantees.

### UX Guardrails

- Follow UX progressive disclosure: compact readiness first, detailed controls only when needed.
- Keep button labels minimal and outcome-oriented.
- Keep keyboard-first interactions and visible focus states.
- Provide explicit disabled reasons when save is blocked.
- Ensure save/correction confirmations remain non-disruptive (no forced modal flow).

### Library and Framework Requirements

- Use existing stack only unless absolutely necessary:
  - React 19.x, TypeScript 5.8.x, Vitest 4.x
  - Tauri v2, tauri-plugin-sql v2, sqlx 0.8.x
  - Zod 4.x
- Do not introduce new state managers or parser frameworks for this story.

### Previous Story Intelligence (Cross-Epic Carryover)

From Story 2.5 completion and review patches:
- Save path already enforces deterministic state transitions (`idle -> validating -> persisting -> success/failed`). Keep this unchanged.
- Duplicate `skip-save` must remain non-mutating.
- Audit trail history supports multiple events per transaction after migration v4; category updates should append history, not overwrite.
- Baseline refresh must happen only after committed writes; never on failed validation.
- Debit/credit sign handling in baseline is already corrected and must remain intact.

### Git Intelligence Summary

Recent commits indicate active alignment around save-triggered onboarding and deterministic behavior:
- 11b7a77 Merge branch Story_1-2_correction_course_implementation
- 096daf7 Implement Story 1.2 onboarding correction
- af86f57 Merge sprint_change_correct_course into main
- 17350a0 Correct-course updates for Story 1.2 and UX flow alignment
- be465b4 Commit changes

Implication for this story: preserve save-triggered flow consistency and avoid reintroducing setup-first assumptions.

### Latest Technical Information

- React docs currently reference v19.2 channel guidance; project is already on React 19.x and should stay there for this story.
- Zustand latest release observed as v5.0.13; project currently does not use Zustand yet in code paths touched here, so avoid introducing it mid-story unless the team explicitly starts feature-slice stores.
- Zod 4 is stable and already in use; keep schema-first contract expansion in existing patterns.
- React Hook Form site exposes v8 beta migration notes; stay on v7 for this story to avoid unrelated migration risk.

### Project Structure Notes

- Current repository implementation is not yet fully expanded to the architecture target tree (for example, dedicated `features/categorization` module may be introduced incrementally).
- Prefer incremental extension of existing capture/ledger modules now, then extract to a dedicated categorization module if code surface grows.
- Keep naming and contracts consistent with existing codebase conventions.

### References

- _bmad-output/planning-artifacts/epics.md (Epic 3, Story 3.1)
- _bmad-output/planning-artifacts/prd.md (FR15, FR16, FR18, FR19, FR20-FR25)
- _bmad-output/planning-artifacts/architecture.md (typed command boundary, migration discipline, deterministic flows)
- _bmad-output/planning-artifacts/ux-design-specification.md (progressive disclosure, validation clarity, keyboard-first)
- _bmad-output/implementation-artifacts/2-5-deterministic-save-state-machine-and-audit-trail.md
- _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-19.md
- app/src-tauri/src/commands/capture.rs
- app/src-tauri/src/commands/ledger.rs
- app/src-tauri/src/db/ledger.rs
- app/src/App.tsx
- app/src/features/capture/schema.ts
- app/src/features/capture/service.ts
- app/src/features/capture/components/TransactionInput.tsx
- app/src/features/capture/components/ReadinessStatus.tsx
- app/src/features/capture/capture.test.tsx

## Story Completion Status

- Status set to: review
- Completion note: Story implementation complete with migration-backed taxonomy seed, deterministic suggestion, pre-save override, and post-save edit with audit history.

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Workflow configuration resolved via `_bmad/scripts/resolve_customization.py`.
- Sprint status updated to in-progress before implementation and to review after completion.
- Implemented migration v5 for taxonomy seed, capture category fields, and category audit event expansion.
- Added backend deterministic suggestion/override handling and category update command path.
- Added frontend pre-save category selector and ledger post-save category edit controls.
- Executed full verification:
  - `npm test` (28 passing)
  - `cargo test` (35 passing)
  - `npm run build` (tsc + vite build successful)

### Completion Notes List

- Added migration `0005_add_transaction_categories.sql` with seeded Day-1 taxonomy and capture category persistence fields.
- Extended parse/save envelopes to carry `suggestedCategory`, `finalCategory`, and `categorySource` while preserving deterministic save-state behavior.
- Implemented deterministic category suggestion rules in Rust with same-input same-ruleset stability.
- Added pre-save override control in capture readiness UI without bypassing existing critical-field validation gates.
- Added post-save category override action in ledger history and persisted non-destructive `category_updated` audit events.
- Added/updated Rust and frontend tests for deterministic assignment, pre-save override payloads, post-save edits, and regression safety.

### File List

- app/src-tauri/migrations/0005_add_transaction_categories.sql
- app/src-tauri/src/db/ledger.rs
- app/src-tauri/src/commands/capture.rs
- app/src-tauri/src/commands/ledger.rs
- app/src-tauri/src/lib.rs
- app/src/features/categorization/schema.ts
- app/src/features/capture/schema.ts
- app/src/features/capture/service.ts
- app/src/features/capture/components/ReadinessStatus.tsx
- app/src/features/capture/capture.test.tsx
- app/src/features/ledger/service.ts
- app/src/features/ledger/components/LedgerBaselineView.tsx
- app/src/features/ledger/ledger.test.tsx
- app/src/App.tsx
- app/src/App.css
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/3-1-day-1-category-taxonomy-and-suggested-categorization.md

## Change Log

- 2026-05-22: Implemented Story 3.1 end-to-end and validated AC1-AC3. Added ordered migration v5 for taxonomy/category persistence, deterministic category suggestion/override handling in capture save flow, pre-save override UI, post-save ledger override with audit append, and full automated test coverage updates.
