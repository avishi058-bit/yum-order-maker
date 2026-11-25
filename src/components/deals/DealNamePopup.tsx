// The "של מי המנה?" popup for deal burgers - same look as the single burger's
// name popup (ItemCustomizer). Optional: "דלג" moves on without a name.
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  open: boolean;
  isKiosk: boolean;
  value: string;
  onChange: (v: string) => void;
  onDone: () => void;
  onSkip: () => void;
};

const DealNamePopup = ({ open, isKiosk, value, onChange, onDone, onSkip }: Props) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
        dir="rtl"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          transition={{ duration: 0.18 }}
          className={`bg-white text-black w-full rounded-3xl shadow-2xl ${isKiosk ? "max-w-2xl p-10" : "max-w-md p-6"}`}
        >
          <h3 className={`font-black text-center ${isKiosk ? "text-[36px] mb-2" : "text-xl mb-1"}`}>של מי המנה? :)</h3>
          <p className={`text-gray-500 text-center ${isKiosk ? "text-[22px] mb-6" : "text-sm mb-4"}`}>
            נכתוב את השם על המנה כדי למנוע בלבולים (אפשר לדלג)
          </p>
          <input
            autoFocus
            type="text"
            value={value}
            maxLength={30}
            onChange={(e) => onChange(e.target.value.slice(0, 30))}
            onKeyDown={(e) => { if (e.key === "Enter") onDone(); }}
            placeholder="שם (למשל: יוסי)"
            inputMode="text"
            enterKeyHint="done"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            dir="rtl"
            style={{ fontSize: isKiosk ? "26px" : "16px" }}
            className={`w-full bg-white border-2 border-gray-200 rounded-xl text-right focus:outline-none focus:border-primary transition-colors ${isKiosk ? "px-5 py-5" : "px-4 py-3"}`}
          />
          <div className={isKiosk ? "space-y-4 mt-8" : "space-y-3 mt-5"}>
            <button
              onClick={onDone}
              className={`w-full bg-primary text-primary-foreground font-black rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform ${isKiosk ? "py-6 text-[30px]" : "py-4 text-lg"}`}
            >
              המשך
            </button>
            <button
              onClick={onSkip}
              className={`w-full bg-gray-100 text-gray-500 font-bold rounded-xl active:scale-[0.98] transition-transform ${isKiosk ? "py-5 text-[24px]" : "py-3 text-base"}`}
            >
              דלג
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default DealNamePopup;
