import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";

import { ReadinessStatus } from "./features/capture/components/ReadinessStatus";
import { CorrectionPanel } from "./features/capture/components/CorrectionPanel";
import { SaveConfirmationToast } from "./features/capture/components/SaveConfirmationToast";
import { TransactionInput } from "./features/capture/components/TransactionInput";
import {
  attemptTransactionSave,
  type CommandError,
  type ParsePreviewData,
  type SaveTransactionAttemptData,
} from "./features/capture/service";
import {
  type AccountMismatchResolution,
  applyCorrectionMap,
  correctionMapSchema,
  deriveReadinessStateFromBlockedFields,
  deriveBlockedFieldReasons,
  type DuplicateDecision,
  getFieldDisplayName,
  parsePreviewSchema,
  saveGateDecisionDetailsSchema,
  type SaveLifecycleState,
  type BlockedFieldReason,
  resolveCategorySource,
} from "./features/capture/schema";
import {
  isCategoryCode,
  type CategoryCode,
} from "./features/categorization/schema";
import { AccountSetupScreen } from "./features/ledger/components/AccountSetupScreen";
import { LedgerBaselineView } from "./features/ledger/components/LedgerBaselineView";
import {
  getLedgerBaseline,
  updateCaptureTransactionCategory,
  type LedgerAccountData,
  type LedgerBaselineData,
  type LedgerScopeSelection,
} from "./features/ledger/service";
import "./App.css";

type AccountSetupInitialValues = {
  bankName: string;
  accountNumber: string;
  openingBalance: string;
};

function normalizeCompareText(value: string): string {
  return value
    .split("")
    .filter((character) => /[a-z0-9]/i.test(character))
    .map((character) => character.toUpperCase())
    .join("");
}

function hasParsedAccountIdentity(preview: ParsePreviewData | null): boolean {
  return Boolean(preview?.bankName?.trim() && preview?.accountNumber?.trim());
}

function getAccountSetupInitialValues(
  preview: ParsePreviewData | null,
): AccountSetupInitialValues | null {
  const bankName = preview?.bankName?.trim();
  const accountNumber = preview?.accountNumber?.trim();

  if (!bankName || !accountNumber) {
    return null;
  }

  return {
    bankName,
    accountNumber,
    openingBalance: "",
  };
}

function getLedgerAccounts(baseline: LedgerBaselineData | null): LedgerAccountData[] {
  if (!baseline) {
    return [];
  }

  if (baseline.accounts?.length) {
    return baseline.accounts;
  }

  return baseline.account ? [baseline.account] : [];
}

function resolveBaselineScopeSelection(baseline: LedgerBaselineData | null): LedgerScopeSelection | null {
  if (!baseline) {
    return null;
  }

  if (baseline.scope?.kind === "account" && baseline.scope.accountId) {
    return {
      kind: "account",
      accountId: baseline.scope.accountId,
    };
  }

  if (baseline.scope?.kind === "all-accounts") {
    return { kind: "all-accounts" };
  }

  if (baseline.account) {
    return {
      kind: "account",
      accountId: baseline.account.id,
    };
  }

  return baseline.accounts?.length ? { kind: "all-accounts" } : null;
}

function resolveActiveAccount(baseline: LedgerBaselineData | null): LedgerAccountData | null {
  if (!baseline) {
    return null;
  }

  if (baseline.account) {
    return baseline.account;
  }

  const accounts = getLedgerAccounts(baseline);
  return accounts[0] ?? null;
}

function isMissingParsedAccountError(error: CommandError): boolean {
  if (error.code !== "VALIDATION_FAILED") {
    return false;
  }

  const saveGateDetailsParse = saveGateDecisionDetailsSchema.safeParse(error.details);
  if (!saveGateDetailsParse.success) {
    return false;
  }

  return saveGateDetailsParse.data.blockedFields.some(
    (item) => item.field === "accountNumber" && /not yet available in the local ledger/i.test(item.hint),
  );
}

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

  const [baseline, setBaseline] = useState<LedgerBaselineData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const baselineRef = useRef<LedgerBaselineData | null>(null);
  const [selectedScope, setSelectedScope] = useState<LedgerScopeSelection | null>(null);
  const [parsePreview, setParsePreview] = useState<ParsePreviewData | null>(null);
  const [parseError, setParseError] = useState<CommandError | null>(null);
  const [saveError, setSaveError] = useState<CommandError | null>(null);
  const [saveResult, setSaveResult] = useState<SaveTransactionAttemptData | null>(null);
  const [saveLifecycleState, setSaveLifecycleState] = useState<SaveLifecycleState>("idle");
  const [isSaving, setIsSaving] = useState(false);
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [isAccountSetupPromptOpen, setIsAccountSetupPromptOpen] = useState(false);
  const [accountSetupInitialValues, setAccountSetupInitialValues] = useState<AccountSetupInitialValues | null>(null);
  const [mismatchResolution, setMismatchResolution] = useState<AccountMismatchResolution | null>(null);
  const [duplicateDecision, setDuplicateDecision] = useState<DuplicateDecision | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryCode>("other");
  const [captureConfirmation, setCaptureConfirmation] = useState<string | null>(null);
  const [correctionMap, setCorrectionMap] = useState<
    Partial<Record<BlockedFieldReason["field"], string>>
  >({});
  const baselineLoadRequestIdRef = useRef(0);

  const parsedPreview = parsePreviewSchema.safeParse(parsePreview);
  const normalizedPreview = parsedPreview.success ? parsedPreview.data : null;
  const parsedCorrectionMap = correctionMapSchema.safeParse(correctionMap);
  const correctedPreview =
    normalizedPreview && parsedCorrectionMap.success
      ? applyCorrectionMap(normalizedPreview, parsedCorrectionMap.data)
      : normalizedPreview;
  const blockedFields = parseError
    ? deriveBlockedFieldReasons(null)
    : deriveBlockedFieldReasons(correctedPreview);
  const saveGateDetailsParse = saveGateDecisionDetailsSchema.safeParse(saveError?.details);
  const saveGateDetails = saveGateDetailsParse.success ? saveGateDetailsParse.data : null;

  const localParsedBank = correctedPreview?.bankName?.trim();
  const localParsedAccount = correctedPreview?.accountNumber?.trim();
  const activeAccount = resolveActiveAccount(baseline);
  const localSelectedBank = activeAccount?.bankName?.trim();
  const localSelectedAccount = activeAccount?.accountNumber?.trim();
  const localMismatchDetected = Boolean(
    activeAccount &&
      ((localParsedBank &&
        localSelectedBank &&
        normalizeCompareText(localParsedBank) !== normalizeCompareText(localSelectedBank)) ||
        (localParsedAccount &&
          localSelectedAccount &&
          normalizeCompareText(localParsedAccount) !== normalizeCompareText(localSelectedAccount))),
  );

  const preflightAccountMismatch = activeAccount
    ? {
        detected: localMismatchDetected,
        requiresResolution: localMismatchDetected,
        parsedBankName: correctedPreview?.bankName ?? null,
        parsedAccountNumber: correctedPreview?.accountNumber ?? null,
        selectedBankName: activeAccount.bankName,
        selectedAccountNumber: activeAccount.accountNumber,
      }
    : null;
  const requiresMismatchResolution = Boolean(
    saveGateDetails?.accountMismatch?.requiresResolution || preflightAccountMismatch?.requiresResolution,
  );
  const requiresDuplicateDecision = Boolean(
    saveGateDetails?.duplicateCandidate?.detected && saveGateDetails?.duplicateCandidate?.requiresDecision,
  );
  const decisionBlockedReasons: string[] = [];

  if (requiresMismatchResolution && !mismatchResolution) {
    decisionBlockedReasons.push("Account mismatch detected: choose a mismatch resolution to continue.");
  }

  if (requiresDuplicateDecision && !duplicateDecision) {
    decisionBlockedReasons.push("Possible duplicate detected: choose a duplicate decision to continue.");
  }

  const saveBlockedReasons = blockedFields.map((item) => {
    const reasonLabel = item.reason === "missing" ? "missing" : "ambiguous";
    return `${getFieldDisplayName(item.field)}: ${reasonLabel}. ${item.hint}`;
  }).concat(decisionBlockedReasons);
  const hasCorrectionsApplied = Object.keys(correctionMap).length > 0;

  const loadBaseline = useCallback(async (scope?: LedgerScopeSelection | null, failOnError = false) => {
    const requestId = baselineLoadRequestIdRef.current + 1;
    baselineLoadRequestIdRef.current = requestId;
    const isLatestRequest = () => baselineLoadRequestIdRef.current === requestId;
    const showBlockingLoader = baselineRef.current === null;

    if (showBlockingLoader) {
      setIsLoading(true);
    }

    try {
      const result = await getLedgerBaseline(scope ? { scope } : undefined);
      if (!isLatestRequest()) {
        return;
      }

      if (!result.ok) {
        // If a scoped request fails (stale scope/account), recover with default scope
        // so account options remain visible and users can switch again.
        if (scope) {
          const fallback = await getLedgerBaseline();
          if (!isLatestRequest()) {
            return;
          }

          if (fallback.ok) {
            setBaseline(fallback.data);
            setSelectedScope(resolveBaselineScopeSelection(fallback.data));
            return;
          }

          // Preserve the previous baseline if both scoped and fallback reads fail.
          setSelectedScope((currentScope) => currentScope ?? null);
          return;
        }

        if (failOnError) {
          throw new Error("Failed to refresh ledger baseline from persisted data.");
        }
        setBaseline((currentBaseline) => currentBaseline ?? {
          account: null,
          entries: [],
          categoryInsights: [],
          merchantInsights: [],
          trendAlert: {
            windowPreset: "last-30-days",
            currentSpendMinor: 0,
            baselineSpendMinor: 0,
            deltaPercent: 0,
            thresholdPercent: 20,
            isAlert: false,
            reason: "No transactions yet.",
          },
          runningBalance: {
            windowPreset: "last-30-days",
            points: [],
          },
          ordering: "created_at_desc_id_desc",
        });
        setSelectedScope((currentScope) => currentScope ?? null);
        return;
      }

      setBaseline(result.data);
      setSelectedScope(resolveBaselineScopeSelection(result.data));
    } catch {
      if (!isLatestRequest()) {
        return;
      }

      if (failOnError) {
        throw new Error("Failed to refresh ledger baseline from persisted data.");
      }
      setBaseline((currentBaseline) => currentBaseline ?? {
        account: null,
        entries: [],
        categoryInsights: [],
        merchantInsights: [],
        trendAlert: {
          windowPreset: "last-30-days",
          currentSpendMinor: 0,
          baselineSpendMinor: 0,
          deltaPercent: 0,
          thresholdPercent: 20,
          isAlert: false,
          reason: "No transactions yet.",
        },
        runningBalance: {
          windowPreset: "last-30-days",
          points: [],
        },
        ordering: "created_at_desc_id_desc",
      });
      setSelectedScope((currentScope) => currentScope ?? null);
    } finally {
      if (showBlockingLoader && isLatestRequest()) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    baselineRef.current = baseline;
  }, [baseline]);

  const runSaveAttempt = useCallback(async () => {
    if (!correctedPreview || blockedFields.length > 0 || decisionBlockedReasons.length > 0) {
      setSaveLifecycleState("blocked");
      return;
    }

    if (!activeAccount && hasParsedAccountIdentity(correctedPreview)) {
      setAccountSetupInitialValues(getAccountSetupInitialValues(correctedPreview));
      setIsAccountSetupPromptOpen(true);
      setSaveLifecycleState("blocked");
      return;
    }

    if (!activeAccount) {
      setSaveLifecycleState("blocked");
      return;
    }

    setIsSaving(true);
    setSaveLifecycleState("validating");
    setSaveError(null);
    setSaveResult(null);

    try {
      setSaveLifecycleState("persisting");
      const result = await attemptTransactionSave({
        accountContext: {
          accountId: activeAccount.id,
          bankName: activeAccount.bankName,
          accountNumber: activeAccount.accountNumber,
        },
        parsedPayload: {
          ...correctedPreview,
          finalCategory: selectedCategory,
          categorySource: resolveCategorySource(correctedPreview.suggestedCategory, selectedCategory),
          readinessState: deriveReadinessStateFromBlockedFields(blockedFields),
        },
        mismatchResolution,
        duplicateDecision,
      });

      if (!result.ok) {
        if (mismatchResolution === "use-parsed-account" && isMissingParsedAccountError(result.error)) {
          setAccountSetupInitialValues(getAccountSetupInitialValues(correctedPreview));
          setIsAccountSetupPromptOpen(true);
          setSaveError(null);
          setSaveLifecycleState("idle");
          return;
        }

        setSaveLifecycleState("failed");
        setSaveError(result.error);
        return;
      }

      setSaveResult(result.data);
      setCaptureConfirmation("Transaction saved successfully. You can continue without dismissing this message.");

      if (result.data.acceptedForWrite) {
        await loadBaseline(selectedScope, true);
      }

      setSaveLifecycleState("success");
    } catch {
      setSaveLifecycleState("failed");
      setSaveError({
        code: "PERSISTENCE_ERROR",
        message: "Save committed, but the refreshed ledger baseline could not be loaded.",
        hint: "Retry refresh. If the issue persists, restart the app and verify local database access.",
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    activeAccount,
    blockedFields,
    correctedPreview,
    decisionBlockedReasons.length,
    duplicateDecision,
    loadBaseline,
    mismatchResolution,
    selectedScope,
    selectedCategory,
  ]);

  useEffect(() => {
    void loadBaseline();
  }, [loadBaseline]);

  if (isLoading) {
    return (
      <main className="app-shell">
        <section className="loading-card" aria-live="polite">
          Loading local ledger baseline...
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell app-shell--stacked">
      <section className="capture-grid" aria-label="Transaction capture parse preview">
        <TransactionInput
          onPreviewChange={(preview, error) => {
            setParsePreview(preview);
            setParseError(error);
            setSaveError(null);
            setSaveResult(null);
            setSaveLifecycleState("idle");
            setIsCorrectionOpen(false);
            setIsAccountSetupPromptOpen(false);
            setAccountSetupInitialValues(null);
            setMismatchResolution(null);
            setDuplicateDecision(null);
            setCaptureConfirmation(null);
            if (preview && isCategoryCode(preview.finalCategory)) {
              setSelectedCategory(preview.finalCategory);
            } else {
              setSelectedCategory("other");
            }
            setCorrectionMap({});
          }}
          onAttemptSave={runSaveAttempt}
          saveBlockedReasons={saveBlockedReasons}
          isSaving={isSaving}
        />
        <ReadinessStatus
          preview={correctedPreview}
          error={parseError}
          saveError={saveError}
          saveResult={saveResult}
          blockedFields={blockedFields}
          onOpenCorrection={() => {
            if (blockedFields.length > 0) {
              setIsCorrectionOpen(true);
            }
          }}
          hasCorrectionsApplied={hasCorrectionsApplied}
          mismatchResolution={mismatchResolution}
          duplicateDecision={duplicateDecision}
          onMismatchResolutionChange={(value) => {
            setMismatchResolution(value);
            setSaveResult(null);
            setSaveLifecycleState("idle");
          }}
          onDuplicateDecisionChange={(value) => {
            setDuplicateDecision(value);
            setSaveResult(null);
            setSaveLifecycleState("idle");
          }}
          selectedCategory={selectedCategory}
          onCategoryChange={(value) => {
            setSelectedCategory(value);
            setSaveResult(null);
            setSaveLifecycleState("idle");
          }}
          preflightAccountMismatch={preflightAccountMismatch}
          saveLifecycleState={saveLifecycleState}
        />
        <CorrectionPanel
          isOpen={isCorrectionOpen}
          blockedFields={blockedFields}
          preview={correctedPreview}
          correctionValues={correctionMap}
          onCorrectionChange={(field, value) => {
            setCorrectionMap((current) => ({
              ...current,
              [field]: value,
            }));
            setSaveError(null);
            setSaveResult(null);
            setSaveLifecycleState("idle");
          }}
          onApply={(hadBlockedFields) => {
            setIsCorrectionOpen(false);
            if (hadBlockedFields) {
              setCaptureConfirmation("Corrections updated. You can retry save when ready.");
            }
          }}
          onClose={() => {
            setIsCorrectionOpen(false);
          }}
        />
        <SaveConfirmationToast
          message={captureConfirmation}
          onClear={() => {
            setCaptureConfirmation(null);
          }}
        />
      </section>

      {getLedgerAccounts(baseline).length > 0 ? (
        <LedgerBaselineView
          baseline={baseline}
          currentScope={selectedScope ?? resolveBaselineScopeSelection(baseline) ?? { kind: "all-accounts" }}
          onScopeChange={(scope) => {
            setSelectedScope(scope);
            void loadBaseline(scope);
          }}
          onRefresh={() => loadBaseline(selectedScope)}
          onUpdateCategory={async (transactionId, finalCategory) => {
            try {
              const result = await updateCaptureTransactionCategory({
                transactionId,
                finalCategory,
              });

              if (!result.ok) {
                setSaveLifecycleState("failed");
                setSaveError(result.error);
                return;
              }

              setSaveResult(null);
              setSaveLifecycleState("success");
              await loadBaseline(selectedScope, true);
            } catch {
              setSaveLifecycleState("failed");
              setSaveError({
                code: "PERSISTENCE_ERROR",
                message: "Category was updated, but the refreshed ledger baseline could not be loaded.",
                hint: "Retry refresh. If the issue persists, restart the app and verify local database access.",
              });
            }
          }}
        />
      ) : (
        <section className="ledger-card" aria-live="polite">
          <h2>No transactions yet.</h2>
          <p className="section-copy">Paste your first bank message to begin. Save validation will confirm the account only when a new account is detected.</p>
        </section>
      )}

      {isAccountSetupPromptOpen ? (
        <AccountSetupScreen
          initialValues={accountSetupInitialValues ?? undefined}
          onAccountCreated={async () => {
            await loadBaseline(selectedScope);
            setSaveError(null);
            setSaveResult(null);
            setSaveLifecycleState("idle");
            setAccountSetupInitialValues(null);
            setIsAccountSetupPromptOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}

export default App;
