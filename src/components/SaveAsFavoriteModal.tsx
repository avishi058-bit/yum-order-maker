import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Check, X } from "lucide-react";
import type { CartItem } from "@/components/CartDrawer";
import {
  donenessOptions,
  removalDisplayNames,
  mealSideOptions,
  mealDrinkOptions,
} from "@/data/menu";
import { findTopping } from "@/lib/toppingsLookup";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  items: CartItem[];
  onClose: () => void;
  /** Called after the user makes a decision (saved or "no thanks"). */
  onDone?: () => void;
}

/** Render the specific selections for a single cart item, in plain Hebrew. */
const ItemDetails = ({ item }: { item: CartItem }) => {
  const lines: string[] = [];

  // Doneness (lives inside removals as `doneness-*`)
  const donenessId = item.removals.find((r) => r.startsWith("doneness-"));
  if (donenessId) {
    const d = donenessOptions.find((o) => o.id === donenessId);
    if (d) lines.push(`עשייה: ${d.label}`);
  }

  // Removals (without doneness/owner/favorite meta)
  const removals = item.removals
    .filter((r) => !r.startsWith("doneness-") && !r.startsWith("__"))
    .map((r) => removalDisplayNames[r] || r)
    .filter(Boolean);
  if (removals.length > 0) lines.push(`בלי: ${removals.join(", ")}`);

  // Toppings (group dupes)
  if (item.toppings.length > 0) {
    const counts = new Map<string, number>();
    item.toppings.forEach((tId) => counts.set(tId, (counts.get(tId) || 0) + 1));
    const names = Array.from(counts.entries())
      .map(([tId, count]) => {
        const name = findTopping(tId)?.name;
        if (!name) return null;
        return count > 1 ? `${name} ×${count}` : name;
      })
      .filter(Boolean) as string[];
    if (names.length > 0) lines.push(`תוספות: ${names.join(", ")}`);
  }

  // Meal upgrade + side + drink
  if (item.withMeal) {
    const parts: string[] = ["ארוחה עסקית"];
    if (item.mealSideId) {
      const s = mealSideOptions.find((o) => o.id === item.mealSideId);
      if (s) parts.push(s.name);
    }
    if (item.mealDrinkId) {
      const d = mealDrinkOptions.find((o) => o.id === item.mealDrinkId);
      if (d) parts.push(d.name);
    }
    lines.push(parts.join(" · "));
  }

  // Deal: burgers + drinks
  if (item.dealBurgers && item.dealBurgers.length > 0) {
    item.dealBurgers.forEach((b, i) => {
      const removalNames = (b.removals ?? [])
        .filter((r) => !r.startsWith("doneness-"))
        .map((r) => removalDisplayNames[r] || r);
      const label = `המבורגר ${i + 1}${b.name ? ` (${b.name})` : ""}${
        removalNames.length ? ` — בלי ${removalNames.join(", ")}` : ""
      }`;
      lines.push(label);
    });
    if (item.dealDrinks && item.dealDrinks.length > 0) {
      lines.push(`שתייה: ${item.dealDrinks.map((d) => d.name).join(", ")}`);
    }
  }

  if (lines.length === 0) return null;

  return (
    <ul className="mt-1.5 space-y-0.5">
      {lines.map((line, i) => (
        <li key={i} className="text-xs text-muted-foreground leading-snug">
          {line}
        </li>
      ))}
    </ul>
  );
};

/**
 * Pre-payment prompt: offers to save the order's dish(es) as the customer's
 * "regular". Shown only when the customer is logged in AND has no favorite yet.
 *
 * For multi-item orders the customer can pick which specific dishes to save.
 */
const SaveAsFavoriteModal = ({ open, items, onClose, onDone }: Props) => {
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

  const finish = () => {
    onClose();
    onDone?.();
  };

  const handleSave = async () => {
    const chosen = eligible.filter((it) => selectedIds.has(it.id));
    if (chosen.length === 0) {
      toast({ title: "בחר לפחות מנה אחת", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
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
      finish();
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
        <div className="absolute inset-0 bg-black/60" onClick={finish} />
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 10 }}
          className="relative bg-card rounded-2xl p-6 w-full max-w-md border border-border max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={finish}
            className="absolute left-4 top-4 p-1.5 rounded-full hover:bg-muted text-muted-foreground"
            aria-label="סגור"
          >
            <X size={18} />
          </button>

          <div className="flex flex-col items-center text-center mb-4">
            <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mb-3">
              <Star className="text-green-500 fill-green-500" size={28} />
            </div>
            <h2 className="text-xl font-black text-green-500 leading-tight">
              לשמור {multi ? "מנות אלו" : "את המנה הזאת"} כקבוע שלך?
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              בהזמנה הבאה תוכל להזמין את הקבוע שלך בלחיצה אחת — בלי להתעסק שוב בכל הבחירות.
            </p>
            <p className="text-[11px] text-muted-foreground/80 mt-1.5 italic">
              (אל דאגה! תוכל לבצע עריכה גם לקבוע שלך אם תרצה לשנות משהו ;)
            </p>
          </div>

          {multi && (
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs text-muted-foreground">
                סמן אילו מנות לשמור
              </p>
              {!allSelected && (
                <button
                  onClick={selectAll}
                  className="text-xs text-green-500 font-semibold hover:underline"
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
                      ? "bg-green-500/10 border-2 border-green-500"
                      : "bg-muted/40 border-2 border-transparent opacity-70"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {multi && (
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? "bg-green-500 text-white"
                            : "bg-background border border-border"
                        }`}
                      >
                        {isSelected && <Check size={14} strokeWidth={3} />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 text-right">
                      <p className="font-bold text-foreground text-sm">
                        {it.quantity > 1 ? `${it.quantity}× ` : ""}
                        {it.name}
                      </p>
                      <ItemDetails item={it} />
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
              className="w-full bg-green-500 text-white font-bold py-3 rounded-full disabled:opacity-50 hover:bg-green-600 transition-colors"
            >
              {saving
                ? "שומר..."
                : multi
                ? "שמור כקבוע שלי ⭐"
                : "כן, שמור כקבוע שלי ⭐"}
            </motion.button>
            <button
              onClick={finish}
              disabled={saving}
              className="w-full py-2.5 rounded-full text-muted-foreground hover:text-foreground text-sm"
            >
              לא תודה, המשך לתשלום
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SaveAsFavoriteModal;
