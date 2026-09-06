import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OnWayButtonProps {
  orderNumber: number;
  phone?: string | null;
  /** Already confirmed on the server (order.customer_on_way_at). */
  alreadyOnWay?: boolean;
  /** Auto-confirm on mount (used when the customer arrives from the push action). */
  autoConfirm?: boolean;
  className?: string;
  compact?: boolean;
}

/**
 * "ראיתי — אני בדרך" confirmation. Shown everywhere the customer may be
 * looking when the order turns ready (tracking page, live tracker modal,
 * top bar) so the kitchen reliably learns the customer is coming.
 */
const OnWayButton = ({
  orderNumber,
  phone,
  alreadyOnWay,
  autoConfirm,
  className = "",
  compact,
}: OnWayButtonProps) => {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(!!alreadyOnWay);
  const autoRan = useRef(false);

  useEffect(() => {
    if (alreadyOnWay) setDone(true);
  }, [alreadyOnWay]);

  const confirm = async (silent = false) => {
    if (!phone || loading || done) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("get-order-by-token", {
      body: { order_number: orderNumber, phone, action: "on_way" },
    });
    setLoading(false);
    if (error || !data?.order) {
      if (!silent) toast.error("לא הצלחנו לעדכן, נסו שוב");
      return;
    }
    setDone(true);
    toast.success("עדכנו את המטבח שאתם בדרך 🚗");
  };

  useEffect(() => {
    if (!autoConfirm || autoRan.current || done || !phone) return;
    autoRan.current = true;
    confirm(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConfirm, phone, done]);

  if (done) {
    return (
      <div
        className={`bg-green-500/20 border border-green-500/40 rounded-xl py-3 px-4 text-center ${className}`}
      >
        <p className="font-bold text-green-500">מעולה, עדכנו את המטבח שאתם בדרך 🚗</p>
      </div>
    );
  }

  return (
    <button
      onClick={() => confirm()}
      disabled={loading || !phone}
      className={`w-full bg-green-500 text-white font-black rounded-2xl shadow-lg hover:brightness-110 active:scale-[0.98] transition animate-pulse disabled:opacity-60 ${
        compact ? "py-3 text-base" : "py-5 text-xl"
      } ${className}`}
    >
      {loading ? "רגע..." : "ראיתי — אני בדרך 🚗"}
    </button>
  );
};

export default OnWayButton;
