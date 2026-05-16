import type { AccountMismatchResolution } from "../schema";

type AccountMismatchResolverProps = {
  value: AccountMismatchResolution | null;
  parsedBankName?: string | null;
  parsedAccountNumber?: string | null;
  selectedBankName: string;
  selectedAccountNumber: string;
  onChange: (value: AccountMismatchResolution) => void;
};

export function AccountMismatchResolver({
  value,
  parsedBankName,
  parsedAccountNumber,
  selectedBankName,
  selectedAccountNumber,
  onChange,
}: AccountMismatchResolverProps) {
  return (
    <section className="blocked-reasons" aria-label="Account mismatch resolution">
      <strong>Account mismatch detected</strong>
      <p>
        Parsed account details do not match the selected ledger account. You must choose one option before save validation can continue.
      </p>
      <ul>
        <li>
          Selected account: {selectedBankName} / {selectedAccountNumber}
        </li>
        <li>
          Parsed account: {parsedBankName ?? "Unknown bank"} / {parsedAccountNumber ?? "Unknown account"}
        </li>
      </ul>

      <fieldset>
        <legend>Mismatch resolution</legend>
        <label>
          <input
            type="radio"
            name="mismatch-resolution"
            value="use-selected-account"
            checked={value === "use-selected-account"}
            onChange={() => onChange("use-selected-account")}
          />
          Keep selected account and continue validation
        </label>
        <label>
          <input
            type="radio"
            name="mismatch-resolution"
            value="use-parsed-account"
            checked={value === "use-parsed-account"}
            onChange={() => onChange("use-parsed-account")}
          />
          Treat parsed account as intended and continue validation
        </label>
      </fieldset>
    </section>
  );
}
