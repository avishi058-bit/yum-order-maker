import { useState, useCallback, useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";
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
  const [loaded, setLoaded] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setVerified(false);
    setFailed(false);
  }, [reloadKey]);

  useEffect(() => {
    if (loaded || verified || failed) return;
    const timeout = window.setTimeout(() => {
      setFailed(true);
    }, 8000);

    return () => window.clearTimeout(timeout);
  }, [reloadKey, loaded, verified, failed]);

  const handleError = useCallback((error: unknown) => {
    console.error("Turnstile error", error);
    setFailed(true);
    setLoaded(true);
    setVerified(false);
    onError?.();
  }, [onError]);

  const handleReload = () => {
    setFailed(false);
    setLoaded(false);
    setVerified(false);
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
    <div className="flex flex-col items-center gap-2 min-h-[96px] w-full" dir="ltr">
      {!loaded && !verified && !failed && (
        <div className="flex h-[65px] w-full max-w-[300px] items-center justify-center gap-2 rounded-lg border border-border bg-background text-xs text-muted-foreground" dir="rtl">
          <Loader2 className="h-4 w-4 animate-spin" />
          טוען אימות אבטחה...
        </div>
      )}
      <Turnstile
        key={reloadKey}
        sitekey={siteKey}
        onVerify={(token) => {
          setFailed(false);
          setLoaded(true);
          setVerified(true);
          onVerify(token);
        }}
        onLoad={() => setLoaded(true)}
        onError={handleError}
        onExpire={() => {
          setVerified(false);
          onExpire?.();
        }}
        onTimeout={handleError}
        onUnsupported={handleError}
        action={action || "submit-order"}
        theme="light"
        language="he"
        size="flexible"
        retry="auto"
        refreshExpired="auto"
        appearance="always"
        fixedSize={true}
        style={{ display: failed ? "none" : loaded || verified ? "block" : "none" }}
      />
      {failed && (
        <div className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-background p-3 text-center" dir="rtl">
          <p className="text-xs font-semibold text-foreground">האימות לא נטען כמו שצריך.</p>
          <button
            type="button"
            onClick={handleReload}
            className="inline-flex items-center gap-2 text-xs font-bold text-primary underline"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            רענון אימות
          </button>
        </div>
      )}
    </div>
  );
}
