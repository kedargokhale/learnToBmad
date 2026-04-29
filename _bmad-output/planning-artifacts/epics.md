---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-01-requirements-extracted
  - step-02-design-epics
  - step-02-epics-approved
  - step-03-stories-generated
  - step-04-final-validation
  - workflow-complete
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# learnToBmad - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for learnToBmad, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Users can create a new account by pasting a transaction message and confirming bank and account number.
FR2: System can uniquely identify accounts using a composite key of bank name and account number.
FR3: Users can set an opening balance when creating a new account.
FR4: System maintains a going-forward-only transaction ledger.
FR5: Users can view current account balance and transaction history.
FR6: Users can paste a single bank transaction message and capture it into the system.
FR7: System can extract critical fields from bank messages: amount, debit or credit, date, bank name, account number, and merchant or payee.
FR8: System detects account format variance in messages and prompts users to resolve mismatches.
FR9: System supports a generic parser baseline for common bank message formats without requiring bank-specific templates.
FR10: System provides parse feedback immediately after paste.
FR11: System blocks transaction save if any critical field is missing and explains what is required.
FR12: System detects duplicate transactions and flags them while allowing save with a possible-duplicate marker.
FR13: Users can review blocked saves, correct missing or ambiguous fields, and retry save.
FR14: System enforces deterministic state transitions for parse, validate, save, and dashboard refresh.
FR15: System provides a predefined Level 2 category taxonomy at first use.
FR16: System can suggest a transaction category and allow user override.
FR17: System can learn from user corrections and apply improved categorization over time.
FR18: Users can edit category assignment for any transaction retroactively.
FR19: System reflects category changes in dashboard views.
FR20: System displays a category dominance view showing expense breakdown by category.
FR21: System displays a merchant focus view showing top merchants with frequency and amount.
FR22: System displays a trend alert view showing significant spending changes compared to a moving-average baseline.
FR23: System displays a running balance trend line over time.
FR24: Users can select dashboard time windows using standard preset options.
FR25: Dashboard views update after new transactions are saved.
FR26: Users can export transactions and account metadata to a local file in deterministic versioned format.
FR27: System encrypts exported files at rest.
FR28: System validates imported files for integrity before committing transactions.
FR29: System detects duplicate transactions during import and provides auto-skip and manual-review resolution modes.
FR30: Import conflicts require explicit user resolution before final commit.
FR31: Users can complete all core flows using either mouse or keyboard, and full keyboard-only operation is supported for accessibility.
FR32: System provides visible focus indicators for interactive elements.
FR33: System maintains sufficient color contrast for text and key indicators aligned to WCAG 2.1 AA baseline.
FR34: System provides semantic labels and error messaging compatible with assistive technologies.
FR35: System uses clear heading and landmark structure for predictable navigation.
FR36: System interface works correctly in the packaged Windows desktop runtime using WebView2.
FR37: System stores transaction and account data locally on the user device without automatic external transmission.
FR38: System maintains transaction and correction history for user-level auditability.
FR39: Export operations are user-initiated.
FR40: Users control where exported files are stored.

### NonFunctional Requirements

NFR1: System must provide parse feedback within 1 second for a single pasted message under normal desktop operating conditions.
NFR2: System must provide transaction save confirmation within 1 second under normal desktop operating conditions.
NFR3: Dashboard views must refresh to reflect newly saved transactions within 2 seconds under normal desktop operating conditions.
NFR4: Performance targets are measured for local-first deployment and are not dependent on remote network conditions.
NFR5: All transaction and account data must remain local to the user device by default, with no automatic external transmission.
NFR6: Exported data files must be encrypted at rest.
NFR7: Export workflow must not require password or passphrase entry in MVP.
NFR8: Local database encryption at rest is deferred and not required for MVP.
NFR9: System must maintain transaction and correction history sufficient for user-level auditability.
NFR10: System must enforce zero-tolerance for saving transactions with missing critical fields.
NFR11: Import operations must be atomic, with full commit or full rollback.
NFR12: System must not perform silent data mutation during parse, save, export, or import flows.
NFR13: System must preserve ledger consistency across restart and reload events.
NFR14: Duplicate detection and conflict handling outcomes must be deterministic for the same input dataset and ruleset.
NFR15: Export format must be versioned and backward-compatible with at least one prior supported schema version.
NFR16: Import validation must complete before any ledger write begins.
NFR17: Import conflict resolution must support both auto-skip and manual review modes without violating atomicity guarantees.
NFR18: Core flows should support keyboard navigation and visible focus states where technically feasible in MVP.
NFR19: UI text and error states should maintain readable contrast and clear labeling where technically feasible in MVP.
NFR20: Accessibility conformance testing is best-effort in MVP and formal WCAG 2.1 AA compliance sign-off is deferred.

### Additional Requirements

- Starter template requirement: initialize implementation with Tauri v2 + React + TypeScript + Vite using create-tauri-app; this must be Epic 1 Story 1.
- Add and configure Tauri SQL plugin with SQLite support at project start.
- Enforce domain-level validation gates before every write path (manual save, correction save, import commit).
- Standardize frontend to native command error envelope with code, message, and remediation hint.
- Implement validate-first and atomic-commit import pipeline.
- Apply ordered, versioned SQLite migrations at startup in a transaction.
- Use typed frontend-to-Tauri command boundary and avoid external API dependency for MVP core flows.
- Use Zustand feature-scoped slices for state management.
- Use React Hook Form with Zod for field and form constraints.
- Use Tailwind CSS aligned to UX design tokens and consistency rules.
- Implement local diagnostic logging with structured entries and rotation.
- Package for Windows as MSI and EXE via Tauri build pipeline.
- Establish CI baseline for build, lint, unit tests, and smoke E2E on Windows.
- Restrict native capabilities to only what is required for local-first flows.
- Enforce local-first privacy invariant as architecture rule: no external network calls for core operations.

### UX Design Requirements

UX-DR1: Define and implement semantic design tokens for confidence, warning, error, success, and neutral states.
UX-DR2: Define and implement product design tokens for color, typography, spacing, radius, and elevation with consistent usage across screens.
UX-DR3: Implement a desktop-first two-column layout at 1200px+ with capture and correction on the left and dashboard insights on the right.
UX-DR4: Enforce desktop-only MVP layout support with a minimum width of 1024px in packaged Windows runtime (WebView2); document tablet/mobile behavior as post-MVP.
UX-DR5: Build TransactionInput as a paste-ready surface that triggers immediate parse feedback after paste.
UX-DR6: Build ReadinessStatus to show parse status, missing field status, duplicate state, and save readiness using icon plus label plus semantic state.
UX-DR7: Build CorrectionPanel with focused field-level correction, examples, and real-time validation feedback.
UX-DR8: Build ConfidenceIndicator with numeric confidence and qualitative level to explain parser confidence.
UX-DR9: Build ValidationBadge states for ready-to-save, needs-review, blocked, and duplicate-flagged.
UX-DR10: Build StoryCard components for category dominance, merchant focus, and trend alert insights.
UX-DR11: Build InsightSummary dashboard region that presents story cards in responsive grid behavior.
UX-DR12: Apply progressive disclosure for validation: compact state first, then expanded detail only when user focuses or requests details.
UX-DR13: Use friendly and specific error copy that states what is missing and provides actionable examples.
UX-DR14: Keep primary action labels minimal and outcome-oriented (for example Save and Done), with contextual secondary actions.
UX-DR15: Provide explicit disabled-state reasons for blocked actions so every blocked save or action explains the next fix.
UX-DR16: Enforce keyboard-first interaction patterns including predictable tab order, Enter to submit, Escape to cancel, and visible focus rings.
UX-DR17: Maintain non-color-only communication for critical states by combining icon, label, and color.
UX-DR18: Provide immediate success confirmations for save and correction completion without disruptive modal flows.
UX-DR19: Provide deterministic empty states with clear next actions for no transactions and no insights.
UX-DR20: Implement parse failure fallback to manual field entry flow with required fields and re-validation before save.
UX-DR21: Preserve in-progress capture context and correction state during local navigation so user work is not unexpectedly lost.
UX-DR22: Ensure core flows remain fully offline-first and resilient without cloud dependencies.

### FR Coverage Map

FR1: Epic 1 - New account creation from pasted message
FR2: Epic 1 - Composite account identity model
FR3: Epic 1 - Opening balance setup
FR4: Epic 1 - Going-forward ledger model
FR5: Epic 1 - Account balance and history visibility
FR6: Epic 2 - Single-message capture workflow
FR7: Epic 2 - Critical-field extraction from message text
FR8: Epic 2 - Account format mismatch resolution
FR9: Epic 2 - Generic parser baseline coverage
FR10: Epic 2 - Immediate parse feedback
FR11: Epic 2 - Hard block on incomplete critical fields
FR12: Epic 2 - Duplicate flag with save-allowed behavior
FR13: Epic 2 - Guided correction and retry flow
FR14: Epic 2 - Deterministic parse-validate-save-refresh loop
FR15: Epic 3 - Day-1 predefined category taxonomy
FR16: Epic 3 - Suggested category with override
FR17: Epic 3 - Correction-informed category improvement
FR18: Epic 3 - Retroactive category editing
FR19: Epic 3 - Insight refresh on category edits
FR20: Epic 3 - Category dominance insight
FR21: Epic 3 - Merchant focus insight
FR22: Epic 3 - Trend alert insight
FR23: Epic 3 - Running balance trend line
FR24: Epic 3 - Standard dashboard time presets
FR25: Epic 3 - Dashboard update after save
FR26: Epic 4 - Deterministic versioned export
FR27: Epic 4 - Encrypted export files
FR28: Epic 4 - Integrity validation before import commit
FR29: Epic 4 - Import duplicate handling modes
FR30: Epic 4 - Explicit conflict resolution before final commit
FR31: Epic 5 - Full core-flow keyboard usability
FR32: Epic 5 - Visible focus indicators
FR33: Epic 5 - Accessible contrast for key UI states
FR34: Epic 5 - Semantic labels and assistive-compatible errors
FR35: Epic 5 - Predictable heading and landmark structure
FR36: Epic 1 - Supported packaged desktop runtime correctness (Windows/WebView2)
FR37: Epic 1 - Local-only data storage default
FR38: Epic 2 - Transaction and correction auditability
FR39: Epic 4 - User-initiated export control
FR40: Epic 4 - User-selected export destination control

## Epic List

### Epic 1: Start Private Ledger and Account Baseline
Users can initialize a private local ledger, create and identify accounts, set opening balance, and begin safe tracking on supported desktop runtime targets.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR37

### Epic 2: Capture Transactions with Safe Validation and Corrections
Users can paste bank messages, receive immediate parse feedback, resolve missing or ambiguous fields, and save only deterministic valid records with audit history.
**FRs covered:** FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR38

### Epic 3: Understand Spending Through Smart Categorization and Live Insights
Users can receive actionable category and merchant insights, see trend and balance movement, and improve categorization over time with editable history.
**FRs covered:** FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25

### Epic 4: Export and Import Safely for Portability and Recovery
Users can securely export and restore local data through deterministic, encrypted, and integrity-validated flows with explicit conflict decisions.
**FRs covered:** FR26, FR27, FR28, FR29, FR30, FR39, FR40

### Epic 5: Operate Accessibly with Keyboard-First Confidence
Users can complete all core workflows with keyboard-first access, visible focus, semantic structure, and assistive-friendly error handling.
**FRs covered:** FR31, FR32, FR33, FR34, FR35, FR36

<!-- Repeat for each epic in epics_list (N = 1, 2, 3...) -->

## Epic 1: Start Private Ledger and Account Baseline

Users can initialize a private local ledger, create and identify accounts, set opening balance, and begin safe tracking on supported desktop runtime targets.

### Story 1.1: Set up initial project from starter template

As a privacy-conscious user,
I want the app initialized with a local-first desktop foundation,
So that my financial workflows run without cloud dependency.

**Acceptance Criteria:**

**Given** a fresh repository
**When** the project is scaffolded with Tauri v2 + React + TypeScript + Vite and SQLite plugin support
**Then** the app can run locally in development and build Windows artifacts
**And** no core feature path requires external network connectivity.

### Story 1.2: Create Account and Opening Balance Setup

As a first-time user,
I want to create an account from pasted transaction context and set an opening balance,
So that I can start a reliable, forward-only ledger.

**Acceptance Criteria:**

**Given** no account exists for a bank/account-number pair
**When** I confirm bank and account number and enter opening balance
**Then** a new account is created using bank+account-number composite uniqueness
**And** the ledger starts from that opening balance in going-forward-only mode.

### Story 1.3: View Account Ledger Baseline

As a user,
I want to view current balance and transaction history for an account,
So that I can verify ledger state before ongoing capture.

**Acceptance Criteria:**

**Given** an account with opening balance and saved transactions
**When** I open the ledger view
**Then** I can see current balance and ordered transaction history
**And** results are consistent after app restart or reload.

### Story 1.4: Enforce Local Storage and Desktop Runtime Guardrails

As a user,
I want explicit local-only data handling and runtime compatibility checks,
So that I can trust platform behavior and compatibility.

**Acceptance Criteria:**

**Given** app runtime configuration
**When** core flows are executed in supported Windows targets with required WebView2 runtime
**Then** capture, save, and dashboard entry paths behave correctly in the packaged desktop app
**And** transaction/account data is stored locally without automatic external transmission.

## Epic 2: Capture Transactions with Safe Validation and Corrections

Users can paste bank messages, receive immediate parse feedback, resolve missing or ambiguous fields, and save only deterministic valid records with audit history.

### Story 2.1: Paste-to-Parse Transaction Capture

As a user,
I want to paste a bank message and receive immediate parsed output,
So that I can capture transactions with minimal effort.

**Acceptance Criteria:**

**Given** the capture screen with a paste-ready input
**When** I paste a supported bank message
**Then** critical fields are parsed and presented with readiness status quickly
**And** parse feedback is available within the local performance target.

**Given** the capture screen with a paste-ready input
**When** I paste an unsupported or malformed message
**Then** no transaction is saved
**And** the UI shows a clear parse-failure state with a guided next action.

### Story 2.2: Critical-Field Validation Gate Before Save

As a user,
I want unsafe saves blocked with clear reasons,
So that incomplete transactions never enter my ledger.

**Acceptance Criteria:**

**Given** one or more critical fields are missing or ambiguous
**When** I attempt to save
**Then** save is blocked with explicit missing-field guidance
**And** no ledger write occurs until all critical fields are valid.

**Given** an attempted save is blocked by validation
**When** the user reviews the ledger state
**Then** no partial write or implicit mutation exists
**And** previously saved data remains unchanged.

### Story 2.3: Guided Correction and Retry Flow

As a user,
I want focused correction for flagged fields,
So that I can recover quickly and complete capture safely.

**Acceptance Criteria:**

**Given** parse issues are detected
**When** I open correction controls
**Then** only required fields and format guidance are shown with real-time validation
**And** I can retry save immediately after corrections pass validation.

### Story 2.4: Account Mismatch Resolution and Duplicate Flagging

As a user,
I want account mismatches and duplicates handled transparently,
So that I can avoid silent ledger corruption.

**Acceptance Criteria:**

**Given** a parsed message with account format mismatch or possible duplicate
**When** the system evaluates save readiness
**Then** mismatch requires explicit resolution before write
**And** duplicates are flagged with user-visible choice while preserving deterministic outcomes.

**Given** both account mismatch and duplicate signals are present
**When** the user resolves mismatch but does not resolve duplicate choice
**Then** the save path remains blocked where explicit decision is required
**And** final behavior is deterministic for the same inputs.

### Story 2.5: Deterministic Save State Machine and Audit Trail

As a user,
I want deterministic parse-validate-save-refresh behavior with history,
So that repeated inputs produce predictable trusted results.

**Acceptance Criteria:**

**Given** the same message input and ruleset
**When** the parse-validate-save flow is executed repeatedly
**Then** outcomes are deterministic and dashboard refresh follows successful save
**And** transaction and correction history is persisted for auditability.

**Given** a save attempt fails validation or command execution
**When** the flow returns control to the user
**Then** dashboard totals and trends do not refresh from unsaved data
**And** no hidden ledger mutation is introduced.

## Epic 3: Understand Spending Through Smart Categorization and Live Insights

Users can receive actionable category and merchant insights, see trend and balance movement, and improve categorization over time with editable history.

### Story 3.1: Day-1 Category Taxonomy and Suggested Categorization

As a user,
I want predefined categories and initial category suggestions,
So that insights are useful from the first transactions.

**Acceptance Criteria:**

**Given** a newly initialized app
**When** transactions are parsed and saved
**Then** each transaction is assigned a suggested category from the predefined taxonomy
**And** I can override the suggestion before or after save.

### Story 3.2: Learning from Category Corrections

As a repeat user,
I want the system to learn from my corrections,
So that future categorization accuracy improves.

**Acceptance Criteria:**

**Given** I correct category assignments over time
**When** similar transactions are captured later
**Then** categorization suggestions reflect learned patterns
**And** learned behavior remains explainable and editable.

### Story 3.3: Category and Merchant Insight Cards

As a user,
I want clear category and merchant insight cards,
So that I can quickly understand where money is going.

**Acceptance Criteria:**

**Given** saved categorized transactions exist
**When** I view the dashboard
**Then** category dominance and merchant focus cards render current period insights
**And** insight content updates after new saves.

### Story 3.4: Trend Alerts and Running Balance Visualization

As a user,
I want trend alerts and running balance visualization,
So that I can monitor spending changes and financial trajectory.

**Acceptance Criteria:**

**Given** historical transactions across time windows
**When** I open dashboard trends
**Then** trend alert logic compares against baseline and flags significant changes
**And** running balance trend is displayed correctly for selected preset windows.

### Story 3.5: Capture Surface and Readiness State Components

As a user,
I want capture components that clearly communicate save readiness,
So that I can move from paste to safe save with minimal confusion.

**Acceptance Criteria:**

**Given** the capture screen
**When** I paste or edit a transaction message
**Then** TransactionInput and ReadinessStatus are available with consistent semantic states
**And** blocked, needs-review, ready, and duplicate states are visibly distinguishable.

**Given** parse and validation complete successfully
**When** I return focus to capture
**Then** readiness state remains consistent and save action availability matches the current validation result.

### Story 3.6: Correction and Confidence Guidance Components

As a user,
I want focused correction and confidence guidance,
So that I can resolve issues quickly and understand parsing risk before saving.

**Acceptance Criteria:**

**Given** required fields are missing or ambiguous
**When** I open correction controls
**Then** CorrectionPanel shows only relevant field guidance
**And** save remains blocked until critical completeness is restored.

**Given** parse confidence is available
**When** I review parsed output
**Then** ConfidenceIndicator displays numeric confidence with qualitative level
**And** confidence messaging does not bypass hard critical-field validation gates.

### Story 3.7: Insight Summary Story Components

As a user,
I want insight components that present category, merchant, and trend narratives clearly,
So that I can quickly understand spending outcomes after each save.

**Acceptance Criteria:**

**Given** categorized transactions exist
**When** I view the dashboard
**Then** StoryCard and InsightSummary components render category, merchant, and trend insights in a consistent layout
**And** values update after successful transaction saves.

**Given** there are no eligible transactions for an insight card
**When** I view the dashboard
**Then** a deterministic empty state is shown
**And** the UI provides a clear next action.

### Story 3.8: Progressive Disclosure and Confirmation Feedback

As a user,
I want validation detail and confirmations to appear only when needed,
So that I can stay focused while still recovering quickly from issues.

**Acceptance Criteria:**

**Given** parse and validation have completed
**When** no issues are present
**Then** the interface remains compact with a clear ready-to-save signal
**And** detailed guidance is hidden by default.

**Given** a save or correction completes successfully
**When** the operation finishes
**Then** the UI shows immediate non-disruptive success confirmation
**And** does not require modal acknowledgment to continue.

**Given** validation fails
**When** guidance is shown
**Then** error copy is friendly and actionable
**And** each message states the next safe user action.

## Epic 4: Export and Import Safely for Portability and Recovery

Users can securely export and restore local data through deterministic, encrypted, and integrity-validated flows with explicit conflict decisions.

### Story 4.1: Deterministic Versioned Export Generation

As a user,
I want deterministic local exports with schema version metadata,
So that I can backup and move data reliably.

**Acceptance Criteria:**

**Given** existing ledger and account data
**When** I initiate export
**Then** the system writes a local export file with explicit version metadata
**And** repeating export on unchanged data produces deterministic content semantics.

### Story 4.2: Encrypted Export at Rest

As a user,
I want exported backups encrypted by default,
So that my financial data remains protected outside the app.

**Acceptance Criteria:**

**Given** an export operation is requested
**When** the backup file is created
**Then** file payload is encrypted at rest without requiring MVP passphrase flow
**And** decryption is only possible via supported import path.

### Story 4.3: Validate-First Atomic Import

As a user,
I want import files validated before any write,
So that corrupt or incompatible backups cannot partially damage my ledger.

**Acceptance Criteria:**

**Given** an import file is selected
**When** integrity and schema validation fails
**Then** the import is rejected before any ledger write
**And** when validation passes, import commit runs atomically (all-or-nothing).

**Given** an import file is malformed, corrupted, or on an unsupported schema version
**When** validation is executed
**Then** the system returns a specific rejection reason
**And** database state remains unchanged.

### Story 4.4: Duplicate Conflict Resolution Modes

As a user,
I want explicit duplicate handling choices during import,
So that I stay in control of merge outcomes.

**Acceptance Criteria:**

**Given** import contains transactions that conflict with existing records
**When** duplicate analysis completes
**Then** I can choose auto-skip or manual review paths
**And** final commit occurs only after explicit resolution decisions.

**Given** manual review mode has unresolved conflicts
**When** I attempt to finalize import
**Then** commit is blocked with unresolved-count feedback
**And** no partial commit is applied.

### Story 4.5: User-Controlled Export/Import Surfaces

As a user,
I want full control of when and where backups are written,
So that portability remains private and intentional.

**Acceptance Criteria:**

**Given** backup or restore workflow is opened
**When** I select local file destinations and files
**Then** export is only user-initiated and destination is user-selected
**And** no automatic upload or background sharing occurs.

## Epic 5: Operate Accessibly with Keyboard-First Confidence

Users can complete all core workflows with keyboard-first access, visible focus, semantic structure, and assistive-friendly error handling.

### Story 5.1: Keyboard-Only Core Flow Completion

As a keyboard user,
I want to complete capture, correction, save, and dashboard actions without a mouse,
So that the app is efficient and accessible.

**Acceptance Criteria:**

**Given** core workflow screens
**When** I navigate with keyboard only
**Then** tab order is predictable across interactive controls
**And** Enter and Escape behavior follows documented action semantics.

### Story 5.2: Visible Focus and Non-Color State Communication

As an accessibility-focused user,
I want clear focus indicators and state cues beyond color,
So that I can always understand current context and status.

**Acceptance Criteria:**

**Given** interactive controls and validation states
**When** navigating or encountering status changes
**Then** focus ring visibility is maintained across components
**And** state meaning is conveyed via icon, label, and color together.

### Story 5.3: Semantic Labels, Errors, and Landmarks

As a screen-reader or assistive-tech user,
I want semantic structure and understandable errors,
So that I can navigate and recover effectively.

**Acceptance Criteria:**

**Given** forms, alerts, and page sections
**When** assistive technology reads the interface
**Then** labels, headings, landmarks, and error associations are semantic and clear
**And** correction guidance uses concise actionable language.

### Story 5.4: Accessibility and Compatibility Verification Baseline

As a product owner,
I want baseline accessibility and desktop runtime compatibility checks in core workflows,
So that quality remains stable on supported desktop targets.

**Acceptance Criteria:**

**Given** packaged Windows runtime test environments with required WebView2 runtime
**When** core journeys are validated
**Then** key accessibility behaviors (keyboard, focus, contrast, semantics) pass defined checks
**And** regressions are visible through repeatable verification steps.

**Given** packaged Windows runtime checks across supported target machines
**When** capture, correction, save, and dashboard flows are exercised
**Then** interface behavior is functionally consistent with the PRD desktop runtime target
**And** deviations are documented as release-blocking defects.
