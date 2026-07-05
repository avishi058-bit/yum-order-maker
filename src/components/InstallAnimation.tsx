import { motion } from "framer-motion";
import { Share, Plus, MoreVertical, Download } from "lucide-react";

type Mode = "ios" | "android";

interface Props {
  mode: Mode;
}

/**
 * Looping mini-phone animation that visually demonstrates the install flow.
 * Much easier for non-technical users to grasp than reading steps.
 */
const InstallAnimation = ({ mode }: Props) => {
  // Total loop = 6s. Same timeline for both, different visuals.
  const LOOP = 6;

  return (
    <div className="mx-auto w-full max-w-[240px] select-none">
      {/* Phone frame */}
      <div className="relative mx-auto w-[220px] h-[380px] rounded-[36px] bg-neutral-900 border-[6px] border-neutral-800 shadow-2xl overflow-hidden">
        {/* Notch */}
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-16 h-4 bg-black rounded-full z-30" />

        {/* Screen */}
        <div className="absolute inset-1 rounded-[28px] bg-gradient-to-b from-amber-50 to-white overflow-hidden">
          {/* Fake browser top bar */}
          <div className="h-8 bg-neutral-100 border-b border-neutral-200 flex items-center justify-between px-2">
            {mode === "ios" ? (
              <>
                <div className="w-8" />
                <div className="text-[9px] font-bold text-neutral-700">habakta.co.il</div>
                <div className="w-8 flex justify-end">
                  <div className="w-2 h-2 rounded-full bg-neutral-300" />
                </div>
              </>
            ) : (
              <>
                <div className="text-[9px] font-bold text-neutral-700">habakta.co.il</div>
                <motion.div
                  animate={{ scale: [1, 1, 1.35, 1.35, 1, 1] }}
                  transition={{ duration: LOOP, times: [0, 0.15, 0.2, 0.35, 0.4, 1], repeat: Infinity }}
                  className="relative"
                >
                  <MoreVertical size={14} className="text-neutral-700" />
                </motion.div>
              </>
            )}
          </div>

          {/* Fake site content */}
          <div className="p-2 space-y-1.5">
            <div className="h-3 w-2/3 rounded bg-orange-200" />
            <div className="h-2 w-full rounded bg-neutral-200" />
            <div className="h-2 w-5/6 rounded bg-neutral-200" />
            <div className="h-12 rounded bg-gradient-to-br from-orange-300 to-amber-400 flex items-center justify-center text-white text-[10px] font-black">
              🍔 הבקתה
            </div>
            <div className="h-2 w-full rounded bg-neutral-200" />
            <div className="h-2 w-4/5 rounded bg-neutral-200" />
          </div>

          {/* iOS: Safari bottom bar with share button */}
          {mode === "ios" && (
            <div className="absolute bottom-0 left-0 right-0 h-9 bg-neutral-100 border-t border-neutral-200 flex items-center justify-around">
              <div className="w-4 h-4 rounded bg-neutral-300" />
              <div className="w-4 h-4 rounded bg-neutral-300" />
              <motion.div
                animate={{ scale: [1, 1, 1.4, 1.4, 1, 1] }}
                transition={{ duration: LOOP, times: [0, 0.15, 0.2, 0.35, 0.4, 1], repeat: Infinity }}
                className="relative"
              >
                <Share size={16} className="text-blue-600" strokeWidth={2.5} />
              </motion.div>
              <div className="w-4 h-4 rounded bg-neutral-300" />
              <div className="w-4 h-4 rounded bg-neutral-300" />
            </div>
          )}

          {/* Share/Menu sheet sliding up */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: ["100%", "100%", "0%", "0%", "100%", "100%"] }}
            transition={{ duration: LOOP, times: [0, 0.2, 0.25, 0.55, 0.6, 1], repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-0 left-0 right-0 h-[70%] bg-white rounded-t-2xl shadow-2xl border-t border-neutral-200 p-2.5"
          >
            <div className="w-8 h-1 rounded-full bg-neutral-300 mx-auto mb-2" />
            <div className="text-[10px] font-bold text-neutral-800 text-center mb-2">
              {mode === "ios" ? "שיתוף" : "תפריט"}
            </div>
            {/* Sheet items */}
            <div className="space-y-1.5">
              <div className="h-6 rounded-lg bg-neutral-100" />
              <div className="h-6 rounded-lg bg-neutral-100" />
              {/* Highlighted "Add to Home Screen" row */}
              <motion.div
                animate={{
                  backgroundColor: [
                    "rgb(245, 245, 245)",
                    "rgb(245, 245, 245)",
                    "rgb(245, 245, 245)",
                    "rgb(254, 215, 170)",
                    "rgb(254, 215, 170)",
                    "rgb(245, 245, 245)",
                  ],
                  scale: [1, 1, 1, 1.05, 1.05, 1],
                }}
                transition={{ duration: LOOP, times: [0, 0.25, 0.35, 0.4, 0.5, 0.55], repeat: Infinity }}
                className="h-7 rounded-lg flex items-center gap-2 px-2 border border-transparent"
              >
                {mode === "ios" ? (
                  <Plus size={12} className="text-neutral-700" />
                ) : (
                  <Download size={12} className="text-neutral-700" />
                )}
                <div className="text-[9px] font-bold text-neutral-800">
                  {mode === "ios" ? "הוספה למסך הבית" : "התקן אפליקציה"}
                </div>
              </motion.div>
              <div className="h-6 rounded-lg bg-neutral-100" />
            </div>
          </motion.div>

          {/* Finger cursor */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 1, 1, 1, 1, 1, 0, 0],
              // Positions: share/menu button → highlighted row → offscreen
              x: mode === "ios"
                ? [60, 60, 60, 60, -20, -20, -20, -20]
                : [80, 80, 80, 80, -20, -20, -20, -20],
              y: mode === "ios"
                ? [180, 180, 260, 260, 130, 130, 130, 130]
                : [-160, -160, -160, -160, 130, 130, 130, 130],
              scale: [1, 1, 0.75, 1, 0.75, 1, 1, 1],
            }}
            transition={{ duration: LOOP, times: [0, 0.1, 0.18, 0.22, 0.42, 0.48, 0.6, 1], repeat: Infinity }}
            className="absolute top-1/2 left-1/2 z-20 pointer-events-none"
            style={{ transform: "translate(-50%, -50%)" }}
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-white/40 backdrop-blur-sm border-2 border-white shadow-lg" />
              <div className="absolute inset-0 w-8 h-8 rounded-full bg-primary/30 animate-ping" />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Caption under phone */}
      <motion.div
        animate={{ opacity: [1, 1, 0, 1, 1, 0, 1, 1] }}
        transition={{ duration: LOOP, times: [0, 0.18, 0.2, 0.22, 0.4, 0.42, 0.44, 1], repeat: Infinity }}
        className="text-center mt-3 min-h-[40px]"
      >
        <StepCaption mode={mode} />
      </motion.div>
    </div>
  );
};

const StepCaption = ({ mode }: { mode: Mode }) => {
  const LOOP = 6;
  return (
    <div className="relative h-10">
      <motion.p
        animate={{ opacity: [1, 1, 0, 0, 0, 0, 1, 1] }}
        transition={{ duration: LOOP, times: [0, 0.18, 0.22, 0.4, 0.6, 0.95, 1, 1], repeat: Infinity }}
        className="absolute inset-0 text-sm font-black text-foreground"
      >
        {mode === "ios" ? "1️⃣ לחצו על כפתור השיתוף" : "1️⃣ לחצו על שלוש הנקודות"}
      </motion.p>
      <motion.p
        animate={{ opacity: [0, 0, 1, 1, 0, 0, 0, 0] }}
        transition={{ duration: LOOP, times: [0, 0.22, 0.26, 0.4, 0.42, 0.6, 0.95, 1], repeat: Infinity }}
        className="absolute inset-0 text-sm font-black text-primary"
      >
        {mode === "ios" ? '2️⃣ בחרו "הוספה למסך הבית"' : '2️⃣ בחרו "התקן אפליקציה"'}
      </motion.p>
      <motion.p
        animate={{ opacity: [0, 0, 0, 0, 1, 1, 0, 0] }}
        transition={{ duration: LOOP, times: [0, 0.4, 0.42, 0.6, 0.62, 0.95, 0.97, 1], repeat: Infinity }}
        className="absolute inset-0 text-sm font-black text-green-600"
      >
        3️⃣ מוכן! האייקון במסך הבית 🎉
      </motion.p>
    </div>
  );
};

export default InstallAnimation;
