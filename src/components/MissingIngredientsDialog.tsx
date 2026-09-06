import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface IngredientOption {
  item_id: string;
  item_name: string;
}

interface Props {
  dishName: string;
  ingredients: IngredientOption[];
  onConfirm: (itemIds: string[]) => Promise<void> | void;
  onClose: () => void;
}

const MissingIngredientsDialog = ({ dishName, ingredients, onConfirm, onClose }: Props) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async (ids: string[]) => {
    if (busy) return;
    setBusy(true);
    try {
      if (ids.length) await onConfirm(ids);
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        dir="rtl"
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl"
        >
          <h2 className="text-2xl font-black text-center text-foreground">כיבית את {dishName}</h2>
          <p className="text-center text-muted-foreground text-sm mt-2">
            מה מהמרכיבים חסר במלאי? מה שתסמן יכובה גם הוא (וגם מנות אחרות שמכילות אותו).
          </p>

          <div className="mt-5 space-y-2">
            {ingredients.map((ing) => {
              const on = selected.includes(ing.item_id);
              return (
                <button
                  key={ing.item_id}
                  onClick={() => toggle(ing.item_id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                    on ? "bg-destructive/10 border-destructive" : "bg-muted/40 border-border"
                  }`}
                >
                  <span className={`text-xl ${on ? "text-destructive" : "text-muted-foreground"}`}>
                    {on ? "✕" : "○"}
                  </span>
                  <span className="font-bold text-foreground">{ing.item_name}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <button
              disabled={busy}
              onClick={() => submit(selected)}
              className="py-3 rounded-xl bg-primary text-primary-foreground font-black disabled:opacity-50"
            >
              כבה את המסומנים
            </button>
            <button
              disabled={busy}
              onClick={() => submit(ingredients.map((i) => i.item_id))}
              className="py-3 rounded-xl bg-destructive text-destructive-foreground font-black disabled:opacity-50"
            >
              כבה את כולם
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-4 py-2 text-sm font-bold text-muted-foreground underline"
          >
            לא חסר כלום – רק המנה
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MissingIngredientsDialog;
