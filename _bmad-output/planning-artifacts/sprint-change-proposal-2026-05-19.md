# Sprint Change Proposal - 2026-05-19

## 1) Issue Summary

### Problem Statement
Current onboarding behavior prompts account creation when the application starts in a clean state. This introduces unnecessary friction and does not match the intended requirement.

### Trigger Context
- Discovered during implementation validation while reviewing Epic 1 onboarding behavior against intended user flow.
- User-reported expectation:
  - First launch should open to dashboard with no accounts.
  - User pastes first transaction message and clicks Save.
  - System parses account and checks existence.
  - If account does not exist, system prompts account confirmation and opening balance.
  - If account exists, system saves transaction directly after validation.

### Why It Matters
- Reduces first-run friction.
- Aligns with core product promise: low-effort, privacy-first, paste-to-value workflow.
- Prevents setup-first UX from delaying first useful action.

## 2) Impact Analysis

### Epic Impact
- **Epic 1 affected**: Story 1.2 currently describes setup-first behavior and needs behavioral rewording.
- **Epic 2 impacted for alignment**: Existing save-time validation path already aligns conceptually and should remain the trigger point for conditional account creation.
- **Future epics unaffected structurally**: No new epic required.

### Story Impact
- **Story 1.2**: rename/refactor acceptance criteria to deferred account confirmation at first qualifying save.
- **Story context artifact for 1.2**: add correction note to prevent future mis-implementation.
- **No rollback needed** for completed Story 2.x.

### Artifact Conflicts
- **PRD conflict**: sections currently imply setup-first journey language.
- **Epics conflict**: Story 1.2 wording assumes account setup before normal capture flow.
- **UX conflict**: some language implies instant auto-save and does not explicitly model save-triggered conditional account prompt.
- **Sprint tracking gap**: no explicit course-correction log entry.

### Technical Impact
- Architecture is still valid; this is primarily requirements and flow-contract alignment.
- Existing deterministic save state machine can support corrected behavior with incremental implementation adjustment.
- No infra/deployment impact.

## 3) Recommended Approach

### Selected Path
**Option 1: Direct Adjustment** (recommended)

### Rationale
- The issue is a requirement/flow alignment problem, not a foundational architecture failure.
- Minimal disruption with high user experience value.
- Preserves current integrity constraints and deterministic behavior.

### Effort, Risk, Timeline
- **Effort**: Medium
- **Risk**: Low to Medium
- **Timeline impact**: Low (primarily doc/backlog alignment now; implementation alignment can be done in next dev cycle)

### Alternatives Considered
- **Rollback**: Not justified; high effort for low added value.
- **MVP Scope Review/Reduction**: Not needed; MVP remains achievable.

## 4) Detailed Change Proposals

### A) Stories / Epics

#### Story 1.2 in `_bmad-output/planning-artifacts/epics.md`

**OLD**
- Title: Create Account and Opening Balance Setup
- As a first-time user, I want to create an account from pasted transaction context and set an opening balance...
- AC: Given no account exists... when I confirm bank and account number and enter opening balance...

**NEW**
- Title: Deferred Account Confirmation on First Captured Transaction
- As a first-time user, I want to start from an empty dashboard and only be prompted for account details when save detects a new account...
- AC set:
  1. Given first launch with no accounts, when I open the app, then I see an empty dashboard with paste-ready capture.
  2. Given first pasted message and Save click, when parsed account does not exist, then system prompts account confirmation and opening balance before persist.
  3. Given parsed account exists and validation passes, then transaction saves directly.

**Justification**
- Implements friction-minimized onboarding while preserving ledger safety.

---

### B) PRD Changes

#### `_bmad-output/planning-artifacts/prd.md`

1. **Journey 1 Rising Action**

**OLD**
- User opens app, pastes first message, confirms account details if needed...

**NEW**
- User opens app to empty dashboard and paste-ready capture.
- On Save, system checks parsed account existence.
- If non-existing account, prompt confirmation + opening balance before persistence.
- If existing account, save directly after validation.

2. **Complete Feature Set - Core Journey Summary**

**OLD**
- New account setup, first message paste, account confirmation, opening balance entry, immediate dashboard insight.

**NEW**
- Empty dashboard on first launch, first message paste, conditional account confirmation/opening-balance only for new parsed account, immediate dashboard insight.

3. **Functional Requirements FR1/FR3 wording**

**OLD**
- FR1: Users can create a new account by pasting a transaction message and confirming bank and account number.
- FR3: Users can set an opening balance when creating a new account.

**NEW**
- FR1: When a pasted transaction resolves to a non-existing account, users can create that account by confirming bank and account number during save.
- FR3: During new-account creation triggered by first qualifying save, users can set opening balance before persistence.

**Justification**
- Connects account creation to save-time detection and preserves existing requirements scope.

---

### C) UX Specification Changes

#### `_bmad-output/planning-artifacts/ux-design-specification.md`

1. **Journey 1 flow**

**OLD**
- Save transaction instantly without user confirmation.

**NEW**
- Explicit Save action.
- First-run empty dashboard + capture surface.
- Save-triggered branch:
  - existing account -> save directly.
  - new account -> prompt account confirmation and opening balance before commit.

2. **Consistency Across Journeys**

**OLD**
- Journey 1: instant auto-save.

**NEW**
- Journey 1: explicit save-triggered flow with conditional account prompt for new accounts.

3. **Readiness Checklist**

**OLD**
- Core experience includes instant auto-save when confidence high.

**NEW**
- Core experience includes explicit save action and conditional account prompt only when save detects a new parsed account.

**Justification**
- Removes ambiguity and contradictions in safety-critical flow.

---

### D) Implementation Artifact + Sprint Tracking

#### `_bmad-output/implementation-artifacts/1-2-create-account-and-opening-balance-setup.md`

**OLD**
- Story intent and notes emphasize setup-first first-run UI behavior.

**NEW**
- Add "Correct Course Update" note clarifying that account-creation capability is conditional and save-triggered for new parsed accounts.
- Preserve historical implementation facts; append correction note instead of rewriting history.

#### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**NEW ADDITION**
- Add course-correction note capturing:
  - approved trigger,
  - impacted artifacts,
  - scope classification,
  - handoff target.

**Justification**
- Ensures continuity for future story generation, review, and implementation.

## 5) Implementation Handoff

### Scope Classification
**Moderate**

### Handoff Recipients
- **Product Owner / Developer**

### Responsibilities
- **Product Owner**:
  - Apply approved wording updates in PRD, Epics, and UX specification.
  - Confirm acceptance criteria remain testable and unambiguous.
- **Developer**:
  - Align current onboarding implementation with approved flow.
  - Ensure save-triggered account existence check behavior is deterministic.
  - Preserve existing validation gates and audit trail guarantees.

### Success Criteria
- First launch shows empty dashboard with no forced account setup.
- First account prompt appears only after first Save on parsed non-existing account.
- Existing-account path saves directly after validation.
- Updated planning artifacts consistently describe the same flow.

## Appendix - Checklist Outcome Snapshot

- Section 1 (Trigger/Context): Completed
- Section 2 (Epic Impact): Completed; Story 1.2 update required
- Section 3 (Artifact Impact): Completed; PRD/Epics/UX + implementation notes impacted
- Section 4 (Path Forward): Direct Adjustment selected
- Section 5 (Proposal Components): Completed in this document
- Section 6 (Approval/Handoff): Completed with explicit user approval on 2026-05-19
