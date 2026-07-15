import { useState, useCallback } from "react";
import { Turnstile } from "react-turnstile";

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  action?: string;
}

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

export default function TurnstileWidget({ onVerify, onError, onExpire, action }: TurnstileWidgetProps) {
  const [reloadKey, setReloadKey] = useState(0);
  const [failed, setFailed] = useState(false);

  const handleError = useCallback((error: unknown) => {
    console.error("Turnstile error", error);
    setFailed(true);
    onError?.();
  }, [onError]);

  const handleReload = () => {
    setFailed(false);
    setReloadKey((k) => k + 1);
  };

  if (!siteKey) {
    return (
      <div className="p-3 rounded-xl border border-dashed border-border bg-secondary/40 text-center text-xs text-muted-foreground">
        ⚠️ Turnstile לא מוגדר (חסר Site Key)
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 min-h-[75px] w-full" dir="ltr">
      <Turnstile
        key={reloadKey}
        sitekey={siteKey}
        onVerify={(token) => {
          setFailed(false);
          onVerify(token);
        }}
        onError={handleError}
        onExpire={onExpire}
        action={action || "submit-order"}
        theme="light"
        language="he"
        retry="auto"
        refreshExpired="auto"
        fixedSize={true}
      />
      {failed && (
        <button
          type="button"
          onClick={handleReload}
          className="text-xs text-primary underline"
          dir="rtl"
        >
          לא נטען? לחץ כאן לרענון האימות
        </button>
      )}
    </div>
  );
}
