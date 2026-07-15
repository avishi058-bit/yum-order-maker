import { Turnstile } from "react-turnstile";

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  action?: string;
}

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

export default function TurnstileWidget({ onVerify, onError, onExpire, action }: TurnstileWidgetProps) {
  // In development, render a placeholder so the UI works without a real key.
  if (!siteKey) {
    return (
      <div className="p-3 rounded-xl border border-dashed border-border bg-secondary/40 text-center text-xs text-muted-foreground">
        ⚠️ Turnstile לא מוגדר (חסר Site Key)
      </div>
    );
  }

  return (
    <div className="flex justify-center" dir="ltr">
      <Turnstile
        sitekey={siteKey}
        onVerify={onVerify}
        onError={onError}
        onExpire={onExpire}
        action={action || "submit-order"}
        theme="auto"
        language="he"
        retry="auto"
        fixedSize={true}
        className="overflow-hidden rounded-xl"
      />
    </div>
  );
}
