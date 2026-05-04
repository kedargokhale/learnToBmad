import { useCallback, useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";

import { AccountSetupScreen } from "./features/ledger/components/AccountSetupScreen";
import { LedgerBaselineView } from "./features/ledger/components/LedgerBaselineView";
import {
  getLedgerBaseline,
  type LedgerBaselineData,
} from "./features/ledger/service";
import "./App.css";

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
    <main className="app-shell">
      {baseline?.account ? (
        <LedgerBaselineView baseline={baseline} onRefresh={loadBaseline} />
      ) : (
        <AccountSetupScreen onAccountCreated={loadBaseline} />
      )}
    </main>
  );
}

export default App;
