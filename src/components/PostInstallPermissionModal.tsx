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

const SEEN_KEY = "habakta_post_install_perm_seen";
const INSTALLED_KEY = "habakta_pwa_installed";

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

    const alreadySeen = () => {
      try { return localStorage.getItem(SEEN_KEY) === "1"; } catch { return false; }
    };

    const maybeShow = (v: Variant, ignoreSeen = false) => {
      if (!ignoreSeen && alreadySeen()) return;
      // Don't ask if notifications already decided (granted or denied)
      if (typeof Notification !== "undefined" && Notification.permission !== "default") {
        try { localStorage.setItem(SEEN_KEY, "1"); } catch {}
        return;
      }
      setVariant(v);
      setOpen(true);
    };

    // Case 1: Android — listen for installation event
    const onInstalled = () => {
      try { localStorage.setItem(INSTALLED_KEY, "1"); } catch {}
      setTimeout(() => maybeShow("install"), 1500);
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

    return () => {
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("request-notify-permission", onRequest);
    };
  }, []);

  const dismiss = (markSeen = true) => {
    if (markSeen) {
      try { localStorage.setItem(SEEN_KEY, "1"); } catch {}
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
    // After permission flow — if not installed yet, explain why to add to home screen
    if (!isStandalone()) {
      setStep("explain");
      return;
    }
    dismiss();
  };

  if (!open) return null;

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
                  {isIos() ? (
                    <Button
                      onClick={() => setIosInstallOpen(true)}
                      className="w-full h-12 text-base font-bold rounded-xl"
                      size="lg"
                    >
                      <Home size={18} className="ml-2" />
                      איך מוסיפים? תראו לי 👀
                    </Button>
                  ) : (
                    <Button
                      onClick={() => dismiss(true)}
                      className="w-full h-12 text-base font-bold rounded-xl"
                      size="lg"
                    >
                      <Home size={18} className="ml-2" />
                      הבנתי, אוסיף למסך הבית
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
