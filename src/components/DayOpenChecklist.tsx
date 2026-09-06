import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface ChecklistItem {
  item_id: string;
  item_name: string;
  available: boolean;
}

// תוספות חשובות שנשאל עליהן בפתיחת יום (רק אם כבויות)
export const IMPORTANT_TOPPING_IDS = [
  "roastbeef",
  "egg",
  "onion-rings-topping",
  "hot-pepper-jam",
  "onion-jam",
  "vegan-cheddar",
];

// מטוגנים שנשאל עליהם בפתיחת יום (רק אם כבויים)
// הערה: tempura-onion תלוי ב-onion-rings — אם טבעות בצל כבויות גם הטמפורה כבוי,
// לכן אין צורך לשאול עליו בנפרד.
export const FRIED_IDS = [
  "fries",
  "sweet-potato-fries",
  "onion-rings",
  "friends-mix",
];

// "שחוט לי פרה" (אבישי) – דורש רוסטביף וביצת עין
const AVISHAI_IDS = ["avishai", "meal-avishai"];
const AVISHAI_DEPS = ["roastbeef", "egg"];

// יום עסקי מתחיל ב-06:00 – לפני 6 בבוקר זה עדיין "אתמול"
const todayKey = () => {
  const d = new Date();
  if (d.getHours() < 6) d.setDate(d.getDate() - 1);
  return `dayOpenChecklist:${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export const shouldShowDayOpenChecklist = () => {
  try {
    return localStorage.getItem(todayKey()) !== "done";
  } catch {
    return false;
  }
};

export const markDayOpenChecklistDone = () => {
  try {
    localStorage.setItem(todayKey(), "done");
  } catch {
    /* noop */
  }
};

interface Props {
  items: ChecklistItem[];
  onEnable: (itemIds: string[]) => Promise<void> | void;
  onClose: () => void;
}

type Step = { id: string; title: string; subtitle?: string; enableIds: string[] };

const DayOpenChecklist = ({ items, onEnable, onClose }: Props) => {
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  const byId = useMemo(() => {
    const m: Record<string, ChecklistItem> = {};
    items.forEach((i) => (m[i.item_id] = i));
    return m;
  }, [items]);

  const steps = useMemo<Step[]>(() => {
    const list: Step[] = [];

    // שלב 1: תזכורת עדכון מלאי (תמיד)
    list.push({ id: "__inventory__", title: "", enableIds: [] });

    // שלב 2: שחוט לי פרה – רק אם המנה או אחד המרכיבים כבויים
    const avishaiOff =
      AVISHAI_IDS.some((id) => byId[id] && byId[id].available === false) ||
      AVISHAI_DEPS.some((id) => byId[id] && byId[id].available === false);
    if (avishaiOff) {
      list.push({
        id: "avishai",
        title: "יש במלאי שחוט לי פרה?",
        subtitle: "אישור ידליק גם רצועות רוסטביף וגם ביצת עין",
        enableIds: [...AVISHAI_IDS, ...AVISHAI_DEPS],
      });
    }

    // שלב 3: קציצת סמאש – אם כבויה, נשאל אם חזרה (אישור מדליק גם את מנות הסמאש)
    const SMASH_PATTY_ID = "smash-patty";
    if (byId[SMASH_PATTY_ID] && byId[SMASH_PATTY_ID].available === false) {
      list.push({
        id: SMASH_PATTY_ID,
        title: "קציצת סמאש חזרה למלאי?",
        subtitle: "אישור ידליק גם את מנות הסמאש התלויות בה",
        enableIds: [SMASH_PATTY_ID],
      });
    }

    // שלב 4: תוספות חשובות שכבויות
    IMPORTANT_TOPPING_IDS.filter((id) => byId[id] && byId[id].available === false).forEach((id) => {
      list.push({
        id,
        title: `${byId[id].item_name} חזר למלאי?`,
        subtitle: "תוספת חשובה שכרגע כבויה",
        enableIds: [id],
      });
    });

    // שלב 5: מטוגנים כבויים
    FRIED_IDS.filter((id) => byId[id] && byId[id].available === false).forEach((id) => {
      list.push({
        id,
        title: `${byId[id].item_name} זמין היום?`,
        subtitle: "מטוגנים – בדיקת פתיחת יום",
        enableIds: [id],
      });
    });

    return list;
  }, [byId]);

  useEffect(() => {
    if (index >= steps.length) {
      markDayOpenChecklistDone();
      onClose();
    }
  }, [index, steps.length, onClose]);

  const step = steps[index];
  if (!step) return null;

  const finish = () => {
    markDayOpenChecklistDone();
    onClose();
  };

  const answerYes = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (step.enableIds.length) await onEnable(step.enableIds);
    } finally {
      setBusy(false);
      setIndex((i) => i + 1);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        dir="rtl"
      >
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl"
        >
          {step.id === "__inventory__" ? (
            <>
              <div className="text-4xl text-center mb-3">📦</div>
              <h2 className="text-2xl font-black text-center text-foreground">פתיחת יום – עדכון מלאי</h2>
              <p className="text-center text-muted-foreground mt-2">
                לפני שמתחילים, כדאי לעדכן את המלאי ואת מילוי המקרר במסך המלאי.
              </p>
              <button
                onClick={() => setIndex((i) => i + 1)}
                className="w-full mt-5 py-3 rounded-xl bg-primary text-primary-foreground font-bold"
              >
                המשך לבדיקת זמינות
              </button>

            </>
          ) : (
            <>
              <div className="text-center text-sm font-bold text-muted-foreground mb-1">
                שאלה {index} מתוך {steps.length - 1}
              </div>
              <h2 className="text-2xl font-black text-center text-foreground">{step.title}</h2>
              {step.subtitle && (
                <p className="text-center text-muted-foreground text-sm mt-2">{step.subtitle}</p>
              )}
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  disabled={busy}
                  onClick={answerYes}
                  className="py-4 rounded-xl bg-green-600 text-white font-black text-lg disabled:opacity-50"
                >
                  כן, יש
                </button>
                <button
                  disabled={busy}
                  onClick={() => setIndex((i) => i + 1)}
                  className="py-4 rounded-xl bg-muted text-foreground font-black text-lg disabled:opacity-50"
                >
                  לא, נשאר כבוי
                </button>
              </div>
            </>
          )}

          <button
            onClick={finish}
            className="w-full mt-4 py-2 text-sm font-bold text-muted-foreground underline"
          >
            דלג על השאלות
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DayOpenChecklist;
