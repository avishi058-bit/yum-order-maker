import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, MapPin, Bike, Bell, BellRing, Check, Crosshair } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { isPushSupported, iosNeedsInstall, isIos, ensureServiceWorker } from "@/lib/push";
import LocationPickerModal, { isExcludedText } from "./LocationPickerModal";

export interface DeliveryApprovedData {
  requestId: string;
  // Ownership token returned by the DB when the request was created.
  // Passed back to create-order so the server can finalize this request.
  clientToken: string;
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
    setPickedCoords(null);
    setAddress("");
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
  const [notifyStatus, setNotifyStatus] = useState<"idle" | "enabled" | "denied" | "unsupported" | "ios_install">(() => {
    if (typeof Notification === "undefined") return "unsupported";
    if (Notification.permission === "granted") return "enabled";
    return "idle";
  });
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [showNotifyHelp, setShowNotifyHelp] = useState(false);

  const handleEnableNotify = async () => {
    if (!isPushSupported()) {
      setNotifyStatus("unsupported");
      setShowNotifyHelp(true);
      return;
    }
    if (iosNeedsInstall()) {
      setNotifyStatus("ios_install");
      setShowNotifyHelp(true);
      return;
    }
    setNotifyBusy(true);
    try {
      await ensureServiceWorker();
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        setNotifyStatus("enabled");
        toast({ title: "מעולה! נעדכן אותך כשיימצא שליח 🛵" });
      } else {
        setNotifyStatus("denied");
        setShowNotifyHelp(true);
      }
    } finally {
      setNotifyBusy(false);
    }
  };


  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locatingQuick, setLocatingQuick] = useState(false);

  const runCalculate = async (payload: { address?: string; lat?: number; lng?: number; displayAddress?: string }) => {
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
        body: payload,
      });
      // Out-of-range (25 min limit) — surface friendly message
      const errAny = error as any;
      if (errAny) {
        try {
          const details = errAny?.context ? await errAny.context.json() : null;
          if (details?.error === "out_of_range") {
            toast({
              title: "מחוץ לאזור המשלוח",
              description: details.message ?? "אנחנו מבצעים משלוחים עד 25 דקות נסיעה בלבד.",
              variant: "destructive",
            });
            return true; // handled — don't fall through to zones
          }
        } catch { /* ignore */ }
      }
      if (!error && data && typeof data.price === "number") {
        const resolvedAddress = payload.displayAddress || data.address || "";
        if (isExcludedText(resolvedAddress)) {
          toast({
            title: "אין משלוחים לאזור זה",
            description: "לצערנו איננו מבצעים משלוחים לתושיה / כפר מימון.",
            variant: "destructive",
          });
          return true;
        }
        if (payload.displayAddress) setAddress(payload.displayAddress);
        else if (data.address) setAddress(data.address);
        setMatchedZone({
          id: "auto",
          name: `${data.km} ק"מ · ${data.minutes} דק'`,
          price: data.price,
          keywords: [],
          active: true,
        });
        setStage("quoted");
        return true;
      }
      console.warn("Auto price failed, falling back to zones", error);
      return false;
    } finally {
      setCalculating(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      toast({ title: "הדפדפן לא תומך במיקום", variant: "destructive" });
      return;
    }
    setLocatingQuick(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLocatingQuick(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPickedCoords(p);
        await runCalculate({ lat: p.lat, lng: p.lng });
      },
      (err) => {
        setLocatingQuick(false);
        toast({
          title: "לא הצלחנו לאתר את המיקום",
          description: err.code === 1 ? "יש לאשר גישה למיקום או לבחור על המפה" : "נסה/י שוב או בחר/י על המפה",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  const handleMapConfirm = async (loc: { lat: number; lng: number; address?: string }) => {
    setPickerOpen(false);
    setPickedCoords({ lat: loc.lat, lng: loc.lng });
    await runCalculate({ lat: loc.lat, lng: loc.lng, displayAddress: loc.address });
  };

  const handleCalculate = async () => {
    const a = address.trim();
    if (!pickedCoords && a.length < 5) {
      toast({ title: "בחר/י מיקום למשלוח", description: "השתמש/י במיקום הנוכחי או בחר/י על המפה", variant: "destructive" });
      return;
    }
    const ok = await runCalculate(
      pickedCoords ? { lat: pickedCoords.lat, lng: pickedCoords.lng } : { address: a },
    );
    if (ok) return;

    // Fallback: keyword-based zone matching
    const z = matchZone(a, zones);
    if (!z) {
      toast({ title: "לצערנו איננו מגיעים לאזור זה", description: "נסה/י מיקום אחר", variant: "destructive" });
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
        payout: matchedZone.price,
        lat: pickedCoords?.lat ?? null,
        lng: pickedCoords?.lng ?? null,
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
              <div className="space-y-2">
                <label className="block text-xs font-bold text-foreground flex items-center gap-1">
                  <MapPin size={14} /> מיקום למשלוח
                </label>

                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={locatingQuick || calculating}
                  className="w-full bg-primary text-primary-foreground font-black py-3 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {locatingQuick ? <Loader2 className="animate-spin" size={18} /> : <Crosshair size={18} />}
                  {locatingQuick ? "מאתר מיקום..." : "השתמש/י במיקום הנוכחי שלי"}
                </button>

                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  disabled={calculating}
                  className="w-full bg-secondary border-2 border-border text-foreground font-bold py-2.5 rounded-xl hover:bg-secondary/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <MapPin size={16} className="text-primary" />
                  בחר/י מיקום אחר על המפה
                </button>

                {address && (
                  <div className="mt-2 rounded-lg bg-secondary/60 border border-border p-2.5 text-xs text-foreground flex items-start gap-2">
                    <MapPin size={14} className="text-primary shrink-0 mt-0.5" />
                    <span className="flex-1 leading-relaxed">{address}</span>
                  </div>
                )}

                {calculating && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-1">
                    <Loader2 className="animate-spin" size={16} /> מחשב מרחק ומחיר...
                  </div>
                )}
              </div>
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

              {notifyStatus === "enabled" ? (
                <div className="rounded-xl bg-green-500/10 border border-green-500/40 p-3 text-sm text-foreground flex items-center justify-center gap-2">
                  <Check size={18} className="text-green-500" />
                  ההתראות מופעלות — נעדכן אותך ברגע שיימצא שליח
                </div>
              ) : (
                <>
                  <button
                    onClick={handleEnableNotify}
                    disabled={notifyBusy}
                    className="w-full bg-primary/15 border-2 border-primary/40 text-foreground font-bold py-3 rounded-xl hover:bg-primary/25 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {notifyBusy ? <Loader2 className="animate-spin" size={18} /> : <BellRing size={18} className="text-primary" />}
                    עדכנו אותי כשמגיע שליח
                  </button>
                  <button
                    onClick={() => setShowNotifyHelp((v) => !v)}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    {showNotifyHelp ? "הסתר הוראות" : "איך זה עובד?"}
                  </button>
                </>
              )}

              {showNotifyHelp && notifyStatus !== "enabled" && (
                <div className="rounded-lg bg-secondary/60 border border-border p-3 text-right text-xs text-foreground leading-relaxed space-y-2">
                  <p className="font-bold flex items-center gap-1 justify-end">
                    <Bell size={14} className="text-primary" />
                    כדי לקבל התראה כשיימצא שליח:
                  </p>
                  {notifyStatus === "ios_install" || isIos() ? (
                    <ol className="list-decimal pr-5 space-y-1">
                      <li>לחצו על כפתור השיתוף בסאפארי <b>⬆︎</b> ובחרו <b>"הוסף למסך הבית"</b>.</li>
                      <li>פתחו את האפליקציה מהאייקון שנוצר במסך הבית.</li>
                      <li>חזרו למסך זה ולחצו שוב על <b>"עדכנו אותי"</b> ואשרו התראות.</li>
                      <li>אפשר לצאת מהאפליקציה — נשלח לכם התראה כשיימצא שליח.</li>
                    </ol>
                  ) : notifyStatus === "denied" ? (
                    <ol className="list-decimal pr-5 space-y-1">
                      <li>ההתראות חסומות בדפדפן. פתחו את הגדרות האתר (סמל 🔒 בסרגל הכתובת).</li>
                      <li>שנו את "התראות" ל<b>"אפשר"</b>.</li>
                      <li>רעננו את הדף ולחצו שוב על <b>"עדכנו אותי"</b>.</li>
                    </ol>
                  ) : notifyStatus === "unsupported" ? (
                    <p>הדפדפן שלכם לא תומך בהתראות. השאירו את המסך פתוח — ההזמנה תיפתח אוטומטית כשיימצא שליח.</p>
                  ) : (
                    <ol className="list-decimal pr-5 space-y-1">
                      <li>לחצו על <b>"עדכנו אותי כשמגיע שליח"</b>.</li>
                      <li>אשרו את בקשת ההתראות שתופיע בדפדפן.</li>
                      <li>אפשר לסגור את המסך — נשלח לכם התראה ברגע שיימצא שליח 🛵</li>
                    </ol>
                  )}
                </div>
              )}

              <a
                href="tel:0584633555"
                className="w-full inline-flex items-center justify-center gap-2 bg-secondary border border-border text-foreground font-bold py-3 rounded-xl hover:bg-secondary/80 transition-colors"
              >
                📞 לעוד פרטים התקשרו
              </a>

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
      <LocationPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={handleMapConfirm}
        initial={pickedCoords}
      />
    </AnimatePresence>
  );
};

export default DeliveryFlow;
