---
title: "Product Brief Distillate: learnToBmad"
type: llm-distillate
source: "product-brief-learnToBmad.md"
created: "2026-04-26T15:35:11+05:30"
purpose: "Token-efficient context for downstream PRD creation"
---

# Product Brief Distillate: learnToBmad

## Product Intent Snapshot
- Personal finance web app that converts pasted bank transaction messages into structured ledger entries, then generates expense and balance insights.
- Brief type: personal product (not enterprise procurement-led), with dual audience: internal stakeholders and eventual end users.
- Near-term objective is pilot adoption intent validation, not immediate scale or monetization optimization.
- Pilot context explicitly constrained to founder-led usage in India-first desktop web.

## Problem and User Value Signals
- Core pain: transaction data is trapped in unstructured bank messages; manual logging creates abandonment due to low effort-to-value ratio.
- Existing alternatives often assume bank API connections or heavier budgeting workflows that do not match message-first behavior.
- Primary value promise: low-friction capture, reliable parsing safeguards, and quick insight into spending patterns.
- Core user question to optimize around: "Where did my money go?"

## Requirements Hints Captured
- Capture flow is single-message first, not batch paste, to reduce cognitive load and speed interaction.
- Critical fields treated as safety-gated extraction targets: amount, debit/credit, date, bank, account number, merchant/payee.
- Opening balance is mandatory at account setup and anchors all future calculations (going-forward-only model).
- Duplicate detection should not block save; transaction can be saved with possible-duplicate flag.
- Category model starts with predefined Day-1 taxonomy and remains always editable by user.
- Trend alerts should avoid noise using moving-average baseline, significance thresholds, and bootstrap silence with insufficient history.

## Technical Context and Constraints
- Architecture baseline: single-user desktop web app using SQLite local-first storage.
- Parsing strategy: generic parser baseline first; bank-specific templates are optional later optimization.
- Categorization strategy: rules + heuristics (no ML in v1) with correction-informed improvement loop.
- Confidence policy concept: dual-gate save behavior (parse confidence + category confidence) to reduce silent bad saves.
- Privacy posture at brief stage remains high-level: local-first data handling with optional manual export only.
- Explicitly out of v1: cloud sync, multi-user collaboration, native mobile apps, deep historical import, advanced predictive ML.

## Ideas and Decisions (Accepted)
- Adopt confidence-gated parsing/saving and explicit correction flow to preserve trust in financial records.
- Keep parser generic for broad initial message coverage before investing in bank-template optimization.
- Use three-card dashboard narrative (category dominance, merchant focus, trend alert) plus running balance line.
- Keep onboarding friction low: account extraction from message, user confirmation where needed, opening balance setup.
- Focus on practical reliability metrics over feature breadth during pilot.

## Rejected or Deferred Ideas (Preserve to Avoid Re-Proposal)
- Native mobile app in v1: deferred; web-only for pilot.
- Cloud sync/backup in v1: deferred; local-first remains default posture.
- Multi-user/collaborative mode in v1: out of scope.
- Advanced ML-driven categorization/prediction in v1: deferred in favor of rules + heuristics.
- Historical backfill/reconciliation-heavy workflows in v1: deferred; going-forward-only selected.
- Public acquisition and broad GTM in v1: deferred; internal rollout only for pilot.

## Competitive and Market Intelligence to Preserve
- Mainstream budgeting products are strong in broad budgeting UX but less differentiated for message-first parsing reliability workflows.
- Privacy/data ownership concerns are recurrent user sentiment in personal finance tool selection.
- SMS/message parsing demand appears validated in emerging-market contexts and open-source experimentation.
- Positioning opportunity: explainable automation + local-first trust model for users avoiding high-friction or cloud-heavy alternatives.
- Strategic framing for future: keep differentiation anchored in trustable capture flow and correction ergonomics, not feature checklist parity.

## Detailed User Scenarios
- First-run scenario: user pastes transaction message, account is recognized/confirmed, opening balance set, first entries saved rapidly.
- Steady-state scenario: recurring message patterns parse reliably, occasional corrections teach categorization behavior, weekly dashboards answer spending distribution and merchant concentration questions.
- Low-confidence scenario: automation hesitates safely, user reviews/edits critical fields, then commits entry without ledger corruption.
- Duplicate scenario: transaction can still be stored while visibly flagged for user review.

## Scope Signals for PRD
- In-scope v1 signals: parser reliability, correction UX quality, dashboard clarity, quick setup/time-to-value.
- Out-of-scope v1 signals: complex platform expansion, cloud infrastructure concerns, enterprise controls.
- Pilot evidence expectations: sustained weekly use, parse quality, and declining correction friction should guide next-phase decisions.
- Business framing in current brief intentionally avoids monetization commitment; defer business model detail to PRD or post-pilot strategy doc.

## Open Questions to Resolve in PRD
- Exact scoring logic and thresholds for confidence-gated save decisions (field-level and composite behavior).
- Concrete definition and measurement window for correction-rate target and parser-accuracy benchmark set.
- Rule-learning mechanics from user corrections: conflict handling, update cadence, and rollback behavior.
- Explicit data resilience plan details for local-first mode (manual export cadence, restore path UX).
- Post-pilot expansion trigger criteria beyond adoption intent confirmation.
- Android transition architecture approach once pilot goals are met.

## Risk Register Seeds
- High: parser breakage from bank format variability and drift.
- High: local data loss risk without robust backup discipline.
- Medium: trust erosion if confidence gating and correction UX are inconsistent.
- Medium: taxonomy mismatch between auto-category logic and user mental model.
- Medium: transition risk from founder-only pilot to repeatable broader adoption motion.
