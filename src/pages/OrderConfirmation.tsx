import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Payment confirmation screen shown after returning from the hosted checkout.
 * The green confirmation only appears once the server confirms the payment
 * actually went through (order left the `pending_payment` state).
 */
const OrderConfirmation = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "paid" | "failed">("checking");
  const [orderNumber, setOrderNumber] = useState<number | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let stopped = false;
    let tries = 0;

    const check = async () => {
      tries += 1;
      const { data, error } = await supabase.functions.invoke("get-payment-status", {
        body: { orderId },
      });
      if (stopped) return;
      // Success screen ONLY when the server confirms a full, completed charge.
      if (!error && data?.paid === true) {
        setOrderNumber(data.orderNumber ?? null);
        setState("paid");
        return;
      }
      if (data?.cancelled === true) {
        setState("failed");
        return;
      }
      if (tries >= 45) {
        setState("failed");
        return;
      }
      setTimeout(check, 2000);
    };


    check();
    return () => { stopped = true; };
  }, [orderId]);

  const goTrack = () => {
    let phone = "";
    try {
      const raw = localStorage.getItem("habakta_last_order_customer");
      if (raw) phone = JSON.parse(raw)?.phone ?? "";
    } catch { /* ignore */ }
    if (orderNumber && phone) navigate(`/track?order=${orderNumber}&phone=${encodeURIComponent(phone)}`);
    else navigate("/");
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center p-4">
      {state === "checking" && (
        <div className="text-center space-y-3">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">מאמתים את התשלום…</p>
        </div>
      )}

      {state === "failed" && (
        <div className="text-center space-y-4 max-w-sm">
          <h1 className="text-2xl font-black text-foreground">לא הצלחנו לאמת את התשלום</h1>
          <p className="text-muted-foreground">
            אם חויבת, ההזמנה תתעדכן תוך רגע. אפשר לרענן את הדף או ליצור איתנו קשר.
          </p>
          <button
            onClick={() => navigate("/")}
            className="rounded-full bg-primary px-8 py-3 font-black text-primary-foreground"
          >
            חזרה לתפריט
          </button>
        </div>
      )}

      {state === "paid" && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md rounded-3xl border-2 border-green-500 bg-card p-8 text-center shadow-2xl"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 12, delay: 0.1 }}
            className="mx-auto mb-5 flex h-28 w-28 items-center justify-center rounded-full bg-green-500/15"
          >
            <CheckCircle2 className="h-20 w-20 text-green-500" strokeWidth={2.5} />
          </motion.div>

          <h1 className="text-3xl font-black text-green-500">איזה כיף! התשלום עבר בהצלחה!</h1>
          <p className="mt-3 text-lg text-foreground">חשבונית נשלחה אליך במייל :)</p>

          {orderNumber != null && (
            <div className="my-6 rounded-2xl bg-muted/60 py-5">
              <div className="text-sm text-muted-foreground">מספר הזמנה</div>
              <div className="text-5xl font-black text-foreground">#{orderNumber}</div>
            </div>
          )}

          <button
            onClick={goTrack}
            className="mt-2 w-full rounded-full bg-green-600 py-4 text-lg font-black text-white transition-transform active:scale-95"
          >
            למעקב אחרי ההזמנה לחץ כאן
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default OrderConfirmation;
