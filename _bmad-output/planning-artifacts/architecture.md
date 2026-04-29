---
stepsCompleted:
  - step-01-init
  - step-02-context
  - step-03-starter
  - step-04-decisions
  - step-05-patterns
  - step-06-structure
  - step-07-validation
  - step-08-complete
status: 'complete'
completedAt: '2026-04-28'
lastStep: 8
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/product-brief-learnToBmad-distillate.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
workflowType: 'architecture'
project_name: 'learnToBmad'
user_name: 'Kd'
date: '2026-04-28'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

40 FRs across 8 domains: Account & Ledger Management (FR1-5), Transaction Capture & Parsing (FR6-10), Data Validation & Safety Gates (FR11-14), Categorization & Category Learning (FR15-19), Dashboard Insights & Visualization (FR20-25), Data Export/Import & Portability (FR26-30), UI & Accessibility (FR31-36), Privacy & Local-First Data Handling (FR37-40).

The functional model centers on a strict parse-validate-save-refresh loop. Every flow must be deterministic. No silent data mutations are permitted across any operation. The parser is a first-class domain engine, not a utility function.

**Non-Functional Requirements:**

20 NFRs across: Performance (NFR1-4: parse <1s, save <1s, dashboard refresh <2s, local-only baseline), Security (NFR5-9: local-only data, encrypted exports, no mandatory passphrase in MVP, DB encryption deferred), Reliability & Data Integrity (NFR10-14: zero-tolerance missing-field saves, atomic import, no silent mutations, ledger consistency across restart, deterministic duplicate handling), Integration Quality (NFR15-17: versioned export format, pre-write import validation, atomic import conflict resolution), Accessibility (NFR18-20: keyboard navigation, readable contrast, WCAG 2.1 AA best-effort).

NFR10 (zero missing-field saves) and NFR12 (no silent mutation) are the highest-integrity constraints and must be enforced at the domain model layer, not just UI.

**Scale & Complexity:**

- Primary domain: Desktop-first SPA (full-stack, local-first)
- Complexity level: High — driven by data integrity guarantees, parser correctness, state machine design, and correction-learning loop, not by infrastructure or user scale
- Estimated architectural domains: 8 (parser engine, validation gate, category/rules engine, transaction ledger, dashboard/insights, export-import, correction flow, local persistence layer)

### Technical Constraints & Dependencies

- **Runtime environment:** Packaged Windows desktop app (Tauri v2) using WebView2 runtime (MVP)
- **Persistence:** SQLite local-first; no cloud database, no remote API calls for core flows
- **Deployment model:** Local-first means no backend server is required for core functionality; any local server (if used) is a local process, not a network service
- **Parsing strategy:** Generic baseline only in MVP; no bank-specific templates yet
- **Categorization:** Rules + heuristics only; no ML in MVP
- **Export encryption:** Encrypted at rest without user passphrase in MVP (means key management is a design decision)
- **Runtime matrix:** Windows desktop packaged runtime with WebView2; no standalone browser support and no mobile

### Cross-Cutting Concerns Identified

- **Data integrity enforcement:** Zero-tolerance save gates (FR11, NFR10) must be enforced uniformly across direct save, import, and any future batch flows — not just in UI validation
- **Deterministic state transitions:** Parse, validate, save, and dashboard refresh must yield identical outcomes for identical inputs (NFR14); this shapes the domain model and test strategy
- **Confidence signaling:** Parse confidence and category confidence are first-class outputs of the parser and categorizer, not display-layer decorations; they drive save-gate behavior
- **Local-first privacy boundary:** No external network calls for any core operation; this must be enforced as an architecture invariant, not just a deployment choice
- **Correction-informed learning:** User corrections feed back into the categorization rule store; this is a stateful feedback loop that spans UI, domain logic, and persistence layers
- **Audit trail:** Transaction and correction history must be maintained for user-level auditability (FR38, NFR9); this is a persistence schema concern, not an afterthought
- **Export schema versioning:** Versioned export format (NFR15) requires a schema registry or version migration strategy from day one

## Starter Template Evaluation

### Primary Technology Domain

Desktop-first SPA with local-first persistence, based on project requirements analysis.

### Starter Options Considered

- **Option A - Pure Browser SPA** (Vite + React + SQLite WASM + OPFS): Zero-install and browser-only delivery. Not selected due to higher implementation complexity for robust encrypted export/import behavior and local-storage lifecycle concerns for a finance ledger.
- **Option B - Tauri v2 Desktop App** (selected): Thin Rust shell wraps the same Vite + React UI and provides native SQLite, native file dialogs, and straightforward installer packaging for Windows.

### Selected Starter: create-tauri-app (Tauri v2 + React + TypeScript + Vite)

**Rationale for Selection:**

This starter best matches the project's local-first fintech constraints for personal use and demo. It keeps the frontend developer experience in React + TypeScript while providing native capabilities needed for reliable local data handling and packaging.

**Initialization Command:**

```bash
npm create tauri-app@latest
# Prompts: TypeScript / JavaScript -> pnpm -> React -> TypeScript

# Add SQL plugin:
npm run tauri add sql

# In src-tauri/:
cargo add tauri-plugin-sql --features sqlite
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
TypeScript for frontend logic and Rust for desktop shell/runtime integration.

**Styling Solution:**
Not imposed by starter; to be finalized in architectural decisions (Tailwind CSS is preferred by UX direction).

**Build Tooling:**
Vite-based frontend build and development loop, wrapped by Tauri's desktop runtime.

**Testing Framework:**
Not imposed by starter; testing stack will be selected in the architecture decisions step.

**Code Organization:**
Frontend app code in `src/` and desktop/native integration in `src-tauri/`, with clean separation of UI and runtime concerns.

**Development Experience:**
`npm run tauri dev` gives live frontend iteration with desktop-window runtime; `npm run tauri build` produces distributable installers.

**Note:** Project initialization using this command should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

- Local data persistence is SQLite via Tauri SQL plugin with versioned migrations at startup.
- Domain-level validation gates are required before every write path (manual entry, correction save, import commit).
- Error contract is standardized across frontend and native command boundary.
- Import pipeline must be validate-first and atomic-commit.

**Important Decisions (Shape Architecture):**

- Frontend state management uses Zustand with explicit store slices.
- Form and validation stack uses React Hook Form + Zod.
- Routing uses React Router with minimal route surface for desktop-first flows.
- Styling direction uses Tailwind CSS aligned with UX design tokens and consistency rules.
- Logging is local-file based with rotation and clear severity levels.

**Deferred Decisions (Post-MVP):**

- Full database-at-rest encryption.
- Auto-update infrastructure and signed update channels.
- Multi-user authentication and role-based authorization.

### Data Architecture

- Database engine: SQLite via `tauri-plugin-sql`.
- Migration strategy: ordered, versioned migrations applied at startup in a transaction.
- Data validation strategy: schema validation + domain guards before persistence.
- Caching strategy: lightweight in-memory cache for derived dashboard summaries only.

### Authentication & Security

- Authentication: none for MVP (single local personal user).
- Authorization: not required in MVP.
- Data protection: encrypted export files are required; local DB encryption deferred.
- Security boundaries: do not enable unnecessary native capabilities.
- Import safety: strict schema validation, file-size guardrails, and deterministic failure modes.

### API & Communication Patterns

- External API: none for MVP core flows.
- Communication model: typed frontend-to-Tauri command boundary.
- Error handling standard: unified error envelope with code, message, and remediation hint.
- Rate limiting: not applicable for local single-user command execution.

### Frontend Architecture

- State management: Zustand with feature-scoped slices and selector-driven reads.
- Forms and validation: React Hook Form + Zod for field and form constraints.
- Routing: React Router with explicit route contracts.
- Performance posture: memoized selectors, bounded re-render zones, and batched dashboard recompute.
- UI system: Tailwind CSS utility-first implementation guided by UX specification.

### Infrastructure & Deployment

- Packaging target: Windows `.msi` and `.exe` bundles from Tauri build.
- CI baseline: build + lint + unit test + smoke E2E on Windows target.
- Environment model: local development and production only for MVP.
- Monitoring/logging: local diagnostic logs with structured entries and rotation.
- Scaling model: single-user local execution; no server-side horizontal scaling requirements.

### Decision Impact Analysis

**Implementation Sequence:**

1. Initialize project from selected starter
2. Establish persistence layer and migrations
3. Implement domain validation and command boundary contracts
4. Build capture/correction/save state flows
5. Implement dashboard derivations and performance tuning
6. Implement export/import integrity and encryption flows
7. Add test layers (unit, integration, E2E)

**Cross-Component Dependencies:**

- Validation contracts affect parser output, save logic, import handling, and dashboard trustworthiness.
- Migration and schema choices affect command contracts, selectors, and export/import format.
- Error envelope standard affects all command handlers and UI state transitions.
- State-slice boundaries affect component decomposition and test organization.

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
learnToBmad/
├── README.md
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── eslint.config.js
├── .prettierrc
├── .gitignore
├── .env.example
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release-windows.yml
├── e2e/
│   ├── capture-flow.spec.ts
│   ├── correction-flow.spec.ts
│   ├── import-export.spec.ts
│   └── fixtures/
│       ├── sample-messages.json
│       └── sample-backups/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── app/
│   │   ├── routes.tsx
│   │   ├── providers.tsx
│   │   └── error-boundary.tsx
│   ├── features/
│   │   ├── capture/
│   │   │   ├── components/
│   │   │   │   ├── TransactionInput.tsx
│   │   │   │   ├── ReadinessStatus.tsx
│   │   │   │   └── CorrectionPanel.tsx
│   │   │   ├── schema.ts
│   │   │   ├── service.ts
│   │   │   ├── store.ts
│   │   │   ├── selectors.ts
│   │   │   └── capture.test.ts
│   │   ├── ledger/
│   │   │   ├── components/
│   │   │   ├── schema.ts
│   │   │   ├── service.ts
│   │   │   ├── store.ts
│   │   │   ├── selectors.ts
│   │   │   └── ledger.test.ts
│   │   ├── categorization/
│   │   │   ├── components/
│   │   │   ├── schema.ts
│   │   │   ├── service.ts
│   │   │   ├── store.ts
│   │   │   └── categorization.test.ts
│   │   ├── dashboard/
│   │   │   ├── components/
│   │   │   │   ├── StoryCard.tsx
│   │   │   │   ├── InsightSummary.tsx
│   │   │   │   └── BalanceTrend.tsx
│   │   │   ├── service.ts
│   │   │   ├── selectors.ts
│   │   │   └── dashboard.test.ts
│   │   ├── import-export/
│   │   │   ├── components/
│   │   │   ├── schema.ts
│   │   │   ├── service.ts
│   │   │   ├── store.ts
│   │   │   └── import-export.test.ts
│   │   └── settings/
│   │       ├── components/
│   │       ├── service.ts
│   │       └── settings.test.ts
│   ├── shared/
│   │   ├── components/ui/
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── types/
│   │   ├── constants/
│   │   ├── error/
│   │   │   ├── error-codes.ts
│   │   │   └── map-error.ts
│   │   └── formatters/
│   ├── styles/
│   │   ├── app.css
│   │   └── tokens.css
│   └── test/
│       ├── setup.ts
│       └── utils.ts
├── src-tauri/
│   ├── Cargo.toml
│   ├── build.rs
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   ├── migrations/
│   │   ├── 0001_init.sql
│   │   ├── 0002_categories.sql
│   │   └── 0003_import_audit.sql
│   └── src/
│       ├── main.rs
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── capture.rs
│       │   ├── ledger.rs
│       │   ├── categorization.rs
│       │   ├── dashboard.rs
│       │   ├── import_export.rs
│       │   └── settings.rs
│       ├── db/
│       │   ├── mod.rs
│       │   ├── connection.rs
│       │   └── migrations.rs
│       ├── security/
│       │   ├── mod.rs
│       │   ├── encryption.rs
│       │   └── hashing.rs
│       ├── errors/
│       │   ├── mod.rs
│       │   └── app_error.rs
│       └── models/
│           ├── mod.rs
│           ├── transaction.rs
│           └── account.rs
└── docs/
    ├── architecture/
    ├── api-contracts/
    └── test-strategy/
```

### Architectural Boundaries

- **API boundaries:** No external backend API in MVP. Typed Tauri command boundary separates React frontend from native Rust layer.
- **Component boundaries:** Each feature module owns its UI components, schema, store, selectors, and service adapter.
- **Service boundaries:** Command handlers split by domain in `src-tauri/src/commands/` with shared `db/` and `errors/` modules.
- **Data boundaries:** SQLite schema and migrations managed exclusively in `src-tauri/migrations/` and `src-tauri/src/db/`.

### Requirements to Structure Mapping

- **Transaction capture & correction (FR6-14)** → `src/features/capture/` + `src-tauri/src/commands/capture.rs`
- **Account & ledger management (FR1-5)** → `src/features/ledger/` + `src-tauri/src/commands/ledger.rs`
- **Categorization & learning (FR15-19)** → `src/features/categorization/` + `src-tauri/src/commands/categorization.rs`
- **Dashboard insights (FR20-25)** → `src/features/dashboard/` + `src-tauri/src/commands/dashboard.rs`
- **Export/import & integrity (FR26-30, NFR11-17)** → `src/features/import-export/` + `src-tauri/src/commands/import_export.rs` + `src-tauri/src/security/`
- **UI accessibility (FR31-36)** → `src/shared/components/ui/` + `src/styles/`
- **Audit trail & privacy (FR37-40, NFR9)** → SQLite migrations + command-layer correction history tracking

### Integration Points

- **Internal communication:** Selectors and explicit store actions in frontend; command responses use standardized `{ ok, data/error }` envelope.
- **External integrations:** None in MVP. Local file system access via Tauri dialog and file APIs for export/import only.
- **Data flow:** Message input → parser/validator → save command → SQLite → derived dashboard selectors → rendered StoryCards.

### File Organization Patterns

- Root: dev/build/test configuration files only.
- Frontend source: feature-first in `src/features/`; cross-feature shared code in `src/shared/`.
- Native source: domain-first in `src-tauri/src/commands/`; persistence in `src-tauri/src/db/`.
- Tests: unit tests co-located; E2E centralized under `e2e/`.

### Development Workflow Integration

- **Development server:** `npm run tauri dev` — Vite HMR + live desktop window.
- **Build process:** `npm run tauri build` — outputs `.msi` and `.exe` bundles for Windows.
- **Deployment structure:** Local installer artifacts only; no server deployment required for MVP.

## Architecture Validation Results

### Coherence Validation ✅

All technology choices are compatible and well-integrated. Tauri v2, Vite, React 19, TypeScript, SQLite, Tailwind v4, Zustand, Vitest, and Playwright form a coherent, non-conflicting stack. Implementation patterns align with technology choices. Project structure enables all defined patterns without contradiction.

### Requirements Coverage Validation ✅

All 40 FRs and 20 NFRs are architecturally supported. Feature modules, command domains, and shared infrastructure map directly to every requirement category. No functional requirement has been left without an architectural home. Non-functional requirements are addressed through dedicated decisions (validation gates, atomic import, encryption, deterministic state, local-first invariant, accessibility baseline).

### Implementation Readiness Validation ✅

All critical decisions are documented with technology choices. Patterns cover all 5 identified conflict points. Project structure is concrete and complete with explicit file and directory names. Requirements-to-structure mapping is defined for all FR groups. AI agents have sufficient context to implement consistently without ambiguity.

### Gap Analysis Results

- **Minor — Export encryption key derivation:** The no-passphrase MVP constraint defers the exact key management approach to implementation. This is intentional and does not block implementation stories.
- **Minor — Parser confidence scoring internals:** Confidence thresholds and field-extraction rule specifics are appropriately left to implementation stories. Architecture establishes the boundary and contracts, not the algorithm.

No critical or important gaps identified.

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**✅ Architectural Decisions**
- [x] Critical decisions documented with technology choices
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance and integrity considerations addressed

**✅ Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns (error handling, loading states) documented

**✅ Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High — all decisions are coherent, all requirements are covered, and all conflict points are addressed.

**Key Strengths:**
- Local-first privacy invariant is enforced as an architecture constraint, not just a runtime policy.
- Data integrity is enforced at the domain layer across all write paths, not only UI validation.
- Feature-first structure with clear native command boundaries enables independent AI agent implementation of each domain.
- Versioned migration strategy is baked in from day one, supporting safe schema evolution.

**Areas for Future Enhancement:**
- Export encryption key management can be hardened with user-controlled key derivation post-MVP.
- Parser confidence scoring can evolve toward bank-specific templates in Growth phase.
- Local DB encryption at rest is a clear next security milestone.

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented in this file.
- Use implementation patterns consistently across all features.
- Respect feature and command domain boundaries.
- Refer to this document for all architectural questions before making independent decisions.

**First Implementation Priority:**

```bash
npm create tauri-app@latest
# TypeScript / JavaScript → pnpm → React → TypeScript
npm run tauri add sql
# In src-tauri/: cargo add tauri-plugin-sql --features sqlite
```

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
5 areas where AI agents could diverge and create incompatibilities: naming, structure, formats, communication boundaries, and process behavior.

### Naming Patterns

**Database Naming Conventions:**

- Tables use snake_case plural names: `transactions`, `accounts`, `category_rules`.
- Columns use snake_case: `account_id`, `created_at`, `is_duplicate_flag`.
- Primary keys are `id`; foreign keys use `<table_singular>_id`.
- Index naming: `idx_<table>_<column>`.

**API/Command Naming Conventions:**

- Tauri command names use snake_case verb-noun: `save_transaction`, `import_backup`.
- Frontend route path segments use kebab-case: `/capture-flow`, `/import-review`.
- Frontend query parameters use camelCase.

**Code Naming Conventions:**

- React components use PascalCase and matching filenames, e.g. `TransactionInput.tsx`.
- Hooks use `useXxx` format.
- Functions and variables use camelCase.
- Constants use UPPER_SNAKE_CASE.

### Structure Patterns

**Project Organization:**

- Feature-first organization under `src/features/<feature-name>/`.
- Shared code in `src/shared/` only if reused by 2+ features.
- Native command handlers grouped by domain under `src-tauri/src/commands/`.
- Unit tests are co-located; E2E tests live under top-level `e2e/`.

**File Structure Patterns:**

- One primary responsibility per file.
- Barrel exports allowed only at feature boundaries (`index.ts`).
- Convention files: `schema.ts`, `store.ts`, `service.ts`.

### Format Patterns

**API/Command Response Formats:**

- Success: `{ ok: true, data: <payload>, meta?: {...} }`
- Failure: `{ ok: false, error: { code, message, hint?, details? } }`
- Raw internal errors are never surfaced directly over the UI/native boundary.

**Data Exchange Formats:**

- Dates serialized as ISO-8601 UTC strings.
- Money represented in integer minor units (no floating-point storage).
- Persistence boundary uses snake_case fields; UI maps to camelCase.

### Communication Patterns

**Event System Patterns:**

- Domain events use dot-lowercase naming: `transaction.saved`, `import.failed`.
- Event payload includes `eventId`, `timestamp`, `source`, and `data`.
- Breaking payload changes require event version increment.

**State Management Patterns:**

- Zustand stores are split into feature slices.
- Components read state through selectors only.
- State writes go through explicit action functions.
- Derived values live in selectors, not repeated component recomputation.

### Process Patterns

**Error Handling Patterns:**

- Validate-first and fail-safe behavior on all write paths.
- Operational errors and integrity errors are handled distinctly.
- Every error code maps to deterministic UI behavior.

**Loading State Patterns:**

- Use action-scoped loading flags (`isSaving`, `isImporting`) over one global flag.
- Disable conflicting actions while critical writes are in-flight.
- Always terminate loading with explicit success or error transition.

### Enforcement Guidelines

**All AI Agents MUST:**

- Follow the naming, structure, format, communication, and process contracts in this section.
- Reuse existing schemas, error codes, and conventions before introducing new variants.
- Add or update tests whenever behavior contracts are changed.

**Pattern Enforcement:**

- Pull requests are checked for contract adherence during review.
- Violations are documented in the change notes and fixed before merge.
- Pattern changes require explicit architecture document updates.

### Pattern Examples

**Good Examples:**

- Command: `save_transaction` returns `{ ok: true, data: { transactionId: ... } }`.
- DB schema uses `transaction_items.account_id` and `created_at`.
- UI reads ledger summary with selector-based Zustand access.

**Anti-Patterns:**

- Mixing `snake_case` and `camelCase` field names inside the same persistence contract.
- Throwing raw native error stacks directly to the UI.
- Implementing ad-hoc loading booleans with inconsistent names across features.
