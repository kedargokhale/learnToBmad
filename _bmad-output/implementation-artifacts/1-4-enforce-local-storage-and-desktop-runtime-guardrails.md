# Story 1.4: Enforce Local Storage and Desktop Runtime Guardrails

## Metadata
- Story Key: 1-4-enforce-local-storage-and-desktop-runtime-guardrails
- Epic: Epic 1 - Start Private Ledger and Account Baseline
- Status: done
- Created: 2026-05-04T00:00:00+05:30
- Last Updated: 2026-05-04T00:00:00+05:30
- Source: _bmad-output/planning-artifacts/epics.md

## Story
As a user,
I want explicit local-only data handling and runtime compatibility checks,
So that I can trust platform behavior and compatibility.

## Acceptance Criteria
1. Given app runtime configuration, when core flows are executed in supported Windows targets with required WebView2 runtime, then capture, save, and dashboard entry paths behave correctly in the packaged desktop app and transaction/account data is stored locally without automatic external transmission.

## Tasks / Subtasks

- [x] Set restrictive Content Security Policy in tauri.conf.json (AC: 1)
  - [x] Replace `"csp": null` under `app.security` with a CSP string that restricts `connect-src` to same-origin, Tauri IPC endpoints only (no external hosts).
  - [x] Verify the CSP allows `ipc:` and `http://ipc.localhost` (Tauri IPC on Windows/WebView2) and `https://asset.localhost` / `asset:` (Tauri asset protocol).
  - [x] Ensure `script-src` and `style-src` remain permissive enough for Vite-injected inline scripts/styles in the current build output (`'unsafe-inline'` required).
  - [x] Confirm `pnpm run build` completes without CSP-related failures.

- [x] Add non-Tauri (browser) environment guard in App.tsx (AC: 1)
  - [x] Import `isTauri` from `@tauri-apps/api/core`.
  - [x] At the top of the `App` component body (before any state or effects), if `isTauri()` returns `false`, return an `<UnsupportedRuntimeScreen />` inline component with role `"alert"`, heading describing the desktop-only requirement, and no interactive paths.
  - [x] Keep `UnsupportedRuntimeScreen` as a local component in `App.tsx` (single-use, no need for a separate file).
  - [x] The guard must render synchronously — no async check, no loading state.

- [x] Audit and tighten Tauri capabilities (AC: 1)
  - [x] Review `app/src-tauri/capabilities/default.json` to confirm no network-capable permissions (e.g., `http:*`, `fetch:*`) are present.
  - [x] Confirm `opener:default` does not introduce automatic external transmission vectors for core ledger flows. Add an inline comment in the story dev notes if it is retained only for OS-level file opener behavior (not network fetch).
  - [x] Confirm no new capability entries are required for this story.

- [x] Update test setup and add guardrail tests (AC: 1)
  - [x] In `app/src/test/setup.ts`, add a global vi.mock for `@tauri-apps/api/core` that returns `isTauri: () => true` so all existing App-level tests continue passing without change.
  - [x] In `app/src/features/ledger/ledger.test.tsx`, add a test block `"Desktop runtime guard"` with two tests:
    - When `isTauri()` returns `false`, `<App>` renders the unsupported runtime message without calling `getLedgerBaseline`.
    - When `isTauri()` returns `true`, `<App>` proceeds with normal baseline load flow.
  - [x] Verify all existing tests in `ledger.test.tsx` continue passing after the setup.ts mock is added.

## Dev Notes

### Story Intent
Story 1.4 is the final story in Epic 1. Its purpose is to harden the two critical local-first guarantees that underpin every subsequent story:
1. **Local-only data** — no external network connections are possible from core flows (CSP enforcement).
2. **Desktop-only runtime** — if someone opens the built HTML in a regular browser instead of the Tauri app, the app shows a clear incompatible environment message instead of silently attempting Tauri IPC calls that will fail.

This story does NOT implement new features — it enforces architectural invariants.

### Relevant Requirements
- FR36: System interface works correctly in packaged Windows desktop runtime using WebView2.
- FR37: System stores transaction/account data locally without automatic external transmission.
- NFR5: All transaction/account data must remain local to the user device, with no automatic external transmission.

### Current Codebase Reality (Read Before Editing)
- `app/src-tauri/tauri.conf.json` → `app.security.csp` is currently `null` (CSP disabled). This is the primary gap.
- `app/src-tauri/capabilities/default.json` has `["core:default", "opener:default", "sql:default", "sql:allow-execute"]`. No network-capability entries are present. No changes needed except confirmation.
- `app/src/App.tsx` renders one of two screens (`AccountSetupScreen` or `LedgerBaselineView`) based on `getLedgerBaseline()` result. No Tauri environment check exists yet.
- `app/src/main.tsx` is a thin ReactDOM entry point. Do not add guard logic here.
- `app/src/test/setup.ts` currently contains only `import "@testing-library/jest-dom/vitest"`. All existing tests that render `<App>` mock `./service`. Once we add `isTauri()` guard to App, the setup.ts mock is required to prevent test regressions.

### File-Level Change Guardrails (UPDATE files only)

**`app/src-tauri/tauri.conf.json`** (UPDATE)
- Current state: `"csp": null` disables CSP entirely.
- This story changes: replace `null` with a restrictive CSP string.
- Must preserve: `productName`, `identifier`, `build`, `plugins.sql.preload`, `app.windows`, `bundle` — touch only `app.security.csp`.
- Correct CSP string for Tauri v2 + WebView2 on Windows:
  ```
  "default-src 'self'; connect-src 'self' ipc: http://ipc.localhost; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: asset: https://asset.localhost; font-src 'self' data:"
  ```
  - `connect-src 'self' ipc: http://ipc.localhost` — allows Tauri IPC (`ipc:` scheme on macOS/Linux, `http://ipc.localhost` on Windows WebView2); blocks all external hosts.
  - `script-src 'self' 'unsafe-inline'` — Vite injects inline scripts during dev and build; `unsafe-inline` is required.
  - `style-src 'self' 'unsafe-inline'` — same rationale for styles.
  - `img-src 'self' data: asset: https://asset.localhost` — Tauri serves assets via `asset:` (non-Windows) or `https://asset.localhost` (WebView2/Windows).
  - `font-src 'self' data:` — allows data-URI fonts embedded in CSS.
- Do NOT include `http:`, `https:` (external hosts), or `ws:` in connect-src.

**`app/src/App.tsx`** (UPDATE)
- Current state: imports `AccountSetupScreen`, `LedgerBaselineView`, `getLedgerBaseline`; renders based on baseline state.
- This story changes: add `isTauri` import and a synchronous guard before any state/effects.
- Must preserve: all existing `useState`, `useEffect`, `loadBaseline`, and render logic exactly as-is — the guard is a purely additive early-return.
- Implementation pattern:
  ```tsx
  import { isTauri } from "@tauri-apps/api/core";
  // ... existing imports unchanged ...

  function UnsupportedRuntimeScreen() {
    return (
      <main className="app-shell">
        <section role="alert" className="loading-card">
          <h1>Desktop app required</h1>
          <p>
            learnToBmad must run as a packaged desktop application. Open the
            installed app instead of this file directly in a browser.
          </p>
        </section>
      </main>
    );
  }

  function App() {
    if (!isTauri()) {
      return <UnsupportedRuntimeScreen />;
    }
    // ... existing component body unchanged ...
  }
  ```
- Place `UnsupportedRuntimeScreen` above `App` in the file, not below it.
- Do NOT add any async check or Tauri-specific state; `isTauri()` is synchronous.

**`app/src/test/setup.ts`** (UPDATE)
- Current state: single import for jest-dom matchers.
- This story changes: add global vi.mock for `@tauri-apps/api/core`.
- Must preserve: the jest-dom import line.
- Implementation pattern:
  ```ts
  import "@testing-library/jest-dom/vitest";
  import { vi } from "vitest";

  vi.mock("@tauri-apps/api/core", () => ({
    isTauri: () => true,
    invoke: vi.fn(),
  }));
  ```
- The `invoke` stub in the core mock is a safety net. The existing `./service` mock in tests already intercepts all real calls; `invoke` in core mock will not be reached in normal test flows.

**`app/src/features/ledger/ledger.test.tsx`** (UPDATE)
- Current state: tests for `AccountSetupScreen` behavior and `Ledger baseline app flow`.
- This story changes: add a new `describe` block `"Desktop runtime guard"` with two tests.
- Must preserve: all 7 existing tests without modification.
- Implementation pattern for the two new tests:
  ```tsx
  describe("Desktop runtime guard", () => {
    it("renders unsupported runtime screen when not running in Tauri", async () => {
      // Override global mock for this test only
      vi.mocked(isTauri).mockReturnValueOnce(false);

      render(<App />);

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(/desktop app required/i);
      expect(getLedgerBaseline).not.toHaveBeenCalled();
    });

    it("proceeds with normal baseline load when running in Tauri", async () => {
      // Global mock returns true (default), no override needed
      vi.mocked(getLedgerBaseline).mockResolvedValue({
        ok: true,
        data: { account: null, entries: [], ordering: "created_at_desc_id_desc" },
      });

      render(<App />);

      expect(await screen.findByRole("heading", { name: /account setup/i })).toBeInTheDocument();
    });
  });
  ```
- Add `import { isTauri } from "@tauri-apps/api/core";` at top of the test file (needed for `vi.mocked(isTauri)`).
- The `vi.mocked(isTauri).mockReturnValueOnce(false)` pattern works because setup.ts already uses `vi.mock(...)` to create a mock for the module.

### Architecture Compliance
- This story directly enforces the architecture invariant: "Local-first privacy boundary: No external network calls for any core operation; this must be enforced as an architecture invariant, not just a deployment choice."
- Feature-first boundaries are not affected; no new feature directories are created.
- No new Tauri commands or Rust changes are needed.
- No state management changes (Zustand is not touched).
- No schema or service changes.

### Library and Framework Requirements
- `@tauri-apps/api` v2.x is already installed. `isTauri` is exported from `@tauri-apps/api/core` in v2.x. Do NOT use `window.__TAURI__` or `window.__TAURI_INTERNALS__` — use the official `isTauri()` function.
- No new dependencies. No version bumps required.

### Capabilities Audit Notes (`default.json`)
- `core:default` — required for basic Tauri window and IPC operations. Keep.
- `opener:default` — used for OS-level shell/file opening (not network fetch). This is a pre-existing capability from Story 1.1. It does not introduce automatic external transmission for ledger core flows. Keep. If in doubt, scope review is deferred to a security hardening pass post-MVP.
- `sql:default` and `sql:allow-execute` — required for SQLite operations. Keep.
- **No changes to `default.json` are required for this story.** The audit conclusion is: no network-capable capabilities are enabled.

### Testing Requirements
- All existing tests must pass after changes.
- The `vi.mock("@tauri-apps/api/core", ...)` in `setup.ts` is the key regression-prevention mechanism. Without it, every `<App>` render in tests would render `<UnsupportedRuntimeScreen>` instead of the real app.
- New guard tests require overriding the setup.ts mock per-test using `vi.mocked(isTauri).mockReturnValueOnce(false)`.
- No Rust tests are needed for this story (no Rust changes).
- After all changes: run `pnpm test` (full vitest suite) and confirm all tests pass.
- Optionally run `pnpm build` to verify the CSP change does not break the production build output.

### Previous Story Intelligence (Story 1.3)
- Keep all existing `app/src/App.tsx` state/effect/render logic completely intact — the guard is a purely additive early-return.
- Keep all existing `ledger.test.tsx` tests intact — the new `describe` block is strictly additive.
- The error envelope pattern, service layer, and Rust command boundary are not touched by this story.
- Established pattern: tests mock `./service`, not `@tauri-apps/api` directly. This story follows the same pattern for the Tauri core module mock (in setup.ts, not per-test file).

### Git Intelligence Summary
- Recent work was concentrated in `app/src/App.tsx`, `app/src/features/ledger/`, and `app/src-tauri/src/commands/ledger.rs`.
- No git history shows a CSP being set previously — this is a new addition.
- Existing test infrastructure in `ledger.test.tsx` uses `vi.mock("./service")` pattern; the new `@tauri-apps/api/core` mock in `setup.ts` extends this established mocking approach.
- Branch `Sprint_1.4_LocalStorage` already exists (HEAD branch) — continue on it.

### Latest Technical Information
- **`@tauri-apps/api` v2**: `isTauri()` is available in `@tauri-apps/api/core`. It checks `window.__TAURI_INTERNALS__ !== undefined` internally. This is the canonical detection method for Tauri v2 apps.
- **Tauri v2 CSP**: In WebView2 on Windows, Tauri IPC runs via `http://ipc.localhost`. The `ipc:` scheme covers non-Windows. Both must be in `connect-src`. Tauri asset serving on Windows uses `https://asset.localhost`.
- **`'unsafe-eval'` in CSP**: Vite's dev server requires it, but the production build does NOT use `eval`. Omit `'unsafe-eval'` from the CSP string — the build output does not need it.
- **Vitest v4 + `vi.mock` in setup files**: `vi.mock` calls in `setup.ts` work globally for all tests in the suite. `vi.mocked(fn).mockReturnValueOnce(...)` in an individual test overrides the global mock for a single call. This is the standard vitest pattern.

### Project Context Reference
- No `project-context.md` file discovered via configured persistent facts glob.

### References
- _bmad-output/planning-artifacts/epics.md (Epic 1, Story 1.4)
- _bmad-output/planning-artifacts/prd.md (FR36, FR37, NFR5)
- _bmad-output/planning-artifacts/architecture.md (Authentication & Security, Cross-Cutting Concerns, Implementation Patterns)
- _bmad-output/implementation-artifacts/1-3-view-account-ledger-baseline.md (previous story intelligence)
- app/src-tauri/tauri.conf.json
- app/src-tauri/capabilities/default.json
- app/src/App.tsx
- app/src/main.tsx
- app/src/test/setup.ts
- app/src/features/ledger/ledger.test.tsx
- app/vitest.config.ts

## Dev Agent Record

### Agent Model Used
GPT-5.3-Codex

### Debug Log References
- Workflow customization resolved via python script; no team/user overrides found — defaults apply.
- Story discovery selected 1-4-enforce-local-storage-and-desktop-runtime-guardrails as the first ready-for-dev entry in sprint order.
- Epic 1 already `in-progress` from Story 1.1 — no epic status change needed.
- No project-context.md found; persistent_facts file glob resolved to nothing.
- Tauri CSP string applied in tauri.conf.json with restrictive connect-src and asset allowances aligned to Tauri v2 WebView2 runtime behavior.
- Red phase executed by adding runtime guard tests first; one new guard test failed before App guard implementation.
- Green phase completed by adding synchronous isTauri guard and local UnsupportedRuntimeScreen early return in App.tsx.
- Test setup now mocks @tauri-apps/api/core globally with isTauri true default to preserve existing App tests.
- Validation run succeeded: targeted vitest, full pnpm test, cargo test, and pnpm build.

### Completion Notes List
- Enforced restrictive CSP in Tauri config to allow only same-origin IPC and asset protocols required by desktop runtime while blocking external hosts.
- Added synchronous desktop-runtime guard in App.tsx using isTauri() with a local UnsupportedRuntimeScreen alert path and no interactive actions.
- Verified capabilities remain local-first: default capability set has no network permissions, opener capability retained only as existing OS-level behavior, and no new capability entries were added.
- Added desktop runtime guard tests covering both browser and Tauri paths; existing ledger tests remained passing.
- Completed validation gates with all test suites and build passing.

### File List
- _bmad-output/implementation-artifacts/1-4-enforce-local-storage-and-desktop-runtime-guardrails.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- app/src-tauri/tauri.conf.json
- app/src/App.tsx
- app/src/test/setup.ts
- app/src/features/ledger/ledger.test.tsx

## Change Log
- 2026-05-04: Implemented Story 1.4 guardrails for local-only desktop runtime behavior, added runtime guard tests, and validated via full test/build gates.
