// "עדכנו אותי כשנפתח": one SMS when we open (reopen_sms_* in the database).
// A signed-in customer is registered right away. Anyone else signs in with
// the SMS code first (CustomerAuthModal) - the same code also signs them in.
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import CustomerAuthModal from "@/components/CustomerAuthModal";

interface ReopenNotifyModalProps {
  open: boolean;
  onClose: () => void;
  /** Next opening, as shown on the closed card (day index 0-6, "HH:MM"). */
  nextOpenDay?: number | null;
  nextOpenAt?: string | null;
}

const DAY_NAMES_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

// The database function is newer than the generated types.
const rpc = (fn: string, args: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: { ok?: boolean; error?: string } | null; error: unknown }> }).rpc(fn, args);

const expectedText = (day: number | null | undefined, at: string | null | undefined): string | null => {
  if (!at || day === null || day === undefined) return null;
  const today = new Date().getDay();
  if (day === today) return `אנחנו צפויים להיפתח היום בסביבות ${at}`;
  if (day === (today + 1) % 7) return `אנחנו צפויים להיפתח מחר בסביבות ${at}`;
  return `אנחנו צפויים להיפתח ביום ${DAY_NAMES_HE[day]} בסביבות ${at}`;
};

type View = "working" | "done" | "error" | "signin";

const ReopenNotifyModal = ({ open, onClose, nextOpenDay, nextOpenAt }: ReopenNotifyModalProps) => {
  const { customer, isLoggedIn } = useCustomerAuth();
  const [view, setView] = useState<View>("working");
  const waitingForSignIn = useRef(false);

  const register = useCallback(async (phone: string, name: string) => {
    setView("working");
    try {
      const { data, error } = await rpc("reopen_sms_request", { p_phone: phone, p_name: name });
      if (!error && data?.ok) { setView("done"); return; }
      // Signed in on this device without the SMS code: ask for it now.
      if (data?.error === "phone_not_verified" && !waitingForSignIn.current) {
        waitingForSignIn.current = true;
        setView("signin");
        return;
      }
      setView("error");
    } catch {
      setView("error");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    waitingForSignIn.current = false;
    if (isLoggedIn && customer?.phone) void register(customer.phone, customer.name);
    else { waitingForSignIn.current = true; setView("signin"); }
    // Only when the window opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The sign-in sheet calls onClose and then onSuccess on its last button;
  // closing waits a tick so a success can cancel it and register instead.
  const closeTimer = useRef<number>();
  const customerRef = useRef(customer);
  customerRef.current = customer;

  if (!open) return null;

  if (view === "signin") {
    return (
      <CustomerAuthModal
        open
        onClose={() => { closeTimer.current = window.setTimeout(onClose, 0); }}
        onSuccess={() => {
          window.clearTimeout(closeTimer.current);
          const c = customerRef.current;
          if (c?.phone) void register(c.phone, c.name);
          else setView("error");
        }}
      />
    );
  }

  const expected = expectedText(nextOpenDay, nextOpenAt);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
        dir="rtl"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-card rounded-2xl p-6 max-w-md w-full border border-border relative text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={onClose} aria-label="סגירה" className="absolute top-3 left-3 p-2 rounded-full hover:bg-secondary transition-colors">
            <X size={18} />
          </button>

          {view === "working" && <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />}

          {view === "done" && (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="text-green-500" size={32} />
              </div>
              <h3 className="text-xl font-black">נעדכן אותך ב-SMS כשנפתח</h3>
              {expected && <p className="mt-2 text-muted-foreground">{expected}</p>}
              <button onClick={onClose} className="mt-6 w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl">
                מעולה
              </button>
            </>
          )}

          {view === "error" && (
            <>
              <h3 className="text-lg font-black">לא הצלחנו לרשום אותך כרגע</h3>
              <p className="mt-2 text-muted-foreground">נסו שוב בעוד כמה דקות.</p>
              <button onClick={onClose} className="mt-6 w-full bg-secondary font-bold py-3 rounded-xl">סגירה</button>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ReopenNotifyModal;
