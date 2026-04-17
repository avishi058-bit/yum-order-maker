import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { ChefHat, CheckCircle, Package, X, Bell, BellOff, Volume2 } from "lucide-react";

const NOTIFICATION_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

const STORAGE_KEY = "habakta_tracked_order";

interface TrackedOrder {
  orderNumber: number;
  /** Phone used at checkout — required to authorize order reads via the secure endpoint. */
  phone?: string;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
}

export const getTrackedOrder = (): TrackedOrder | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setTrackedOrder = (order: TrackedOrder | null) => {
  if (order) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
};

const OrderTopBar = () => {
  const [tracked, setTracked] = useState<TrackedOrder | null>(getTrackedOrder);
  const [order, setOrder] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [prevStatus, setPrevStatus] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Listen for custom event when a new order is placed
  useEffect(() => {
    const handler = (e: CustomEvent<TrackedOrder>) => {
      setTracked(e.detail);
      setTrackedOrder(e.detail);
      setExpanded(true);
    };
    window.addEventListener("track-order", handler as EventListener);
    return () => window.removeEventListener("track-order", handler as EventListener);
  }, []);

  // Fetch order data + realtime
  useEffect(() => {
    if (!tracked) return;

    const fetchOrder = async () => {
      // Secure path — requires phone token. Older saved trackers without phone
      // gracefully stop fetching (will be cleared on next manual close).
      if (!tracked.phone) return;
      const { data } = await supabase.functions.invoke("get-order-by-token", {
        body: { order_number: tracked.orderNumber, phone: tracked.phone },
      });
      const fetched = data?.order;
      if (fetched) {
        setOrder((prev: any) => {
          if (prev && prev.status !== fetched.status) {
            setPrevStatus(prev.status);
          }
          return fetched;
        });
        if (fetched.status === "completed" || fetched.status === "cancelled") {
          setTimeout(() => {
            setTracked(null);
            setTrackedOrder(null);
          }, 30000);
        }
      }
    };

    fetchOrder();
    // Poll every 8s instead of realtime (no public DB channel access)
    const interval = setInterval(fetchOrder, 8000);
    return () => clearInterval(interval);
  }, [tracked?.orderNumber, tracked?.phone]);

  // Sound & notification on status change
  useEffect(() => {
    if (!order || !prevStatus || prevStatus === order.status || !tracked) return;

    const statusLabels: Record<string, string> = {
      preparing: "ההזמנה שלך בהכנה! 👨‍🍳",
      ready: "ההזמנה מוכנה! 🎉 אפשר לאסוף",
      completed: "ההזמנה הושלמה! בתיאבון! ✅",
    };

    const message = statusLabels[order.status];
    if (!message) return;

    if (tracked.soundEnabled) {
      try {
        const audio = new Audio(NOTIFICATION_SOUND_URL);
        audio.volume = 0.7;
        audio.play().catch(() => {});
      } catch {}
    }

    if (tracked.notificationsEnabled && Notification.permission === "granted") {
      try {
        new Notification(`הזמנה #${tracked.orderNumber}`, {
          body: message,
          icon: "🍔",
          tag: `order-${tracked.orderNumber}`,
        });
      } catch {}
    }
  }, [order?.status, prevStatus, tracked]);

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

  const updatePrefs = (key: keyof TrackedOrder, value: any) => {
    if (!tracked) return;
    const updated = { ...tracked, [key]: value };
    setTracked(updated);
    setTrackedOrder(updated);
  };

  const handleClose = () => {
    setTracked(null);
    setTrackedOrder(null);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!tracked || !order) return null;

  const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    new: { label: "ממתינה", icon: <Package size={16} />, color: "bg-yellow-500" },
    preparing: { label: "בהכנה", icon: <ChefHat size={16} />, color: "bg-primary" },
    ready: { label: "מוכנה!", icon: <CheckCircle size={16} />, color: "bg-green-500" },
    completed: { label: "הושלמה", icon: <CheckCircle size={16} />, color: "bg-muted" },
  };

  const cfg = statusConfig[order.status] || statusConfig.new;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -80, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="sticky top-0 z-50 w-full"
        dir="rtl"
      >
        {/* Compact bar */}
        <div
          className={`${cfg.color} text-white px-4 py-2.5 cursor-pointer transition-colors`}
          onClick={() => setExpanded(!expanded)}
        >
          <div className="max-w-screen-lg mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                animate={order.status === "ready" ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              >
                {cfg.icon}
              </motion.div>
              <span className="font-bold text-sm">
                הזמנה #{tracked.orderNumber} · {cfg.label}
              </span>
              {timeLeft !== null && order.status === "preparing" && (
                <span className="font-mono text-xs bg-white/20 px-2 py-0.5 rounded-full">
                  ⏱ {formatTime(timeLeft)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); updatePrefs("soundEnabled", !tracked.soundEnabled); }}
                className="w-7 h-7 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/30 transition-colors"
              >
                <Volume2 size={13} className={tracked.soundEnabled ? "" : "opacity-40"} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!tracked.notificationsEnabled && Notification.permission !== "granted") {
                    Notification.requestPermission().then((p) => {
                      if (p === "granted") updatePrefs("notificationsEnabled", true);
                    });
                  } else {
                    updatePrefs("notificationsEnabled", !tracked.notificationsEnabled);
                  }
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/30 transition-colors"
              >
                {tracked.notificationsEnabled ? <Bell size={13} /> : <BellOff size={13} className="opacity-40" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleClose(); }}
                className="w-7 h-7 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/30 transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Expanded details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-card border-b border-border shadow-lg"
            >
              <div className="max-w-screen-lg mx-auto px-4 py-4">
                {/* Progress steps */}
                <div className="flex items-center justify-center gap-4 mb-3">
                  {[
                    { key: "new", label: "התקבלה", icon: <Package size={18} /> },
                    { key: "preparing", label: "בהכנה", icon: <ChefHat size={18} /> },
                    { key: "ready", label: "מוכנה!", icon: <CheckCircle size={18} /> },
                  ].map((step, i, arr) => {
                    const stepIndex = arr.findIndex((s) => s.key === order.status);
                    const isActive = i <= stepIndex;
                    const isCurrent = i === stepIndex;
                    return (
                      <div key={step.key} className="flex items-center gap-3">
                        <div className="flex flex-col items-center gap-1">
                          <motion.div
                            animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                              isCurrent
                                ? "bg-primary text-primary-foreground shadow-md"
                                : isActive
                                ? "bg-primary/20 text-primary"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {step.icon}
                          </motion.div>
                          <span className={`text-xs font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                            {step.label}
                          </span>
                        </div>
                        {i < arr.length - 1 && (
                          <div className={`w-8 h-0.5 ${i < stepIndex ? "bg-primary" : "bg-muted"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Timer */}
                {order.status === "preparing" && timeLeft !== null && (
                  <div className="text-center">
                    <span className="text-xs text-muted-foreground">זמן משוער: </span>
                    <span className="text-lg font-black text-primary">{timeLeft === 0 ? "כמעט מוכן! 🔥" : formatTime(timeLeft)}</span>
                  </div>
                )}

                {order.status === "new" && (
                  <p className="text-center text-sm text-muted-foreground">ההזמנה התקבלה ⏳ ממתינים שהמטבח יתחיל להכין</p>
                )}

                {order.status === "ready" && (
                  <motion.p
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    className="text-center text-lg font-bold text-green-500"
                  >
                    ההזמנה מוכנה! 🎉 אפשר לאסוף
                  </motion.p>
                )}

                {order.status === "completed" && (
                  <p className="text-center text-sm text-muted-foreground">ההזמנה הושלמה ✅ בתיאבון!</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default OrderTopBar;
