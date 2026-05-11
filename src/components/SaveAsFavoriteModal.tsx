import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Check, X } from "lucide-react";
import type { CartItem } from "@/components/CartDrawer";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  items: CartItem[];
  onClose: () => void;
}

/**
 * Post-order prompt: offers to save the just-ordered dish(es) as the customer's
 * "regular" so next time they can re-order it in one tap. Shown only when the
 * customer is logged in AND has no favorite saved yet.
 *
 * For multi-item orders the customer can pick which specific dishes to mark
 * as "the regular" — by default everything is selected.
 */
const SaveAsFavoriteModal = ({ open, items, onClose }: Props) => {
  useBodyScrollLock(open);
  const { setFavoriteItems, isLoggedIn } = useCustomerAuth();

  // Filter out synthetic/system lines (e.g. "רטבים")
  const eligible = useMemo(
    () => items.filter((it) => it.menuItemId && it.name !== "רטבים"),
    [items],
  );

  // Default: everything selected
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(eligible.map((it) => it.id)),
  );
  const [saving, setSaving] = useState(false);

  if (!open || !isLoggedIn || eligible.length === 0) return null;

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectAll = () =>
    setSelectedIds(new Set(eligible.map((it) => it.id)));

  const handleSave = async () => {
    const chosen = eligible.filter((it) => selectedIds.has(it.id));
    if (chosen.length === 0) {
      toast({ title: "בחר לפחות מנה אחת", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Strip the post-order id suffix so the favorite is clean.
      const clean: CartItem[] = chosen.map((it) => ({
        ...it,
        id: `${it.menuItemId}-fav-${Math.random().toString(36).slice(2, 8)}`,
        isFavorite: true,
      }));
      await setFavoriteItems(clean);
      toast({
        title: "נשמר כקבוע שלך ⭐",
        description: "בהזמנה הבאה תוכל להזמין את הקבוע שלך בלחיצה אחת",
      });
      onClose();
    } catch (e: any) {
      toast({
        title: "שמירת הקבוע נכשלה",
        description: e?.message ?? "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const multi = eligible.length > 1;
  const allSelected = selectedIds.size === eligible.length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
        dir="rtl"
      >
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 10 }}
          className="relative bg-card rounded-2xl p-6 w-full max-w-md border border-border max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute left-4 top-4 p-1.5 rounded-full hover:bg-muted text-muted-foreground"
            aria-label="סגור"
          >
            <X size={18} />
          </button>

          <div className="flex flex-col items-center text-center mb-4">
            <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mb-3">
              <Star className="text-primary fill-primary" size={28} />
            </div>
            <h2 className="text-xl font-black text-foreground">
              לשמור {multi ? "מנות" : "את המנה הזאת"} כקבוע שלך?
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              בהזמנה הבאה תוכל להזמין את הקבוע שלך בלחיצה אחת — בלי להתעסק שוב בכל הבחירות.
            </p>
          </div>

          {multi && (
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs text-muted-foreground">
                סמן אילו מנות לשמור (אפשר את כולן)
              </p>
              {!allSelected && (
                <button
                  onClick={selectAll}
                  className="text-xs text-primary font-semibold hover:underline"
                >
                  בחר הכל
                </button>
              )}
            </div>
          )}

          <ul className="space-y-2 mb-5">
            {eligible.map((it) => {
              const isSelected = selectedIds.has(it.id);
              const clickable = multi;
              return (
                <li
                  key={it.id}
                  onClick={clickable ? () => toggle(it.id) : undefined}
                  className={`relative rounded-xl p-3 transition-all ${
                    clickable ? "cursor-pointer" : ""
                  } ${
                    isSelected
                      ? "bg-primary/10 border-2 border-primary"
                      : "bg-muted/40 border-2 border-transparent opacity-70"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {multi && (
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-background border border-border"
                        }`}
                      >
                        {isSelected && <Check size={14} strokeWidth={3} />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 text-right">
                      <p className="font-bold text-foreground text-sm truncate">
                        {it.quantity > 1 ? `${it.quantity}× ` : ""}
                        {it.name}
                      </p>
                      {it.withMeal && (
                        <p className="text-xs text-primary/80">כולל שדרוג עסקית</p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={saving}
              onClick={handleSave}
              className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-full disabled:opacity-50"
            >
              {saving
                ? "שומר..."
                : multi
                ? "שמור כקבוע שלי ⭐"
                : "כן, שמור כקבוע שלי ⭐"}
            </motion.button>
            <button
              onClick={onClose}
              disabled={saving}
              className="w-full py-2.5 rounded-full text-muted-foreground hover:text-foreground text-sm"
            >
              לא תודה
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SaveAsFavoriteModal;
