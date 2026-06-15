import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Package, RefreshCw, ChevronDown, ChevronUp, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { menuItems, type MenuItem } from "@/data/menu";
import type { CartItem } from "@/components/CartDrawer";
import { toast } from "@/hooks/use-toast";
import IosInstallModal from "@/components/IosInstallModal";
import { isStandalonePwa } from "@/lib/push";

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
  status: string;
  total: number;
  created_at: string;
  payment_method: string | null;
  notes: string | null;
  items: HistoryItem[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onReorder: (items: CartItem[]) => void;
}

const STATUS_LABEL: Record<string, string> = {
  new: "התקבלה",
  preparing: "בהכנה",
  ready: "מוכנה",
  completed: "הושלמה",
  pending_payment: "ממתינה לתשלום",
  cancelled: "בוטלה",
};

const STATUS_COLOR: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-500",
  preparing: "bg-amber-500/15 text-amber-600",
  ready: "bg-green-500/15 text-green-600",
  completed: "bg-muted text-muted-foreground",
  pending_payment: "bg-orange-500/15 text-orange-600",
  cancelled: "bg-destructive/15 text-destructive",
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " " + d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
};

const OrderHistoryModal = ({ open, onClose, onReorder }: Props) => {
  useBodyScrollLock(open);
  const [orders, setOrders] = useState<HistoryOrder[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    if (!open) return;
    const deviceToken = localStorage.getItem("habakta_device_token");
    if (!deviceToken) {
      setOrders([]);
      return;
    }
    setLoading(true);
    supabase.functions
      .invoke("get-customer-orders", { body: { deviceToken } })
      .then(({ data, error }) => {
        if (error) {
          toast({ title: "שגיאה", description: "לא ניתן לטעון היסטוריה" });
          setOrders([]);
        } else {
          setOrders(data?.orders ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, [open]);

  const handleReorder = (order: HistoryOrder) => {
    const cartItems: CartItem[] = [];
    for (const it of order.items) {
      if (!it.item_id) continue; // legacy orders without item_id can't be re-ordered
      if (it.item_name === "רטבים") continue;
      const menuItem: MenuItem | undefined = menuItems.find((m) => m.id === it.item_id);
      if (!menuItem) continue;
      cartItems.push({
        id: `${it.item_id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        menuItemId: it.item_id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: it.quantity,
        toppings: [],
        removals: [],
        withMeal: false,
      });
    }
    if (cartItems.length === 0) {
      toast({ title: "לא ניתן להזמין שוב", description: "הזמנה ישנה — חלק מהפריטים אינם זמינים" });
      return;
    }
    onReorder(cartItems);
    onClose();
    toast({ title: "נוספו לעגלה ✅", description: `${cartItems.length} פריטים נוספו` });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[60]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: "spring", damping: 25, stiffness: 280 }}
            dir="rtl"
            className="fixed inset-x-2 top-4 bottom-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-10 sm:bottom-10 sm:w-full sm:max-w-lg bg-card border border-border rounded-2xl shadow-2xl z-[70] flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card sticky top-0">
              <div className="flex items-center gap-2">
                <Package size={20} className="text-primary" />
                <h2 className="text-lg font-bold text-foreground">ההזמנות שלי</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground"
                aria-label="סגור"
              >
                <X size={18} />
              </button>
            </div>

            {!isStandalonePwa() && (
              <div className="px-4 py-3 border-b border-border bg-primary/5">
                <button
                  onClick={() => setShowInstall(true)}
                  className="w-full flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold py-2.5 rounded-xl text-sm transition-colors"
                >
                  <Smartphone size={16} />
                  הוסף את הבקתה למסך הבית
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading && (
                <div className="text-center text-muted-foreground py-10">טוען היסטוריה…</div>
              )}
              {!loading && orders && orders.length === 0 && (
                <div className="text-center text-muted-foreground py-10">
                  <Package className="mx-auto mb-3 opacity-50" size={40} />
                  <p>עדיין אין הזמנות בהיסטוריה</p>
                </div>
              )}
              {!loading && orders && orders.map((order) => {
                const isOpen = expandedId === order.id;
                return (
                  <div key={order.id} className="border border-border rounded-xl overflow-hidden bg-background/50">
                    <button
                      onClick={() => setExpandedId(isOpen ? null : order.id)}
                      className="w-full px-4 py-3 flex items-center justify-between gap-2 hover:bg-muted/40 transition-colors text-right"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-bold text-foreground">#{order.order_number}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLOR[order.status] || "bg-muted text-muted-foreground"}`}>
                            {STATUS_LABEL[order.status] || order.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="font-bold text-primary">₪{Number(order.total).toFixed(2)}</span>
                        {isOpen ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden border-t border-border bg-card"
                        >
                          <div className="px-4 py-3 space-y-2">
                            {order.items.map((it, idx) => (
                              <div key={idx} className="text-sm">
                                <div className="flex justify-between gap-2">
                                  <span className="font-semibold text-foreground">
                                    {it.quantity > 1 && `${it.quantity}× `}{it.item_name}
                                  </span>
                                  <span className="text-muted-foreground shrink-0">₪{(Number(it.price) * it.quantity).toFixed(2)}</span>
                                </div>
                                {(it.toppings && it.toppings.length > 0) && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    תוספות: {it.toppings.join(", ")}
                                  </p>
                                )}
                                {(it.removals && it.removals.filter(r => !r.startsWith("__OWNER__")).length > 0) && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    שינויים: {it.removals.filter(r => !r.startsWith("__OWNER__")).join(", ")}
                                  </p>
                                )}
                                {it.meal_side && (
                                  <p className="text-xs text-muted-foreground mt-0.5">תוספת: {it.meal_side}</p>
                                )}
                                {it.meal_drink && (
                                  <p className="text-xs text-muted-foreground mt-0.5">שתייה: {it.meal_drink}</p>
                                )}
                                {it.deal_burgers && Array.isArray(it.deal_burgers) && it.deal_burgers.length > 0 && (
                                  <ul className="text-xs text-muted-foreground mt-1 mr-3 list-disc">
                                    {it.deal_burgers.map((b: any, i: number) => (
                                      <li key={i}>
                                        {b.name || "המבורגר"}
                                        {b.removals?.length ? ` — ${b.removals.join(", ")}` : ""}
                                        {Array.isArray(b.toppings) && b.toppings.length > 0 ? ` · + ${b.toppings.join(", ")}` : ""}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {it.deal_drinks && Array.isArray(it.deal_drinks) && it.deal_drinks.length > 0 && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    שתייה דיל: {it.deal_drinks.map((d: any) => d.name).join(", ")}
                                  </p>
                                )}
                              </div>
                            ))}
                            {order.notes && (
                              <p className="text-xs text-muted-foreground italic border-t border-border pt-2 mt-2">
                                הערות: {order.notes}
                              </p>
                            )}
                            <button
                              onClick={() => handleReorder(order)}
                              className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
                            >
                              <RefreshCw size={15} />
                              הזמן שוב
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
          <IosInstallModal open={showInstall} onClose={() => setShowInstall(false)} />
        </>
      )}
    </AnimatePresence>
  );
};

export default OrderHistoryModal;
