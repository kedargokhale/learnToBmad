---
title: "Product Brief: learnToBmad"
status: "complete"
created: "2026-04-26T15:19:16+05:30"
updated: "2026-04-26T15:31:56+05:30"
inputs:
  - "_bmad-output/brainstorming/brainstorming-session-2026-04-23-175458.md"
  - "Contextual discovery synthesis (artifact + web research)"
---

# Product Brief: Message-to-Ledger Personal Finance App

## Executive Summary
Personal finance tracking is still too manual for many users, especially when transaction data arrives as bank SMS or message text instead of clean, connected feeds. People either avoid tracking entirely or spend too much effort correcting spreadsheets and generic budgeting apps that were not built for this input style.

This product is a lightweight web app that converts pasted bank transaction messages into structured ledger entries, then turns those entries into clear spending insights. The first release focuses on speed, reliability, and trust: fast single-message capture, confidence-gated parsing, easy correction, and an insight-first dashboard that answers one core question, "Where did my money go?"

The immediate objective is pilot adoption with a single primary user (founder-led use), validated in an India-first desktop web context, while being demonstrable to internal stakeholders. If successful, this evolves into an Android-first commercial product for broader consumer distribution.

In a category dominated by cloud-connected budgeting apps and manual-entry workflows, this brief positions a focused alternative: message-first capture with explainable safeguards and local-first data control.

## The Problem
Users who receive transaction details through bank alerts face a fragmented workflow:
- Transaction data lives in unstructured messages.
- Existing tools often require manual entry or API connections that are brittle, unavailable, or overkill for personal use.
- Early finance tracking experiences become tedious due to categorization mistakes, duplicate uncertainty, and noisy alerts.

The cost of the status quo is low consistency and low trust. Users abandon tracking because the effort-to-value ratio is poor.

## The Solution
Build a local-first, single-user web app with a friction-minimized capture and review flow:
- User pastes a single bank transaction message.
- System extracts critical fields: amount, debit or credit, date, bank name, account number, merchant or payee.
- Confidence-gated save policy controls automation safety.
- Transaction is stored and categorized using rule-based logic and heuristics.
- Dashboard presents three complementary expense stories:
  - Category dominance
  - Merchant focus (amount and frequency)
  - Trend alerts against moving-average baseline
- Running balance trend provides financial trajectory context.

Opening balance anchors account history from Day 1, and the product intentionally uses a going-forward-only model to avoid complex historical import.

## What Makes This Different
- SMS/message-first design, not an add-on: capture flow is optimized for unstructured transaction text.
- Reliability by policy, not hope: strict critical-field checks and dual-confidence gating reduce silent bad saves.
- Low-complexity intelligence: rule-based + heuristics achieve practical accuracy without heavy ML cost.
- Privacy-forward architecture: local-first storage with optional manual export only.
- Insight narrative clarity: dashboard is organized around user questions, not generic metric clutter.

Compared with mainstream budgeting products (which commonly prioritize bank integrations and broader budgeting workflows), this approach prioritizes reliable message parsing, rapid capture, and correction confidence for users who need low-friction tracking from bank alerts.

## Who This Serves
Primary user:
- Individuals who want personal finance clarity but do not want high-friction tracking workflows.
- Early pilot context: founder-led usage in India, desktop web.

Secondary audience:
- Internal stakeholders evaluating viability, usability, and pilot-readiness for broader rollout.

## Success Criteria
Pilot success is defined by measurable trust and usage quality signals:
- Parser accuracy: at least 95% on targeted bank message samples.
- Correction rate: declining over time, with a target of 15% or less by steady pilot usage.
- Time-to-value: user can set up account and save first transactions in under 5 minutes.
- Insight usefulness: user can consistently identify top spending categories and merchants from dashboard views.
- Pilot consistency: weekly active usage by the pilot user sustained through the pilot window.

Business objective:
- Demonstrate enough reliability and user value to validate pilot adoption intent.

## Pilot Plan
- Cohort: founder-led single-user pilot, with internal stakeholder walkthroughs for product and adoption feedback.
- Geography and platform: India-first, desktop web.
- Distribution path: internal rollout only during pilot; no public acquisition motion in v1.
- Exit criteria: reliability and correction targets are met consistently, confirming pilot adoption intent.

## Scope
In scope for v1:
- Single-user desktop web app
- SQLite local-first storage
- Generic parser baseline across multiple message formats
- Rule-based category inference with user override and learning loop
- Duplicate marking (save allowed, flagged for review)
- Three-card expense dashboard + running balance trend

Out of scope for v1:
- Multi-user collaboration
- Native mobile apps
- Cloud sync and automated cloud backup
- Deep historical import and reconciliation
- Advanced ML models and predictive analytics

## Risks and Mitigations
- Parsing variability risk: bank formats differ widely.
  - Mitigation: generic parser baseline + per-account format resolution + explicit correction flow.
- Trust risk from incorrect automation.
  - Mitigation: confidence gates, critical-field validators, undo/review patterns.
- Data resilience risk in local-first mode.
  - Mitigation: manual export checkpoints during pilot and clear data recovery guidance.
- Adoption risk for commercial transition.
  - Mitigation: pilot metrics tied to reliability and daily usefulness before scale decisions.

## Vision (2-3 Years)
If pilot signals are strong, this evolves into an Android-first commercial personal finance product launched via Play Store. The long-term direction is a privacy-conscious, low-friction finance companion that preserves the core message-to-ledger speed while expanding user reach and onboarding simplicity without compromising trust.
