import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Bell, BellOff, X, ChefHat, CheckCircle, Package, Volume2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { isPushSupported, iosNeedsInstall, isIos, isStandalonePwa, subscribeToPush, getExistingSubscription } from "@/lib/push";
import IosInstallModal from "@/components/IosInstallModal";

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
  const [showIosInstallModal, setShowIosInstallModal] = useState(false);
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
    if (notificationsEnabled && typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(`הזמנה #${orderNumber}`, {
          body: message,
          icon: "🍔",
        });
      } catch {}
    }
  }, [order?.status, prevStatus, soundEnabled, notificationsEnabled, orderNumber]);

  // Live countdown timer — ticks every second regardless of status so we can
  // show "elapsed" while waiting and "remaining" while cooking.
  useEffect(() => {
    if (!order || order.status === "ready" || order.status === "completed") {
      setTimeLeft(null);
      return;
    }

    const update = () => {
      if (order.estimated_ready_at) {
        const diff = Math.max(0, Math.floor((new Date(order.estimated_ready_at).getTime() - Date.now()) / 1000));
        setTimeLeft(diff);
      } else {
        // no ETA yet — show elapsed since order was placed
        const elapsed = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000);
        setTimeLeft(-elapsed); // negative = elapsed
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [order]);


  // Auto-hide prompt if user already subscribed for this device
  useEffect(() => {
    getExistingSubscription().then((sub) => {
      if (sub) {
        setNotificationsEnabled(true);
        setShowPermissionPrompt(false);
      }
    });
  }, []);

  const handleEnableNotifications = useCallback(async () => {
    setSoundEnabled(true);

    // iOS check FIRST — on iOS Safari without PWA, Notification API doesn't exist.
    // Show a proper in-app modal with Add-to-Home-Screen instructions instead of
    // a broken native permission popup.
    if (iosNeedsInstall()) {
      setShowPermissionPrompt(false);
      setShowIosInstallModal(true);
      return;
    }

    // Browser doesn't support Web Push at all (e.g. older browser, in-app webview).
    // Don't try to call requestPermission — just inform the user.
    if (!isPushSupported()) {
      if (isIos()) {
        // iOS in PWA but still missing APIs (very old iOS)
        setShowPermissionPrompt(false);
        setShowIosInstallModal(true);
        return;
      }
      toast.error("הדפדפן לא תומך בהתראות דחיפה. נשאיר התראת קול בתוך האתר.");
      setShowPermissionPrompt(false);
      return;
    }

    // STEP 1: Request browser permission (only when supported)
    let permission: NotificationPermission = Notification.permission;
    if (permission === "default") {
      try {
        permission = await Notification.requestPermission();
      } catch {
        permission = "denied";
      }
    }

    if (permission !== "granted") {
      toast.error("לא ניתן אישור להתראות");
      setShowPermissionPrompt(false);
      return;
    }

    setNotificationsEnabled(true);

    // STEP 2: Subscribe to push immediately (orderId optional — looked up by phone server-side).
    const res = await subscribeToPush({ orderId: order?.id ?? null, customerPhone: phone });
    if (res.ok) {
      toast.success("מעולה! נעדכן אותך כשההזמנה מוכנה 🔔");
    } else {
      console.warn("[push] subscribe failed:", res.reason);
      toast.success("התראות הופעלו! 🔔");
    }
    setShowPermissionPrompt(false);
  }, [order?.id, phone]);

  const handleSkipNotifications = useCallback(() => {
    setShowPermissionPrompt(false);
  }, []);

  const formatTime = (seconds: number) => {
    const abs = Math.abs(seconds);
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const steps = [
    { key: "new", label: "התקבלה", icon: <Package size={20} /> },
    { key: "preparing", label: "בהכנה", icon: <ChefHat size={20} /> },
    { key: "ready", label: "מוכנה!", icon: <CheckCircle size={20} /> },
  ];

  const currentIndex = order ? Math.max(0, steps.findIndex((s) => s.key === order.status)) : 0;

  // Smooth overall progress (0-100) across the whole order lifecycle,
  // anchored to created_at → estimated_ready_at so it never jitters.
  const overallProgress = (() => {
    if (!order) return 0;
    if (order.status === "ready" || order.status === "completed") return 100;
    const start = new Date(order.created_at).getTime();
    const end = order.estimated_ready_at ? new Date(order.estimated_ready_at).getTime() : start + 15 * 60 * 1000;
    const now = Date.now();
    const pct = ((now - start) / (end - start)) * 100;
    // Never below the current step's minimum position, never past 95 until "ready"
    const stepFloor = (currentIndex / (steps.length - 1)) * 100;
    return Math.max(stepFloor, Math.min(95, pct));
  })();

  // Countdown timer % for the "preparing" card (0-100, fills toward ready)
  const cookingProgress = (() => {
    if (!order?.estimated_ready_at || timeLeft === null || timeLeft < 0) return 0;
    const start = new Date(order.updated_at || order.created_at).getTime();
    const end = new Date(order.estimated_ready_at).getTime();
    const total = Math.max(1, (end - start) / 1000);
    return Math.max(0, Math.min(100, 100 - (timeLeft / total) * 100));
  })();


  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
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
                  if (iosNeedsInstall() || !isPushSupported()) {
                    setShowIosInstallModal(true);
                    return;
                  }
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

          {/* Add to home screen button — hidden once installed as PWA */}
          {!isStandalonePwa() && (
            <div className="px-4 py-2 border-b border-border bg-primary/5">
              <button
                onClick={() => setShowIosInstallModal(true)}
                className="w-full flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold py-2.5 rounded-xl text-sm transition-colors"
              >
                <Smartphone size={16} />
                הוסף את הבקתה למסך הבית
              </button>
            </div>
          )}

          <AnimatePresence>
            {showPermissionPrompt && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-5 py-5 bg-gradient-to-b from-primary/10 to-primary/5 border-b border-border">
                  <div className="flex items-center justify-center mb-3">
                    <motion.div
                      animate={{ rotate: [0, -10, 10, -10, 0] }}
                      transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1.5 }}
                      className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center"
                    >
                      <Bell size={28} className="text-primary" />
                    </motion.div>
                  </div>
                  <p className="text-base font-black text-foreground text-center mb-1">
                    רוצה שנעדכן אותך כשההזמנה מוכנה?
                  </p>
                  <p className="text-xs text-muted-foreground text-center mb-4">
                    תקבל התראה לטלפון גם אם תצא מהאתר
                  </p>
                  <div className="flex gap-2">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      animate={{ boxShadow: ["0 0 0 0 hsl(142 76% 45% / 0.7)", "0 0 0 12px hsl(142 76% 45% / 0)"] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                      onClick={handleEnableNotifications}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white font-black py-3 rounded-xl text-sm shadow-lg"
                    >
                      כן, עדכנו אותי! 🔔
                    </motion.button>
                    <button
                      onClick={handleSkipNotifications}
                      className="px-4 bg-muted text-muted-foreground font-medium py-3 rounded-xl text-sm hover:bg-muted/80"
                    >
                      לא רוצה
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

        <IosInstallModal open={showIosInstallModal} onClose={() => setShowIosInstallModal(false)} />
      </motion.div>
    </AnimatePresence>
  );
};

export default OrderLiveTracker;
