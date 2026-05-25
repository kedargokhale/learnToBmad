import { useEffect } from "react";

type SaveConfirmationToastProps = {
  message: string | null;
  onClear: () => void;
  durationMs?: number;
};

export function SaveConfirmationToast({
  message,
  onClear,
  durationMs = 2500,
}: SaveConfirmationToastProps) {
  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      onClear();
    }, durationMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [durationMs, message, onClear]);

  if (!message) {
    return null;
  }

  return (
    <div
      className="capture-confirmation-toast"
      role="status"
      aria-live="polite"
      aria-label="Capture confirmation"
    >
      <strong>{message}</strong>
    </div>
  );
}
