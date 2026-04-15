import { motion, AnimatePresence } from "framer-motion";

interface DineInSelectorProps {
  open: boolean;
  onSelect: (dineIn: boolean) => void;
}

const DineInSelector = ({ open, onSelect }: DineInSelectorProps) => {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        dir="rtl"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 200 }}
          className="bg-card rounded-3xl p-10 text-center shadow-2xl max-w-lg mx-4 border border-border"
        >
          <p className="text-5xl mb-6">🍔</p>
          <h2 className="text-3xl font-black text-foreground mb-2">איך תרצה את ההזמנה?</h2>
          <p className="text-lg text-muted-foreground mb-8">בחר אופציה כדי להמשיך</p>

          <div className="flex gap-4">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(true)}
              className="flex-1 bg-primary text-primary-foreground rounded-2xl py-6 px-6 text-2xl font-black shadow-lg hover:opacity-90 transition-opacity"
            >
              🪑 לשבת
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(false)}
              className="flex-1 bg-orange-500 text-white rounded-2xl py-6 px-6 text-2xl font-black shadow-lg hover:opacity-90 transition-opacity"
            >
              🥡 לקחת
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DineInSelector;
