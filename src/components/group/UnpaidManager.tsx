// Organizer only: who has not paid yet, and what to do about it - pay for
// them, take them out, or send the order to the kitchen without them.
// Opens by itself when the organizer arrives from the "stuck group" SMS link.
import { useState } from "react";
import type { GroupMember } from "@/lib/groupSession";

type Props = {
  unpaid: GroupMember[];
  paidCount: number;
  busy: string | null;
  initiallyOpen: boolean;
  onPay: (orderId: string) => void;
  onRemove: (orderId: string) => void;
  onSendWithout: () => void;
};

const pill = "h-12 rounded-[2rem] font-black transition-all active:scale-[0.98] disabled:opacity-50";

const UnpaidManager = ({ unpaid, paidCount, busy, initiallyOpen, onPay, onRemove, onSendWithout }: Props) => {
  const [open, setOpen] = useState(initiallyOpen);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const count = unpaid.length;

  return (
    <div className="rounded-2xl border-2 border-amber-500/60 bg-card p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`${pill} w-full bg-amber-500 text-black`}
      >
        מי עוד לא שילם ({count})
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {unpaid.map((m) => (
            <div key={m.order_id} className="rounded-xl border border-border p-3">
              <p className="text-lg font-black">{m.name}</p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => onPay(m.order_id)}
                  disabled={!!busy}
                  className={`${pill} flex-1 bg-primary text-primary-foreground`}
                >
                  {busy === `pay-${m.order_id}` ? "פותח תשלום..." : `לשלם עבור ${m.name}`}
                </button>
                <button
                  onClick={() => {
                    if (confirmRemove === m.order_id) { setConfirmRemove(null); onRemove(m.order_id); }
                    else setConfirmRemove(m.order_id);
                  }}
                  disabled={!!busy}
                  className={`${pill} border-2 px-4 ${confirmRemove === m.order_id ? "border-destructive bg-destructive/15 text-destructive" : "border-border"}`}
                >
                  {confirmRemove === m.order_id ? "בטוח? להוציא" : "להוציא מההזמנה"}
                </button>
              </div>
            </div>
          ))}

          {paidCount > 0 && (
            confirmSend ? (
              <div className="space-y-2 rounded-xl border-2 border-destructive/50 bg-destructive/10 p-3 text-center">
                <p className="text-lg font-black">
                  {count === 1 ? "בטוח? אדם אחד לא ייכלל בהזמנה" : `בטוח? ${count} אנשים לא ייכללו בהזמנה`}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setConfirmSend(false); onSendWithout(); }}
                    disabled={!!busy}
                    className={`${pill} flex-1 bg-green text-white`}
                  >
                    {busy === "send-without" ? "שולחים..." : "כן, לשלוח"}
                  </button>
                  <button onClick={() => setConfirmSend(false)} className={`${pill} flex-1 border-2 border-border`}>
                    חזרה
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmSend(true)}
                disabled={!!busy}
                className={`${pill} w-full bg-green text-white`}
              >
                לשלוח למטבח בלי מי שלא שילם
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default UnpaidManager;
