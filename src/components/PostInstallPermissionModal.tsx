import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Sparkles, X, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import IosInstallModal from "@/components/IosInstallModal";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

const isIos = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) || (/Mac/.test(ua) && "ontouchend" in document);
};

const SEEN_KEY = "habakta_post_install_perm_seen"; // set ONLY when permission granted/denied permanently
const DISMISSED_AT_KEY = "habakta_post_install_perm_dismissed_at";
const INSTALLED_KEY = "habakta_pwa_installed";
// Re-ask cooldown after a "not now" dismissal (ms). Keep short so users get nudged again.
const REASK_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

const isStandalone = () => {
  if (typeof window === "undefined") return false;
  // @ts-ignore iOS Safari
  if (window.navigator.standalone === true) return true;
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
};

/**
 * After the user installs the PWA (Android `appinstalled` event) or opens
 * the app from the home-screen icon for the first time (iOS standalone),
 * show a friendly modal asking permission to enable real-time order updates
 * via browser notifications. Once approved, the OrderTopBar will surface
 * the live status / countdown until the order is marked completed.
 */
type Variant = "install" | "order";

const PostInstallPermissionModal = () => {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<Variant>("install");
  const [step, setStep] = useState<"ask" | "explain">("ask");
  const [iosInstallOpen, setIosInstallOpen] = useState(false);
  const { canPrompt, promptInstall } = useInstallPrompt();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const permanentlySeen = () => {
      try { return localStorage.getItem(SEEN_KEY) === "1"; } catch { return false; }
    };

    const inCooldown = () => {
      try {
        const v = localStorage.getItem(DISMISSED_AT_KEY);
        if (!v) return false;
        const ts = parseInt(v, 10);
        if (!Number.isFinite(ts)) return false;
        return Date.now() - ts < REASK_COOLDOWN_MS;
      } catch { return false; }
    };

    const maybeShow = (v: Variant, ignoreCooldown = false) => {
      // ONLY inside the installed app (PWA standalone). Web visitors are never nudged.
      if (!isStandalone()) return;
      // If permission already granted/denied, lock it in and stop asking.
      if (typeof Notification !== "undefined" && Notification.permission !== "default") {
        try { localStorage.setItem(SEEN_KEY, "1"); } catch {}
        return;
      }
      if (permanentlySeen()) return;
      if (!ignoreCooldown && inCooldown()) return;
      setVariant(v);
      setOpen(true);
    };

    // Case 1: Android — listen for installation event
    const onInstalled = () => {
      try { localStorage.setItem(INSTALLED_KEY, "1"); } catch {}
      setTimeout(() => maybeShow("install", true), 1500);
    };
    window.addEventListener("appinstalled", onInstalled);

    // Case 2: iOS / already installed — opened via home-screen icon
    if (isStandalone()) {
      try { localStorage.setItem(INSTALLED_KEY, "1"); } catch {}
      setTimeout(() => maybeShow("install"), 1200);
    }

    // Case 3: explicit request after a successful order
    const onRequest = () => maybeShow("order", true);
    window.addEventListener("request-notify-permission", onRequest);

    // Case 4: app re-focused / tab visible again — nudge again if still default
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (isStandalone()) maybeShow("install");
    };
    const onFocus = () => {
      if (isStandalone()) maybeShow("install");
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("request-notify-permission", onRequest);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const dismiss = (markSeen = true) => {
    if (markSeen) {
      // Soft dismiss — only set a cooldown timestamp, do NOT lock permanently.
      // We'll keep nudging until the user actually grants/denies permission.
      try { localStorage.setItem(DISMISSED_AT_KEY, String(Date.now())); } catch {}
    }
    setOpen(false);
    setStep("ask");
  };

  const handleEnable = async () => {
    if (typeof Notification === "undefined") {
      dismiss();
      return;
    }
    try {
      const result = await Notification.requestPermission();
      if (result === "granted") {
        try {
          new Notification("הבקתה 🔔", {
            body: "מעולה! מעכשיו תקבל עדכון בזמן אמת על ההזמנה שלך.",
            icon: "/icon-192.png",
          });
        } catch {}
      }
    } catch {}
    // Lock-in once user has actually responded to the OS prompt (granted OR denied) — stop nudging.
    try {
      if (typeof Notification !== "undefined" && Notification.permission !== "default") {
        localStorage.setItem(SEEN_KEY, "1");
      }
    } catch {}
    // After permission flow — if not installed yet, explain why to add to home screen
    if (!isStandalone()) {
      if (isIos()) {
        // On iOS: open the install instructions modal directly (it contains the why explanation)
        setOpen(false);
        setIosInstallOpen(true);
        try { localStorage.setItem(SEEN_KEY, "1"); } catch {}
      } else {
        setStep("explain");
      }
      return;
    }
    dismiss();
  };

  const handleAndroidInstall = async () => {
    const result = await promptInstall();
    if (result === "accepted" || result === "dismissed") {
      dismiss(true);
    } else {
      // Native prompt unavailable — keep modal open with the explanation
      dismiss(true);
    }
  };

  if (!open) {
    return (
      <IosInstallModal open={iosInstallOpen} onClose={() => setIosInstallOpen(false)} />
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={() => dismiss(false)}
        dir="rtl"
      >
        <motion.div
          initial={{ y: 80, scale: 0.95, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 24, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md rounded-3xl bg-card shadow-2xl border border-border overflow-hidden"
        >
          <button
            onClick={() => dismiss(false)}
            className="absolute top-3 left-3 w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
            aria-label="סגור"
          >
            <X size={16} />
          </button>

          {step === "ask" ? (
            <>
              <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pt-8 pb-4 text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.1 }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground shadow-lg mb-3"
                >
                  <Bell size={30} />
                </motion.div>
                <h2 className="text-xl font-black text-foreground flex items-center justify-center gap-2">
                  {variant === "order" ? <>רוצה להתעדכן בזמן אמת?</> : <>הבקתה מותקנת! <Sparkles size={18} className="text-primary" /></>}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {variant === "order" ? "מתי ההמבורגר שלך מוכן 🍔" : "רק עוד אישור קטן ואתה מסודר"}
                </p>
              </div>

              <div className="px-6 pb-6 pt-2 space-y-4">
                <p className="text-sm text-foreground leading-relaxed text-center">
                  {variant === "order" ? (
                    <>
                      אשר התראות ונעדכן אותך ברגע שההזמנה שלך
                      <br />
                      <span className="font-bold">עוברת להכנה ומוכנה לאיסוף ⏱️</span>
                      <br />
                      <span className="text-muted-foreground text-xs">
                        גם אם תסגור את הדפדפן — נשלח לך התראה
                      </span>
                    </>
                  ) : (
                    <>
                      אשר התראות כדי לראות בזמן אמת בחלון העליון
                      <br />
                      <span className="font-bold">עוד כמה זמן ההזמנה שלך מוכנה ⏱️</span>
                      <br />
                      <span className="text-muted-foreground text-xs">
                        (החלון יעלם אוטומטית ברגע שההזמנה תושלם)
                      </span>
                    </>
                  )}
                </p>

                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleEnable}
                    className="w-full h-12 text-base font-bold rounded-xl"
                    size="lg"
                  >
                    <Bell size={18} className="ml-2" />
                    כן, הפעל התראות
                  </Button>
                  <Button
                    onClick={() => dismiss(true)}
                    variant="ghost"
                    className="w-full text-sm text-muted-foreground"
                  >
                    לא עכשיו
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pt-8 pb-4 text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.1 }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground shadow-lg mb-3"
                >
                  <Home size={30} />
                </motion.div>
                <h2 className="text-xl font-black text-foreground flex items-center justify-center gap-2">
                  עוד צעד קטן 📲
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  שההתראות באמת יגיעו אליך בזמן
                </p>
              </div>

              <div className="px-6 pb-6 pt-2 space-y-4">
                <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4 text-right space-y-2">
                  <p className="text-sm text-foreground leading-relaxed">
                    הוסף את <b>הבקתה</b> למסך הבית של הטלפון 🏠✨
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    ככה ההתראה תקפוץ אצלך גם כשהדפדפן סגור — ותדע בדיוק
                    מתי ההמבורגר חם ומוכן לאיסוף 🍔🔔
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    בלי האייקון במסך הבית — חלק מהטלפונים (במיוחד אייפון)
                    פשוט לא יקפיצו לך התראה ⚠️
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {canPrompt ? (
                    <Button
                      onClick={handleAndroidInstall}
                      className="w-full h-12 text-base font-bold rounded-xl"
                      size="lg"
                    >
                      <Home size={18} className="ml-2" />
                      הוסף עכשיו למסך הבית 📲
                    </Button>
                  ) : (
                    <Button
                      onClick={() => dismiss(true)}
                      className="w-full h-12 text-base font-bold rounded-xl"
                      size="lg"
                    >
                      <Home size={18} className="ml-2" />
                      הבנתי, אוסיף ידנית
                    </Button>
                  )}
                  <Button
                    onClick={() => dismiss(true)}
                    variant="ghost"
                    className="w-full text-sm text-muted-foreground"
                  >
                    אולי אחר כך
                  </Button>
                </div>
              </div>
              <IosInstallModal open={iosInstallOpen} onClose={() => { setIosInstallOpen(false); dismiss(true); }} />
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PostInstallPermissionModal;
