import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, MapPin, Bike, Bell, BellRing, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { isPushSupported, iosNeedsInstall, isIos, ensureServiceWorker } from "@/lib/push";

export interface DeliveryApprovedData {
  requestId: string;
  address: string;
  fee: number;
  zoneName: string;
  customerName: string;
  customerPhone: string;
}

interface DeliveryZone {
  id: string;
  name: string;
  price: number;
  keywords: string[];
  active: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onApproved: (data: DeliveryApprovedData) => void;
}

type Stage = "address" | "quoted" | "searching" | "rejected";

const matchZone = (address: string, zones: DeliveryZone[]): DeliveryZone | null => {
  const a = address.toLowerCase();
  for (const z of zones) {
    if (!z.active) continue;
    for (const kw of z.keywords) {
      const k = (kw || "").trim().toLowerCase();
      if (k && a.includes(k)) return z;
    }
  }
  return null;
};

const DeliveryFlow = ({ open, onClose, onApproved }: Props) => {
  const { customer, isLoggedIn } = useCustomerAuth();
  const [stage, setStage] = useState<Stage>("address");
  const [address, setAddress] = useState("");
  const [name, setName] = useState(isLoggedIn && customer ? customer.name : "");
  const [phone, setPhone] = useState(isLoggedIn && customer ? customer.phone : "");
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [matchedZone, setMatchedZone] = useState<DeliveryZone | null>(null);
  const [ackDelivery, setAckDelivery] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStage("address");
    setAckDelivery(false);
    setMatchedZone(null);
    setRequestId(null);
    supabase
      .from("delivery_zones")
      .select("id,name,price,keywords,active")
      .eq("active", true)
      .then(({ data }) => setZones((data as DeliveryZone[]) ?? []));
  }, [open]);

  // Poll request status
  useEffect(() => {
    if (!requestId || stage !== "searching") return;
    const channel = supabase
      .channel(`delivery-req-${requestId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "delivery_requests", filter: `id=eq.${requestId}` },
        async (payload) => {
          const row = payload.new as { status: string };
          if (row.status === "approved") {
            // Fire local/push notification if user opted in
            try {
              if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                const reg = await navigator.serviceWorker?.getRegistration("/sw.js");
                const title = "🛵 נמצא שליח!";
                const body = "השליח בדרך אליך — פתח/י את האפליקציה להשלמת ההזמנה";
                if (reg) {
                  reg.showNotification(title, { body, icon: "/favicon.ico", badge: "/favicon.ico", tag: "delivery-approved" });
                } else {
                  new Notification(title, { body, icon: "/favicon.ico" });
                }
              }
            } catch (e) { console.warn("notify failed", e); }
            onApproved({
              requestId,
              address,
              fee: matchedZone?.price ?? 0,
              zoneName: matchedZone?.name ?? "",
              customerName: name,
              customerPhone: phone,
            });
          } else if (row.status === "rejected") {
            setStage("rejected");
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [requestId, stage, address, matchedZone, name, phone, onApproved]);

  const [calculating, setCalculating] = useState(false);

  const handleCalculate = async () => {
    const a = address.trim();
    if (a.length < 5) {
      toast({ title: "כתובת קצרה מדי", description: "הזן/י כתובת מלאה", variant: "destructive" });
      return;
    }
    if (name.trim().length < 2) {
      toast({ title: "שם חסר", variant: "destructive" });
      return;
    }
    if (phone.trim().length < 7) {
      toast({ title: "טלפון חסר", variant: "destructive" });
      return;
    }

    setCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke("calculate-delivery-price", {
        body: { address: a },
      });
      if (!error && data && typeof data.price === "number") {
        setMatchedZone({
          id: "auto",
          name: `${data.km} ק"מ · ${data.minutes} דק'`,
          price: data.price,
          keywords: [],
          active: true,
        });
        setStage("quoted");
        return;
      }
      console.warn("Auto price failed, falling back to zones", error);
    } finally {
      setCalculating(false);
    }

    // Fallback: keyword-based zone matching
    const z = matchZone(a, zones);
    if (!z) {
      toast({ title: "לצערנו איננו מגיעים לאזור זה", description: "נסה/י כתובת אחרת", variant: "destructive" });
      return;
    }
    setMatchedZone(z);
    setStage("quoted");
  };

  const handleFindCourier = async () => {
    if (!matchedZone) return;
    if (!ackDelivery) {
      toast({ title: "יש לאשר את ההודעה", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from("delivery_requests")
      .insert({
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        address: address.trim(),
        zone_id: matchedZone.id === "auto" ? null : matchedZone.id,
        zone_name: matchedZone.name,
        price: matchedZone.price,
        status: "pending",
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast({ title: "שגיאה בשליחת בקשה", description: error?.message, variant: "destructive" });
      return;
    }
    setRequestId(data.id);
    setStage("searching");
  };

  const handleCancelSearch = async () => {
    if (requestId) {
      await supabase.from("delivery_requests").update({ status: "rejected" }).eq("id", requestId);
    }
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        dir="rtl"
      >
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          className="bg-card rounded-2xl w-full max-w-md p-6 shadow-2xl relative"
        >
          <button
            onClick={stage === "searching" ? handleCancelSearch : onClose}
            className="absolute top-3 left-3 p-2 rounded-full hover:bg-secondary text-muted-foreground"
            aria-label="סגור"
          >
            <X size={20} />
          </button>

          <h2 className="text-2xl font-black text-foreground mb-1 flex items-center gap-2">
            <Bike size={24} className="text-primary" />
            משלוח לבית
          </h2>

          {stage === "address" && (
            <div className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">מלא/י פרטים לחישוב עלות המשלוח</p>
              <div>
                <label className="block text-xs font-bold mb-1 text-foreground">שם מלא</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground"
                  placeholder="ישראל ישראלי"
                  maxLength={80}
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-foreground">טלפון</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground"
                  placeholder="050-0000000"
                  inputMode="tel"
                  maxLength={20}
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-foreground flex items-center gap-1">
                  <MapPin size={14} /> כתובת מלאה למשלוח
                </label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground"
                  placeholder="ישוב, רחוב ומספר בית"
                  maxLength={200}
                />
              </div>
              <button
                onClick={handleCalculate}
                disabled={calculating}
                className="w-full bg-primary text-primary-foreground font-black py-3 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {calculating && <Loader2 className="animate-spin" size={18} />}
                {calculating ? "מחשב מרחק..." : "חשב עלות משלוח"}
              </button>
            </div>
          )}

          {stage === "quoted" && matchedZone && (
            <div className="space-y-4 mt-4">
              <div className="rounded-xl bg-primary/10 border-2 border-primary/40 p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">אזור: {matchedZone.name}</p>
                <p className="text-3xl font-black text-primary">עלות המשלוח: {matchedZone.price}₪</p>
              </div>
              <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/40 p-3 text-sm text-foreground leading-relaxed">
                התשלום על המשלוח <b>אינו מתבצע באתר</b>.
                התשלום יתבצע ישירות לשליח בעת קבלת ההזמנה באמצעות <b>Bit</b> או במזומן.
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ackDelivery}
                  onChange={(e) => setAckDelivery(e.target.checked)}
                  className="mt-1 w-5 h-5 accent-primary"
                />
                <span className="text-sm text-foreground">
                  קראתי והבנתי שהתשלום על המשלוח יתבצע ישירות לשליח.
                </span>
              </label>
              <button
                onClick={handleFindCourier}
                disabled={!ackDelivery || submitting}
                className="w-full bg-green-600 text-white font-black py-3 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="animate-spin" size={18} /> : "🔍"}
                חפש לי שליח
              </button>
              <button
                onClick={() => setStage("address")}
                className="w-full text-sm text-muted-foreground hover:text-foreground"
              >
                חזרה לעריכת פרטים
              </button>
            </div>
          )}

          {stage === "searching" && (
            <div className="space-y-4 mt-6 text-center py-6">
              <Loader2 className="mx-auto animate-spin text-primary" size={48} />
              <p className="text-xl font-black text-foreground">🔍 מחפשים לך שליח</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                נעדכן אותך מיד כשיימצא שליח. נשאר במסך זה — ההזמנה תיפתח אוטומטית.
              </p>
              <button
                onClick={handleCancelSearch}
                className="text-sm text-destructive hover:underline"
              >
                ביטול הבקשה
              </button>
            </div>
          )}

          {stage === "rejected" && (
            <div className="space-y-4 mt-6 text-center py-4">
              <p className="text-4xl">😔</p>
              <p className="text-xl font-black text-foreground">מצטערים, לא נמצא שליח כרגע</p>
              <p className="text-sm text-muted-foreground">אפשר לנסות שוב בעוד כמה דקות או לבחור באיסוף עצמי</p>
              <button
                onClick={onClose}
                className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl"
              >
                סגור
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DeliveryFlow;
