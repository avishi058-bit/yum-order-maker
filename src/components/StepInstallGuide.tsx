import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share, Plus, MoreVertical, ChevronLeft, CheckCircle2, Download, Smartphone, ExternalLink, Copy, Check, ArrowDown } from "lucide-react";
import { isIos, isStandalonePwa } from "@/lib/push";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

type Platform = "ios-safari" | "ios-other" | "android" | "desktop" | "standalone";

const detectPlatform = (): Platform => {
  if (typeof window === "undefined") return "desktop";
  if (isStandalonePwa()) return "standalone";
  const ua = navigator.userAgent || "";
  if (isIos()) {
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua);
    return isSafari ? "ios-safari" : "ios-other";
  }
  if (/Android/i.test(ua)) return "android";
  return "desktop";
};

interface Step {
  title: string;
  body: React.ReactNode;
  icon: React.ReactNode;
  // Visual hint about where on the screen to look
  hint?: "bottom" | "top-right" | "none";
}

interface Props {
  onDone?: () => void;
  onClose?: () => void;
  compact?: boolean;
}

const StepInstallGuide = ({ onDone, onClose, compact = false }: Props) => {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [stepIdx, setStepIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const { canPrompt, promptInstall } = useInstallPrompt();

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  useEffect(() => {
    const onInstalled = () => onDone?.();
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, [onDone]);

  const steps: Step[] = useMemo(() => {
    if (platform === "ios-safari") {
      return [
        {
          title: "לחצו על כפתור השיתוף",
          body: (
            <p>
              בסרגל התחתון של Safari — האייקון של <b>ריבוע עם חץ למעלה</b>{" "}
              <Share className="inline text-primary -mt-1" size={18} />
            </p>
          ),
          icon: <Share size={40} />,
          hint: "bottom",
        },
        {
          title: 'גללו ובחרו "הוספה למסך הבית"',
          body: (
            <p>
              גללו כלפי מטה בתפריט עד שתראו את השורה{" "}
              <b>"הוספה למסך הבית"</b>{" "}
              <Plus className="inline text-primary -mt-1" size={16} /> — ולחצו עליה
            </p>
          ),
          icon: <ArrowDown size={40} />,
          hint: "none",
        },
        {
          title: 'לחצו "הוסף" בפינה',
          body: (
            <p>
              יופיע חלון בשם <b>"הבקתה"</b>. לחצו על <b>"הוסף"</b> בפינה הימנית העליונה — וזהו! 🎉
            </p>
          ),
          icon: <CheckCircle2 size={40} className="text-green-600" />,
          hint: "top-right",
        },
      ];
    }
    if (platform === "ios-other") {
      const url = typeof window !== "undefined" ? window.location.origin : "";
      return [
        {
          title: "פתחו קודם ב-Safari",
          body: (
            <div className="space-y-3">
              <p>
                באייפון, כדי להוסיף אפליקציה למסך הבית — צריך <b>דפדפן Safari</b>{" "}
                (הדפדפן הכחול עם המצפן 🧭), לא Chrome.
              </p>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {}
                }}
                className="w-full bg-secondary text-foreground font-bold py-3 rounded-xl flex items-center justify-center gap-2 border border-border"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? "הועתק!" : "העתיקו את הקישור"}
              </button>
              <p className="text-xs text-muted-foreground text-center">
                פתחו Safari, הדביקו והמשיכו את ההוראות שם
              </p>
            </div>
          ),
          icon: <ExternalLink size={40} />,
          hint: "none",
        },
      ];
    }
    if (platform === "android") {
      if (canPrompt) {
        return [
          {
            title: "מוכנים להתקנה!",
            body: (
              <p>
                לחצו על הכפתור למטה, ואשרו את ההתקנה בחלון שיקפוץ. האייקון יופיע במסך הבית ⚡
              </p>
            ),
            icon: <Download size={40} />,
            hint: "none",
          },
        ];
      }
      return [
        {
          title: "פתחו את תפריט הדפדפן",
          body: (
            <p>
              לחצו על <b>שלוש הנקודות</b> <MoreVertical className="inline text-primary -mt-1" size={18} /> בפינה הימנית העליונה של הדפדפן
            </p>
          ),
          icon: <MoreVertical size={40} />,
          hint: "top-right",
        },
        {
          title: 'בחרו "התקן אפליקציה"',
          body: (
            <p>
              בתפריט חפשו <b>"התקן אפליקציה"</b> או <b>"הוסף למסך הבית"</b> — לחצו על השורה
            </p>
          ),
          icon: <Download size={40} />,
          hint: "none",
        },
        {
          title: "אשרו את ההתקנה",
          body: <p>לחצו <b>"התקן"</b> בחלון שיקפוץ — האייקון יופיע במסך הבית 🎉</p>,
          icon: <CheckCircle2 size={40} className="text-green-600" />,
          hint: "none",
        },
      ];
    }
    // desktop
    return [
      {
        title: "פתחו את האתר בטלפון",
        body: (
          <p>
            כדי להתקין את הבקתה כאפליקציה במסך הבית — פתחו את האתר{" "}
            <b>{typeof window !== "undefined" ? window.location.host : ""}</b> בטלפון
            (אייפון או אנדרואיד).
          </p>
        ),
        icon: <Smartphone size={40} />,
        hint: "none",
      },
    ];
  }, [platform, canPrompt, copied]);

  const total = steps.length;
  const step = steps[stepIdx];
  const isLast = stepIdx === total - 1;

  const handleNext = async () => {
    if (platform === "android" && canPrompt && stepIdx === 0) {
      const res = await promptInstall();
      if (res === "accepted") {
        onDone?.();
      }
      return;
    }
    if (isLast) {
      onDone?.();
      return;
    }
    setStepIdx((i) => Math.min(total - 1, i + 1));
  };

  if (platform === "standalone") {
    return (
      <div className="text-center py-4">
        <CheckCircle2 className="mx-auto text-green-600 mb-3" size={56} />
        <h3 className="text-xl font-black mb-2">היישום כבר מותקן! ✅</h3>
        <p className="text-sm text-muted-foreground">אתם משתמשים בגרסה המותקנת של הבקתה</p>
        {onClose && (
          <button onClick={onClose} className="mt-6 w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl">
            סגור
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full" dir="rtl">
      {/* Progress dots */}
      {total > 1 && (
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {steps.map((_, i) => (
            <motion.div
              key={i}
              animate={{
                width: i === stepIdx ? 24 : 8,
                backgroundColor: i <= stepIdx ? "hsl(var(--primary))" : "hsl(var(--muted))",
              }}
              className="h-2 rounded-full"
            />
          ))}
        </div>
      )}

      {/* Platform badge */}
      <div className="text-center mb-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {platform === "ios-safari" && "🍎 אייפון · Safari"}
          {platform === "ios-other" && "🍎 אייפון"}
          {platform === "android" && "🤖 אנדרואיד"}
          {platform === "desktop" && "💻 מחשב"}
          {total > 1 && ` · שלב ${stepIdx + 1} מתוך ${total}`}
        </span>
      </div>

      {/* Step card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={stepIdx}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.25 }}
          className="bg-card border-2 border-primary/30 rounded-2xl p-5 shadow-lg"
        >
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-amber-500/20 flex items-center justify-center text-primary mb-4"
          >
            {step.icon}
          </motion.div>
          <h3 className="text-xl font-black text-center mb-3 text-foreground">
            {step.title}
          </h3>
          <div className="text-base font-medium text-foreground leading-relaxed text-center">
            {step.body}
          </div>

          {/* Visual hint arrow */}
          {step.hint === "bottom" && (
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              className="text-center mt-4 text-primary text-3xl"
              aria-hidden
            >
              ⬇️
            </motion.div>
          )}
          {step.hint === "top-right" && (
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              className="text-right mt-4 text-primary text-3xl pr-2"
              aria-hidden
            >
              ⬆️
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Actions */}
      <div className="mt-5 space-y-2">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleNext}
          className="w-full bg-primary text-primary-foreground font-black py-4 rounded-xl text-base shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
        >
          {platform === "android" && canPrompt && stepIdx === 0 ? (
            <>
              <Download size={20} />
              התקינו עכשיו
            </>
          ) : isLast ? (
            <>סיימתי 👍</>
          ) : (
            <>
              הבנתי, הבא <ChevronLeft size={20} />
            </>
          )}
        </motion.button>

        {stepIdx > 0 && (
          <button
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            className="w-full text-sm font-bold text-muted-foreground py-2"
          >
            חזרה לשלב הקודם
          </button>
        )}
      </div>
    </div>
  );
};

export default StepInstallGuide;
