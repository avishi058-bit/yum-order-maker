import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Share, Plus, MoreVertical, CheckCircle2, Download, Smartphone, ExternalLink, Copy, Check, ArrowDown } from "lucide-react";
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

const StepInstallGuide = ({ onDone, onClose }: Props) => {
  const [platform, setPlatform] = useState<Platform>("desktop");
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
  const isSingleStep = total === 1;

  const handleSingleAction = async () => {
    if (platform === "android" && canPrompt) {
      const res = await promptInstall();
      if (res === "accepted") onDone?.();
      return;
    }
    onDone?.();
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
      {/* Platform badge */}
      <div className="text-center mb-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {platform === "ios-safari" && "🍎 אייפון · Safari"}
          {platform === "ios-other" && "🍎 אייפון"}
          {platform === "android" && "🤖 אנדרואיד"}
          {platform === "desktop" && "💻 מחשב"}
        </span>
      </div>

      {isSingleStep ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border-2 border-primary/30 rounded-2xl p-5 shadow-lg"
        >
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-amber-500/20 flex items-center justify-center text-primary mb-4"
          >
            {steps[0].icon}
          </motion.div>
          <h3 className="text-xl font-black text-center mb-3 text-foreground">
            {steps[0].title}
          </h3>
          <div className="text-base font-medium text-foreground leading-relaxed text-center">
            {steps[0].body}
          </div>
        </motion.div>
      ) : (
        <div className="space-y-2.5">
          <p className="text-center text-sm font-bold text-foreground mb-1">
            כל השלבים בבת אחת — קראו לפני שמתחילים 👇
          </p>
          {steps.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-card border-2 border-primary/25 rounded-2xl p-4 shadow-md flex items-start gap-3"
            >
              <div className="flex-none w-9 h-9 rounded-full bg-primary text-primary-foreground font-black text-lg flex items-center justify-center">
                {i + 1}
              </div>
              <div className="flex-1 text-right">
                <h4 className="text-base font-black text-foreground leading-tight mb-1">
                  {s.title}
                </h4>
                <div className="text-sm font-medium text-foreground/90 leading-relaxed">
                  {s.body}
                </div>
                {s.hint === "bottom" && (
                  <p className="text-xs text-primary font-bold mt-1">⬇️ בתחתית המסך</p>
                )}
                {s.hint === "top-right" && (
                  <p className="text-xs text-primary font-bold mt-1">⬆️ בפינה הימנית העליונה</p>
                )}
              </div>
            </motion.div>
          ))}
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3 text-center">
            <p className="text-xs font-bold text-foreground">
              💡 טיפ: תפריט השיתוף מכסה את המסך — לכן כל השלבים כאן ביחד, אין צורך לחזור לאתר בין לבין
            </p>
          </div>
        </div>
      )}

      {/* Single action button */}
      <div className="mt-5">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSingleAction}
          className="w-full bg-primary text-primary-foreground font-black py-4 rounded-xl text-base shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
        >
          {platform === "android" && canPrompt ? (
            <>
              <Download size={20} />
              התקינו עכשיו
            </>
          ) : (
            <>סיימתי 👍</>
          )}
        </motion.button>
      </div>
    </div>
  );
};

export default StepInstallGuide;
