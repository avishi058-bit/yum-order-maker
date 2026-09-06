import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChefHat, CheckCircle, Package, Bell, BellRing } from "lucide-react";

import { toast } from "sonner";
import GoogleReviewCard from "@/components/GoogleReviewCard";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import {
  isPushSupported,
  iosNeedsInstall,
  subscribeToPush,
  getExistingSubscription,
} from "@/lib/push";

/**
 * Public order tracking page. Requires both order number AND phone in the URL
 * (e.g. /track?order=123&phone=0501234567) — phone acts as the auth token.
 * Data is fetched via the secure `get-order-by-token` edge function.
 */
const OrderTracking = () => {
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get("order");
  const phone = searchParams.get("phone");
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [pushState, setPushState] = useState<"idle" | "subscribing" | "subscribed">("idle");
  const [onWayLoading, setOnWayLoading] = useState(false);
  const { settings } = useSiteSettings();

  // הלקוח מאשר שראה שההזמנה מוכנה והוא בדרך – המטבח רואה את זה
  const markOnWay = async () => {
    if (!orderNumber || !phone) return;
    setOnWayLoading(true);
    const { data, error } = await supabase.functions.invoke("get-order-by-token", {
      body: { order_number: parseInt(orderNumber), phone, action: "on_way" },
    });
    setOnWayLoading(false);
    if (error || !data?.order) {
      toast.error("לא הצלחנו לעדכן, נסו שוב");
      return;
    }
    setOrder(data.order);
    toast.success("עדכנו את המטבח שאתם בדרך 🚗");
  };


  useEffect(() => {
    if (!orderNumber || !phone) return;

    const fetchOrder = async () => {
      const { data, error: fnError } = await supabase.functions.invoke(
        "get-order-by-token",
        { body: { order_number: parseInt(orderNumber), phone } },
      );
      if (fnError || !data?.order) {
        setError("not_found");
        return;
      }
      setOrder(data.order);
    };

    fetchOrder();
    // Poll every 10s — realtime would expose channel access; polling is safer here
    const interval = setInterval(fetchOrder, 10000);
    return () => clearInterval(interval);
  }, [orderNumber, phone]);

  // Countdown timer
  useEffect(() => {
    if (!order?.estimated_ready_at || order.status === "ready" || order.status === "completed") {
      setTimeLeft(null);
      return;
    }

    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(order.estimated_ready_at).getTime() - Date.now()) / 1000));
      setTimeLeft(diff);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [order]);

  // Detect existing push subscription
  useEffect(() => {
    if (!order?.id) return;
    getExistingSubscription().then((sub) => {
      if (sub) setPushState("subscribed");
    });
  }, [order?.id]);

  const handleEnablePush = async () => {
    if (!order?.id) return;
    if (iosNeedsInstall()) {
      toast.message("ב-iPhone צריך להוסיף את האתר למסך הבית כדי לקבל התראות", {
        description: "שתף → הוסף למסך הבית, ואז חזור לכאן",
      });
      return;
    }
    setPushState("subscribing");
    const res = await subscribeToPush({ orderId: order.id, customerPhone: phone ?? undefined });
    if (res.ok) {
      setPushState("subscribed");
      toast.success("התראות הופעלו ✅");
    } else {
      setPushState("idle");
      const msg =
        res.reason === "denied" ? "לא ניתן אישור להתראות" :
        res.reason === "unsupported" ? "הדפדפן לא תומך בהתראות" :
        "לא ניתן להפעיל התראות";
      toast.error(msg);
    }
  };

  if (!orderNumber || !phone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <p className="text-muted-foreground">קישור לא תקין — חסר מספר הזמנה או טלפון</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <p className="text-muted-foreground">הזמנה לא נמצאה</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="animate-pulse text-muted-foreground">טוען...</div>
      </div>
    );
  }

  const steps = [
    { key: "new", label: "התקבלה", icon: <Package size={24} /> },
    { key: "preparing", label: "בהכנה", icon: <ChefHat size={24} /> },
    { key: "ready", label: "מוכנה!", icon: <CheckCircle size={24} /> },
  ];

  const currentIndex = steps.findIndex((s) => s.key === order.status);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progress = timeLeft !== null && order.estimated_ready_at
    ? Math.max(0, Math.min(100, 100 - (timeLeft / ((new Date(order.estimated_ready_at).getTime() - new Date(order.updated_at).getTime()) / 1000)) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-foreground mb-1">הזמנה #{order.order_number}</h1>
          <p className="text-muted-foreground">{order.customer_name}</p>
        </div>

        <div className="flex items-center justify-between mb-10 px-4">
          {steps.map((step, i) => {
            const isActive = i <= currentIndex;
            const isCurrent = i === currentIndex;
            return (
              <div key={step.key} className="flex flex-col items-center gap-2 relative">
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 ${
                    isCurrent
                      ? "bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/30"
                      : isActive
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.icon}
                </div>
                <span className={`text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.label}
                </span>
                {i < steps.length - 1 && (
                  <div
                    className={`absolute top-7 -left-10 w-8 h-0.5 ${
                      i < currentIndex ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {order.status === "preparing" && timeLeft !== null && (
          <div className="bg-card border border-border rounded-2xl p-6 text-center mb-6">
            <p className="text-sm text-muted-foreground mb-2">זמן משוער עד שהמנה מוכנה</p>
            <div className="text-5xl font-black text-primary mb-4">
              {timeLeft === 0 ? "כמעט מוכן! 🔥" : formatTime(timeLeft)}
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {order.status === "new" && (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <p className="text-lg text-foreground">ההזמנה התקבלה! ⏳</p>
            <p className="text-sm text-muted-foreground mt-2">ממתינים שהמטבח יתחיל להכין</p>
          </div>
        )}

        {order.status === "ready" && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center">
            <p className="text-2xl font-bold text-green-400">ההזמנה מוכנה ✅🥳</p>
            <p className="text-sm text-muted-foreground mt-2">אפשר לאסוף</p>

            <OnWayButton
              orderNumber={parseInt(orderNumber)}
              phone={phone}
              alreadyOnWay={!!order.customer_on_way_at}
              autoConfirm={searchParams.get("onway") === "1"}
              className="mt-5"
            />
          </div>
        )}



        {order.status === "completed" && (
          <>
            <div className="bg-card border border-border rounded-2xl p-6 text-center">
              <p className="text-lg text-foreground">ההזמנה הושלמה ✅</p>
              <p className="text-sm text-muted-foreground mt-2">בתיאבון!</p>
            </div>
            <GoogleReviewCard url={settings.google_review_url} completedAt={order.updated_at} className="mt-4" />
          </>
        )}

        {/* Waze navigation — visible on the timer screen for all live statuses */}
        {(order.status === "new" || order.status === "preparing" || order.status === "ready") && (
          <a
            href="https://waze.com/ul?q=דרך%20ערבי%20נחל%2023%20תושיה"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 w-full flex items-center justify-center gap-2 bg-[#33ccff] text-white font-bold py-3 rounded-xl hover:opacity-90 transition shadow-md"
          >
            <img src="/waze-icon.png" alt="Waze" className="w-5 h-5" />
            נווט למסעדה עם Waze
          </a>
        )}

        {/* Push notification opt-in — hidden when order is already done */}
        {order.status !== "ready" && order.status !== "completed" && order.status !== "cancelled" && isPushSupported() && (
          <div className="mt-6">
            {pushState === "subscribed" ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-card border border-border rounded-xl py-3">
                <BellRing size={16} className="text-primary" />
                התראות פעילות ✅
              </div>
            ) : (
              <button
                onClick={handleEnablePush}
                disabled={pushState === "subscribing"}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3 rounded-xl hover:opacity-90 transition disabled:opacity-50"
              >
                <Bell size={18} />
                {pushState === "subscribing" ? "מפעיל..." : "אשר התראות כדי שנדע להודיע לך כשההזמנה מוכנה"}
              </button>
            )}
            {iosNeedsInstall() && pushState !== "subscribed" && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                ב-iPhone: שתף → "הוסף למסך הבית" כדי שההתראות יעבדו
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderTracking;
