import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, Star, Trash2, RefreshCw, Pencil, Check, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { menuItems, type MenuItem } from "@/data/menu";
import { findTopping } from "@/lib/toppingsLookup";
import type { CartItem } from "@/components/CartDrawer";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Adds items into the live cart (replacing or appending). Caller decides. */
  onUseFavorite: (items: CartItem[]) => void;
  /** Snapshot of the current cart, so user can save it as their favorite. */
  currentCart: CartItem[];
  /** Force the modal to open directly in the setup view (used by side-menu "update favorite"). */
  startInSetup?: boolean;
}

interface HistoryItem {
  item_id: string | null;
  item_name: string;
  price: number;
  quantity: number;
  toppings: string[] | null;
  removals: string[] | null;
  with_meal: boolean | null;
  meal_side: string | null;
  meal_drink: string | null;
  deal_burgers: any;
  deal_drinks: any;
}
interface HistoryOrder {
  id: string;
  order_number: number;
  created_at: string;
  total: number;
  items: HistoryItem[];
}

/** Convert a saved order's items into fresh CartItems (new ids, ready to add). */
const orderItemsToCart = (items: HistoryItem[]): CartItem[] => {
  const out: CartItem[] = [];
  for (const it of items) {
    if (!it.item_id) continue;
    if (it.item_name === "רטבים") continue;
    const menuItem: MenuItem | undefined = menuItems.find((m) => m.id === it.item_id);
    if (!menuItem) continue;
    out.push({
      id: `${it.item_id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      menuItemId: it.item_id,
      name: menuItem.name,
      price: menuItem.price,
      quantity: it.quantity || 1,
      toppings: Array.isArray(it.toppings) ? it.toppings : [],
      removals: Array.isArray(it.removals) ? it.removals.filter((r) => !r.startsWith("__OWNER__")) : [],
      withMeal: !!it.with_meal,
      mealSideId: it.meal_side ?? undefined,
      mealDrinkId: it.meal_drink ?? undefined,
      dealBurgers: it.deal_burgers ?? undefined,
      dealDrinks: it.deal_drinks ?? undefined,
    });
  }
  return out;
};

/** Re-issue fresh ids on a stored favorite before pushing into the live cart. */
const refreshIds = (items: CartItem[]): CartItem[] =>
  items.map((it) => ({
    ...it,
    id: `${it.menuItemId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  }));

const FavoriteSummary = ({ items }: { items: CartItem[] }) => (
  <ul className="space-y-1.5 text-sm">
    {items.map((it) => {
      const tNames = it.toppings
        .map((tId) => findTopping(tId)?.name)
        .filter(Boolean) as string[];
      return (
        <li key={it.id} className="flex justify-between gap-2 border-b border-border/50 pb-1.5">
          <div className="text-right">
            <span className="font-semibold text-foreground">
              {it.quantity > 1 ? `${it.quantity}× ` : ""}{it.name}
            </span>
            {it.withMeal && <span className="text-xs text-muted-foreground"> (ארוחה)</span>}
            {tNames.length > 0 && (
              <p className="text-xs text-muted-foreground">תוספות: {tNames.join(", ")}</p>
            )}
          </div>
          <span className="text-muted-foreground shrink-0">₪{(it.price * it.quantity).toFixed(0)}</span>
        </li>
      );
    })}
  </ul>
);

const FavoriteOrderModal = ({ open, onClose, onUseFavorite, currentCart, startInSetup }: Props) => {
  useBodyScrollLock(open);
  const { favoriteItems, setFavoriteItems, isLoggedIn } = useCustomerAuth();
  const [view, setView] = useState<"confirm" | "setup">("confirm");
  const [orders, setOrders] = useState<HistoryOrder[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasFavorite = !!(favoriteItems && favoriteItems.length > 0);

  useEffect(() => {
    if (!open) return;
    setView(startInSetup || !hasFavorite ? "setup" : "confirm");
  }, [open, startInSetup, hasFavorite]);

  // Fetch past orders only when entering the setup view
  useEffect(() => {
    if (!open || view !== "setup") return;
    const deviceToken = localStorage.getItem("habakta_device_token");
    if (!deviceToken) {
      setOrders([]);
      return;
    }
    setLoading(true);
    supabase.functions
      .invoke("get-customer-orders", { body: { deviceToken } })
      .then(({ data, error }) => {
        if (error) setOrders([]);
        else setOrders((data?.orders as HistoryOrder[]) ?? []);
      })
      .finally(() => setLoading(false));
  }, [open, view]);

  const usableOrders = useMemo(
    () => (orders ?? []).filter((o) => orderItemsToCart(o.items).length > 0).slice(0, 10),
    [orders],
  );

  const handleUseExisting = () => {
    if (!favoriteItems) return;
    onUseFavorite(refreshIds(favoriteItems));
    onClose();
    toast({ title: "ההזמנה הקבועה שלך נוספה לעגלה ❤️" });
  };

  const handleSaveFromOrder = async (order: HistoryOrder) => {
    const items = orderItemsToCart(order.items);
    if (items.length === 0) {
      toast({ title: "לא ניתן לשמור הזמנה זו", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await setFavoriteItems(items);
      toast({ title: "ההזמנה הקבועה נשמרה ⭐" });
      setView("confirm");
    } catch {
      toast({ title: "שגיאה בשמירה", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFromCart = async () => {
    if (currentCart.length === 0) return;
    setSaving(true);
    try {
      await setFavoriteItems(currentCart);
      toast({ title: "העגלה הנוכחית נשמרה כקבוע ⭐" });
      setView("confirm");
    } catch {
      toast({ title: "שגיאה בשמירה", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await setFavoriteItems(null);
      toast({ title: "ההזמנה הקבועה נמחקה" });
      setView("setup");
    } finally {
      setSaving(false);
    }
  };

  if (!isLoggedIn) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[80]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: "spring", damping: 25, stiffness: 280 }}
            dir="rtl"
            className="fixed inset-x-2 top-4 bottom-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-10 sm:bottom-10 sm:w-full sm:max-w-lg bg-card border border-border rounded-2xl shadow-2xl z-[90] flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card">
              <div className="flex items-center gap-2">
                <Heart size={20} className="text-green-500 fill-green-500" />
                <h2 className="text-lg font-bold text-foreground">
                  {view === "confirm" ? "ההזמנה הקבועה שלך" : hasFavorite ? "עדכון הקבוע" : "הגדרת הזמנה קבועה"}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-muted text-muted-foreground"
                aria-label="סגור"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {view === "confirm" && hasFavorite && favoriteItems && (
                <>
                  <p className="text-sm text-muted-foreground">
                    רוצה להמשיך עם ההזמנה הקבועה שלך, או לערוך אותה לפני שממשיכים?
                  </p>
                  <div className="bg-secondary/50 rounded-xl p-4">
                    <FavoriteSummary items={favoriteItems} />
                  </div>
                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      onClick={handleUseExisting}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-green-600 hover:bg-green-700 text-white font-bold text-base transition-colors shadow-lg shadow-green-600/30"
                    >
                      <Check size={18} />
                      המשך עם הקבוע
                    </button>
                    <button
                      onClick={() => setView("setup")}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-full border border-border text-foreground hover:bg-muted font-semibold text-sm"
                    >
                      <Pencil size={16} />
                      ערוך / החלף את הקבוע
                    </button>
                    <button
                      onClick={handleClear}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs text-destructive/80 hover:text-destructive transition-colors"
                    >
                      <Trash2 size={13} />
                      מחק את ההזמנה הקבועה
                    </button>
                  </div>
                </>
              )}

              {view === "setup" && (
                <>
                  {currentCart.length > 0 && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <ShoppingBag size={16} className="text-primary" />
                        <p className="text-sm font-bold text-foreground">העגלה הנוכחית שלך</p>
                      </div>
                      <FavoriteSummary items={currentCart} />
                      <button
                        onClick={handleSaveFromCart}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
                      >
                        <Star size={15} />
                        שמור כקבוע
                      </button>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-bold text-foreground mb-2">או בחר מתוך הזמנות קודמות</p>
                    {loading && (
                      <div className="text-center text-muted-foreground py-6 text-sm">טוען…</div>
                    )}
                    {!loading && usableOrders.length === 0 && (
                      <div className="text-center text-muted-foreground py-6 text-sm">
                        אין הזמנות קודמות שניתן לשמור. הזמן קודם או שמור את העגלה הנוכחית.
                      </div>
                    )}
                    <div className="space-y-2">
                      {usableOrders.map((order) => {
                        const items = orderItemsToCart(order.items);
                        return (
                          <button
                            key={order.id}
                            onClick={() => handleSaveFromOrder(order)}
                            disabled={saving}
                            className="w-full text-right border border-border rounded-xl p-3 hover:bg-muted/50 transition-colors disabled:opacity-60"
                          >
                            <div className="flex justify-between mb-1.5">
                              <span className="text-sm font-bold text-foreground">#{order.order_number}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(order.created_at).toLocaleDateString("he-IL")} · ₪{Number(order.total).toFixed(0)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {items.map((i) => `${i.quantity > 1 ? i.quantity + "× " : ""}${i.name}`).join(" · ")}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {hasFavorite && (
                    <button
                      onClick={() => setView("confirm")}
                      className="w-full text-sm text-muted-foreground hover:text-foreground underline pt-2"
                    >
                      חזור לקבוע הנוכחי
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FavoriteOrderModal;
