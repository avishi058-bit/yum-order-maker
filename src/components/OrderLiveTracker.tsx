import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Bell, BellOff, X, ChefHat, CheckCircle, Package, Volume2 } from "lucide-react";

interface OrderLiveTrackerProps {
  orderNumber: number;
  /** Phone used at checkout — required to authorize order reads via the secure endpoint. */
  phone: string;
  onClose: () => void;
}

const NOTIFICATION_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

const OrderLiveTracker = ({ orderNumber, phone, onClose }: OrderLiveTrackerProps) => {
  const [order, setOrder] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(true);
  const [prevStatus, setPrevStatus] = useState<string | null>(null);

  // Fetch order via secure edge function (no direct DB access)
  useEffect(() => {
    const fetchOrder = async () => {
      const { data } = await supabase.functions.invoke("get-order-by-token", {
        body: { order_number: orderNumber, phone },
      });
      const fetched = data?.order;
      if (fetched) {
        setOrder((prev: any) => {
          if (prev && prev.status !== fetched.status) {
            setPrevStatus(prev.status);
          }
          return fetched;
        });
      }
    };

    fetchOrder();
    // Poll every 8s instead of realtime (no public DB channel access)
    const interval = setInterval(fetchOrder, 8000);
    return () => clearInterval(interval);
  }, [orderNumber]);

  // Play sound & send notification on status change
  useEffect(() => {
    if (!order || !prevStatus || prevStatus === order.status) return;

    const statusLabels: Record<string, string> = {
      preparing: "ההזמנה שלך בהכנה! 👨‍🍳",
      ready: "ההזמנה מוכנה! 🎉 אפשר לאסוף",
      completed: "ההזמנה הושלמה! בתיאבון! ✅",
    };

    const message = statusLabels[order.status];
    if (!message) return;

    // Play sound
    if (soundEnabled) {
      try {
        const audio = new Audio(NOTIFICATION_SOUND_URL);
        audio.volume = 0.7;
        audio.play().catch(() => {});
      } catch {}
    }

    // Send browser notification
    if (notificationsEnabled && Notification.permission === "granted") {
      try {
        new Notification(`הזמנה #${orderNumber}`, {
          body: message,
          icon: "🍔",
        });
      } catch {}
    }
  }, [order?.status, prevStatus, soundEnabled, notificationsEnabled, orderNumber]);

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

  const handleEnableNotifications = useCallback(async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setNotificationsEnabled(true);
      }
    } catch {}
    setSoundEnabled(true);
    setShowPermissionPrompt(false);
  }, []);

  const handleSkipNotifications = useCallback(() => {
    setShowPermissionPrompt(false);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const steps = [
    { key: "new", label: "התקבלה", icon: <Package size={20} /> },
    { key: "preparing", label: "בהכנה", icon: <ChefHat size={20} /> },
    { key: "ready", label: "מוכנה!", icon: <CheckCircle size={20} /> },
  ];

  const currentIndex = order ? steps.findIndex((s) => s.key === order.status) : 0;

  const progress = timeLeft !== null && order?.estimated_ready_at
    ? Math.max(0, Math.min(100, 100 - (timeLeft / ((new Date(order.estimated_ready_at).getTime() - new Date(order.updated_at).getTime()) / 1000)) * 100))
    : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
        dir="rtl"
      >
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="bg-card w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl border border-border overflow-hidden max-h-[85vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
            >
              <X size={16} />
            </button>
            <h2 className="text-lg font-black text-foreground">הזמנה #{orderNumber}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  soundEnabled ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                <Volume2 size={14} />
              </button>
              <button
                onClick={() => {
                  if (!notificationsEnabled && Notification.permission !== "granted") {
                    Notification.requestPermission().then((p) => {
                      if (p === "granted") setNotificationsEnabled(true);
                    });
                  } else {
                    setNotificationsEnabled(!notificationsEnabled);
                  }
                }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  notificationsEnabled ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {notificationsEnabled ? <Bell size={14} /> : <BellOff size={14} />}
              </button>
            </div>
          </div>

          {/* Permission prompt */}
          <AnimatePresence>
            {showPermissionPrompt && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-5 py-4 bg-primary/5 border-b border-border">
                  <p className="text-sm font-bold text-foreground mb-1">🔔 רוצה לקבל עדכונים בזמן אמת?</p>
                  <p className="text-xs text-muted-foreground mb-3">נעדכן אותך כשההזמנה בהכנה וכשהיא מוכנה עם צליל והתראה</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleEnableNotifications}
                      className="flex-1 bg-primary text-primary-foreground font-bold py-2.5 rounded-xl text-sm"
                    >
                      כן, עדכנו אותי! 🔔
                    </button>
                    <button
                      onClick={handleSkipNotifications}
                      className="px-4 bg-muted text-muted-foreground font-medium py-2.5 rounded-xl text-sm"
                    >
                      לא עכשיו
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {!order ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-pulse text-muted-foreground text-sm">טוען...</div>
              </div>
            ) : (
              <>
                {/* Progress Steps */}
                <div className="flex items-center justify-between mb-6 px-2">
                  {steps.map((step, i) => {
                    const isActive = i <= currentIndex;
                    const isCurrent = i === currentIndex;
                    return (
                      <div key={step.key} className="flex flex-col items-center gap-1.5 relative">
                        <motion.div
                          animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${
                            isCurrent
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
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
                        {i < steps.length - 1 && (
                          <div
                            className={`absolute top-6 -left-8 w-6 h-0.5 ${
                              i < currentIndex ? "bg-primary" : "bg-muted"
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Timer */}
                {order.status === "preparing" && timeLeft !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-muted/50 rounded-2xl p-5 text-center mb-4"
                  >
                    <p className="text-xs text-muted-foreground mb-1">זמן משוער עד שההזמנה מוכנה</p>
                    <div className="text-4xl font-black text-primary mb-3">
                      {timeLeft === 0 ? "כמעט מוכן! 🔥" : formatTime(timeLeft)}
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <motion.div
                        className="bg-primary h-full rounded-full"
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 1 }}
                      />
                    </div>
                  </motion.div>
                )}

                {/* Status messages */}
                {order.status === "new" && (
                  <div className="bg-muted/50 rounded-2xl p-5 text-center">
                    <p className="text-base font-bold text-foreground">ההזמנה התקבלה! ⏳</p>
                    <p className="text-xs text-muted-foreground mt-1">ממתינים שהמטבח יתחיל להכין</p>
                  </div>
                )}

                {order.status === "ready" && (
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 text-center"
                  >
                    <p className="text-xl font-bold text-green-400">ההזמנה מוכנה! 🎉</p>
                    <p className="text-xs text-muted-foreground mt-1">אפשר לאסוף</p>
                  </motion.div>
                )}

                {order.status === "completed" && (
                  <div className="bg-muted/50 rounded-2xl p-5 text-center">
                    <p className="text-base font-bold text-foreground">ההזמנה הושלמה ✅</p>
                    <p className="text-xs text-muted-foreground mt-1">בתיאבון!</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-border">
            <button
              onClick={onClose}
              className="w-full bg-muted text-foreground font-bold py-3 rounded-xl text-sm hover:bg-muted/80 transition-colors"
            >
              סגור
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OrderLiveTracker;
