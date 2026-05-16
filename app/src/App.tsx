import { useCallback, useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";

import { ReadinessStatus } from "./features/capture/components/ReadinessStatus";
import { CorrectionPanel } from "./features/capture/components/CorrectionPanel";
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
  type BlockedFieldReason,
} from "./features/capture/schema";
import { AccountSetupScreen } from "./features/ledger/components/AccountSetupScreen";
import { LedgerBaselineView } from "./features/ledger/components/LedgerBaselineView";
import {
  getLedgerBaseline,
  type LedgerBaselineData,
} from "./features/ledger/service";
import "./App.css";

function normalizeCompareText(value: string): string {
  return value
    .split("")
    .filter((character) => /[a-z0-9]/i.test(character))
    .map((character) => character.toUpperCase())
    .join("");
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
  const [parsePreview, setParsePreview] = useState<ParsePreviewData | null>(null);
  const [parseError, setParseError] = useState<CommandError | null>(null);
  const [saveError, setSaveError] = useState<CommandError | null>(null);
  const [saveResult, setSaveResult] = useState<SaveTransactionAttemptData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [mismatchResolution, setMismatchResolution] = useState<AccountMismatchResolution | null>(null);
  const [duplicateDecision, setDuplicateDecision] = useState<DuplicateDecision | null>(null);
  const [correctionMap, setCorrectionMap] = useState<
    Partial<Record<BlockedFieldReason["field"], string>>
  >({});

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
  const localSelectedBank = baseline?.account?.bankName?.trim();
  const localSelectedAccount = baseline?.account?.accountNumber?.trim();
  const localMismatchDetected = Boolean(
    baseline?.account &&
      ((localParsedBank &&
        localSelectedBank &&
        normalizeCompareText(localParsedBank) !== normalizeCompareText(localSelectedBank)) ||
        (localParsedAccount &&
          localSelectedAccount &&
          normalizeCompareText(localParsedAccount) !== normalizeCompareText(localSelectedAccount))),
  );

  const preflightAccountMismatch = baseline?.account
    ? {
        detected: localMismatchDetected,
        requiresResolution: localMismatchDetected,
        parsedBankName: correctedPreview?.bankName ?? null,
        parsedAccountNumber: correctedPreview?.accountNumber ?? null,
        selectedBankName: baseline.account.bankName,
        selectedAccountNumber: baseline.account.accountNumber,
      }
    : null;
  const requiresMismatchResolution = Boolean(saveGateDetails?.accountMismatch?.detected);
  const requiresDuplicateDecision = Boolean(saveGateDetails?.duplicateCandidate?.detected);
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

  const loadBaseline = useCallback(async () => {
    setIsLoading(true);

    try {
      const result = await getLedgerBaseline();
      if (!result.ok) {
        setBaseline({
          account: null,
          entries: [],
          ordering: "created_at_desc_id_desc",
        });
        return;
      }

      setBaseline(result.data);
    } catch {
      setBaseline({
        account: null,
        entries: [],
        ordering: "created_at_desc_id_desc",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const runSaveAttempt = useCallback(async () => {
    if (
      !baseline?.account ||
      !correctedPreview ||
      blockedFields.length > 0 ||
      decisionBlockedReasons.length > 0
    ) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveResult(null);

    try {
      const result = await attemptTransactionSave({
        accountContext: {
          accountId: baseline.account.id,
          bankName: baseline.account.bankName,
          accountNumber: baseline.account.accountNumber,
        },
        parsedPayload: {
          ...correctedPreview,
          readinessState: deriveReadinessStateFromBlockedFields(blockedFields),
        },
        mismatchResolution,
        duplicateDecision,
      });

      if (!result.ok) {
        setSaveError(result.error);
        return;
      }

      setSaveResult(result.data);

      if (result.data.acceptedForWrite) {
        await loadBaseline();
      }
    } catch {
      setSaveError({
        code: "PERSISTENCE_ERROR",
        message: "Save validation failed before a deterministic result was produced.",
        hint: "Retry save validation after parsing the message again.",
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    baseline,
    blockedFields,
    correctedPreview,
    decisionBlockedReasons.length,
    duplicateDecision,
    loadBaseline,
    mismatchResolution,
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
      {baseline?.account ? (
        <>
          <section className="capture-grid" aria-label="Transaction capture parse preview">
            <TransactionInput
              onPreviewChange={(preview, error) => {
                setParsePreview(preview);
                setParseError(error);
                setSaveError(null);
                setSaveResult(null);
                setIsCorrectionOpen(false);
                setMismatchResolution(null);
                setDuplicateDecision(null);
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
              }}
              onDuplicateDecisionChange={(value) => {
                setDuplicateDecision(value);
                setSaveResult(null);
              }}
              preflightAccountMismatch={preflightAccountMismatch}
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
              }}
              onApply={() => {
                setIsCorrectionOpen(false);
              }}
              onClose={() => {
                setIsCorrectionOpen(false);
              }}
            />
          </section>
          <LedgerBaselineView baseline={baseline} onRefresh={loadBaseline} />
        </>
      ) : (
        <AccountSetupScreen onAccountCreated={loadBaseline} />
      )}
    </main>
  );
}

export default App;
