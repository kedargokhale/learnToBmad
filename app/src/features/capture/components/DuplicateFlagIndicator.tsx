import type { DuplicateDecision } from "../schema";

type DuplicateFlagIndicatorProps = {
  value: DuplicateDecision | null;
  reason?: string;
  fingerprint?: string;
  onChange: (value: DuplicateDecision) => void;
};

export function DuplicateFlagIndicator({
  value,
  reason,
  fingerprint,
  onChange,
}: DuplicateFlagIndicatorProps) {
  return (
    <section className="blocked-reasons" aria-label="Duplicate decision">
      <strong>Possible duplicate detected</strong>
      <p>
        This message matches duplicate-candidate rules. Choose a deterministic action before save validation can continue.
      </p>
      {reason ? <p>Rule: {reason}</p> : null}
      {fingerprint ? <p>Signal fingerprint: {fingerprint}</p> : null}

      <fieldset>
        <legend>Duplicate decision</legend>
        <label>
          <input
            type="radio"
            name="duplicate-decision"
            value="save-as-new"
            checked={value === "save-as-new"}
            onChange={() => onChange("save-as-new")}
          />
          Continue as a new transaction candidate
        </label>
        <label>
          <input
            type="radio"
            name="duplicate-decision"
            value="skip-save"
            checked={value === "skip-save"}
            onChange={() => onChange("skip-save")}
          />
          Skip save for this message
        </label>
      </fieldset>
    </section>
  );
}
