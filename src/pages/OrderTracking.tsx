import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChefHat, CheckCircle, Package } from "lucide-react";

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
            <p className="text-2xl font-bold text-green-400">ההזמנה מוכנה! 🎉</p>
            <p className="text-sm text-muted-foreground mt-2">אפשר לאסוף</p>
          </div>
        )}

        {order.status === "completed" && (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <p className="text-lg text-foreground">ההזמנה הושלמה ✅</p>
            <p className="text-sm text-muted-foreground mt-2">בתיאבון!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderTracking;
