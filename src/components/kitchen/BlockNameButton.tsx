import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { normalizeBlockedName } from "@/lib/nameValidation";

type Step = "closed" | "menu" | "confirm";

/**
 * Hidden "⋯" control next to the customer name on a kitchen order card.
 * Blocking takes two deliberate clicks after opening it: "חסום שם" then "כן, לחסום".
 */
export function BlockNameButton({ name }: { name: string }) {
  const [step, setStep] = useState<Step>("closed");
  const [saving, setSaving] = useState(false);

  const block = async () => {
    setSaving(true);
    // Table is newer than the generated types, hence the untyped access.
    const { error } = await (supabase as unknown as { from: (t: string) => { insert: (v: object) => Promise<{ error: { code?: string } | null }> } })
      .from("blocked_customer_names")
      .insert({ name: name.trim(), normalized: normalizeBlockedName(name) });
    setSaving(false);
    setStep("closed");
    if (!error || error.code === "23505") {
      toast.success(`השם "${name.trim()}" נחסם להזמנות הבאות`);
    } else {
      toast.error("לא הצלחנו לחסום את השם, נסו שוב");
    }
  };

  if (step === "closed") {
    return (
      <button
        type="button"
        onClick={() => setStep("menu")}
        aria-label="אפשרויות שם"
        className="px-1.5 text-muted-foreground/60 hover:text-muted-foreground text-sm leading-none"
      >
        ⋯
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      {step === "menu" ? (
        <button
          type="button"
          onClick={() => setStep("confirm")}
          className="px-2 py-1 rounded-md bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
        >
          חסום שם
        </button>
      ) : (
        <button
          type="button"
          onClick={block}
          disabled={saving}
          className="px-2 py-1 rounded-md bg-destructive text-destructive-foreground font-bold disabled:opacity-60"
        >
          {saving ? "חוסם..." : "כן, לחסום"}
        </button>
      )}
      <button
        type="button"
        onClick={() => setStep("closed")}
        className="px-1.5 py-1 text-muted-foreground hover:text-foreground"
      >
        ביטול
      </button>
    </span>
  );
}
