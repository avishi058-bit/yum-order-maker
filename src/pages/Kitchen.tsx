import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, ChefHat, CheckCircle, XCircle, Printer, Bell, BellOff, History, Package, Store, Globe, Monitor, Banknote, CreditCard, BarChart3 } from "lucide-react";
import DashboardView from "@/components/DashboardView";
import { useRestaurantStatus } from "@/hooks/useRestaurantStatus";
import { motion } from "framer-motion";

interface OrderItem {
  id: string;
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

interface Order {
  id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  notes: string | null;
  status: string;
  total: number;
  created_at: string;
  updated_at: string;
  payment_method: string | null;
  order_items: OrderItem[];
}

type ViewMode = "active" | "history" | "availability" | "dashboard";

interface AvailabilityItem {
  id: string;
  item_id: string;
  item_name: string;
  category: string;
  available: boolean;
}

const availabilityCategoryLabels: Record<string, string> = {
  burger: "🍔 המבורגרים",
  meal: "🍽️ ארוחות עסקיות",
  side: "🍟 צ׳יפס ותוספות",
  drink: "🍺 שתייה",
  deal: "🤝 דילים",
  topping: "🧀 תוספות על ההמבורגר",
  sauce: "🥫 רטבים",
  ingredient: "🥬 ירקות ורטבים",
};

const availabilityCategoryOrder = ["burger", "meal", "side", "drink", "deal", "topping", "sauce", "ingredient"];

// Fixed order of items within each category to match the menu
const itemOrder: Record<string, string[]> = {
  burger: ["classic", "smash-moshavnikim", "avishai", "double", "crazy-smash", "smash-double-cheese", "special-hadegel", "haf-mifsha"],
  meal: ["meal-classic", "meal-smash-moshavnikim", "meal-avishai", "meal-double", "meal-crazy-smash", "meal-smash-double-cheese", "meal-special-hadegel", "meal-haf-mifsha"],
  side: ["fries", "waffle-fries", "onion-rings", "tempura-onion", "friends-mix"],
  drink: [
    "drink-cola", "drink-zero", "drink-fanta", "drink-fanta-grape", "drink-fanta-exotic",
    "drink-sprite", "drink-sprite-zero", "drink-blu", "drink-blu-mojito", "drink-blu-day",
    "drink-wave", "drink-watermelon",
    "drink-grapes", "drink-apples", "drink-flavored-water",
    "drink-carlsberg", "drink-goldstar", "drink-heineken", "drink-corona",
    "drink-hoegaarden", "drink-laffe", "drink-unfiltered", "drink-guinness", "drink-weiss",
  ],
  deal: ["family-deal", "friends-deal"],
  topping: ["onion-jam", "peanut-butter", "fried-onion", "garlic-confit", "egg", "vegan-cheddar", "roastbeef", "extra-patty", "hot-pepper-jam", "onion-rings-topping", "maple"],
  sauce: ["ketchup", "mayo", "chili", "plum"],
  ingredient: ["lettuce", "tomato", "pickles", "aioli", "onion"],
};

// Burger to meal mapping
const burgerToMeal: Record<string, string> = {
  classic: "meal-classic",
  "smash-moshavnikim": "meal-smash-moshavnikim",
  avishai: "meal-avishai",
  double: "meal-double",
  "crazy-smash": "meal-crazy-smash",
  "smash-double-cheese": "meal-smash-double-cheese",
  "special-hadegel": "meal-special-hadegel",
  "haf-mifsha": "meal-haf-mifsha",
};

const PREP_TIMES = [5, 10, 15, 20, 25, 30, 45, 60];

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  new: { label: "חדשה", color: "bg-red-500", icon: <Bell size={18} /> },
  preparing: { label: "בהכנה", color: "bg-yellow-500", icon: <ChefHat size={18} /> },
  ready: { label: "מוכנה", color: "bg-green-500", icon: <CheckCircle size={18} /> },
  completed: { label: "הושלמה", color: "bg-gray-500", icon: <CheckCircle size={18} /> },
  cancelled: { label: "בוטלה", color: "bg-gray-400", icon: <XCircle size={18} /> },
};

const nextStatus: Record<string, string> = {
  new: "preparing",
  preparing: "ready",
  ready: "completed",
};

const Kitchen = () => {
  const { status: restaurantStatus, toggleWebsite, toggleStation, toggleCash, toggleCredit, closeAll, openAll } = useRestaurantStatus();
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPrint, setAutoPrint] = useState(true);
  const [showTimePicker, setShowTimePicker] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const printedOrdersRef = useRef<Set<string>>(new Set());
  const prevOrderCountRef = useRef(0);
  const [availabilityItems, setAvailabilityItems] = useState<AvailabilityItem[]>([]);

  const fetchAvailability = useCallback(async () => {
    const { data } = await supabase
      .from("menu_availability")
      .select("*")
      .order("category");
    if (data) setAvailabilityItems(data as AvailabilityItem[]);
  }, []);

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setOrders(data as Order[]);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchAvailability();

    const channel = supabase
      .channel("orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrders())
      .subscribe();

    const availChannel = supabase
      .channel("availability-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "menu_availability" }, (payload) => {
        const updated = payload.new as AvailabilityItem;
        setAvailabilityItems((prev) =>
          prev.map((item) => (item.item_id === updated.item_id ? { ...item, available: updated.available } : item))
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(availChannel);
    };
  }, [fetchOrders, fetchAvailability]);

  // Play sound + auto-print on new order
  useEffect(() => {
    const newOrders = orders.filter((o) => o.status === "new");
    if (newOrders.length > prevOrderCountRef.current && soundEnabled) {
      playAlert();
    }
    // Auto-print new orders that haven't been printed yet
    if (autoPrint) {
      newOrders.forEach((order) => {
        if (!printedOrdersRef.current.has(order.id)) {
          printedOrdersRef.current.add(order.id);
          // Small delay to ensure DOM is ready
          setTimeout(() => printOrder(order), 500);
        }
      });
    }
    prevOrderCountRef.current = newOrders.length;
  }, [orders, soundEnabled, autoPrint]);

  const playAlert = () => {
    try {
      // Use Web Audio API for a simple beep
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.frequency.value = 880;
      oscillator.type = "sine";
      gainNode.gain.value = 0.3;
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      oscillator.stop(ctx.currentTime + 0.5);

      // Second beep
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1100;
        osc2.type = "sine";
        gain2.gain.value = 0.3;
        osc2.start();
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc2.stop(ctx.currentTime + 0.5);
      }, 300);
    } catch {}
  };

  const toggleAvailability = async (itemId: string, currentValue: boolean) => {
    const newValue = !currentValue;
    // Determine which items to toggle (burger + its meal)
    const idsToToggle = [itemId];
    const linkedMeal = burgerToMeal[itemId];
    if (linkedMeal && !newValue) {
      // Turning off a burger → also turn off its meal
      idsToToggle.push(linkedMeal);
    }

    // Optimistic update
    setAvailabilityItems((prev) =>
      prev.map((item) => (idsToToggle.includes(item.item_id) ? { ...item, available: newValue } : item))
    );

    // Update all in DB
    for (const id of idsToToggle) {
      const { error } = await supabase
        .from("menu_availability")
        .update({ available: newValue, updated_at: new Date().toISOString() })
        .eq("item_id", id);
      if (error) {
        setAvailabilityItems((prev) =>
          prev.map((item) => (item.item_id === id ? { ...item, available: currentValue } : item))
        );
      }
    }
  };

  const availabilityGrouped = availabilityCategoryOrder
    .map((cat) => {
      const order = itemOrder[cat] || [];
      const catItems = availabilityItems.filter((i) => i.category === cat);
      catItems.sort((a, b) => {
        const ai = order.indexOf(a.item_id);
        const bi = order.indexOf(b.item_id);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
      return { category: cat, label: availabilityCategoryLabels[cat] || cat, items: catItems };
    })
    .filter((g) => g.items.length > 0);

  const updateStatus = async (orderId: string, newStatus: string, prepMinutes?: number) => {
    const updateData: any = { status: newStatus };
    if (newStatus === "preparing" && prepMinutes) {
      updateData.estimated_ready_at = new Date(Date.now() + prepMinutes * 60 * 1000).toISOString();
    }
    await supabase.from("orders").update(updateData).eq("id", orderId);
    setShowTimePicker(null);
    fetchOrders();
  };

  const printOrder = (order: Order) => {
    const printWindow = window.open("", "_blank", "width=300,height=600");
    if (!printWindow) return;

    const itemsHtml = order.order_items
      .map((item) => {
        let html = `<div style="margin-bottom:8px;border-bottom:1px dashed #ccc;padding-bottom:8px;">
          <div style="font-weight:bold;">${item.item_name} x${item.quantity}</div>
          <div style="text-align:left;">₪${item.price * item.quantity}</div>`;

        if (item.removals && item.removals.length > 0) {
          html += `<div style="color:#c00;font-size:12px;">ללא: ${item.removals.join(", ")}</div>`;
        }
        if (item.toppings && item.toppings.length > 0) {
          html += `<div style="color:#060;font-size:12px;">תוספות: ${item.toppings.join(", ")}</div>`;
        }
        if (item.with_meal) {
          html += `<div style="font-size:12px;">🍟 ארוחה עסקית`;
          if (item.meal_side) html += ` - ${item.meal_side}`;
          if (item.meal_drink) html += `, ${item.meal_drink}`;
          html += `</div>`;
        }
        if (item.deal_burgers) {
          const burgers = item.deal_burgers as any[];
          burgers.forEach((b: any, i: number) => {
            html += `<div style="font-size:12px;">🍔 המבורגר ${i + 1}`;
            if (b.name) html += ` (${b.name})`;
            if (b.removals?.length > 0) html += ` — ${b.removals.join(", ")}`;
            html += `</div>`;
          });
          html += `<div style="font-size:12px;">🍟 צ׳יפס ענק</div>`;
        }
        if (item.deal_drinks) {
          const drinks = item.deal_drinks as any[];
          drinks.forEach((d: any, i: number) => {
            html += `<div style="font-size:12px;">🥤 ${d.name}${d.extraCost > 0 ? ` (+₪${d.extraCost})` : ""}</div>`;
          });
        }
        html += `</div>`;
        return html;
      })
      .join("");

    const isCash = order.payment_method === "cash";
    const paymentBanner = isCash
      ? `<div style="text-align:center;background:#000;color:#fff;padding:10px;margin-bottom:10px;font-size:18px;font-weight:bold;border:3px solid #000;">
           ⚠️ לא שולם ⚠️
         </div>`
      : "";

    const paymentFooter = isCash
      ? `<div style="text-align:center;border:3px solid #000;padding:12px;margin-top:10px;font-size:16px;font-weight:bold;background:#f5f5f5;">
           💵 תשלום במזומן בעת המסירה 💵
         </div>`
      : `<div style="text-align:center;margin-top:10px;font-size:12px;color:#060;font-weight:bold;">
           ✅ שולם באשראי
         </div>`;

    printWindow.document.write(`
      <html dir="rtl">
      <head><title>בון #${order.order_number}</title></head>
      <body style="font-family:Arial;width:280px;margin:0 auto;padding:10px;font-size:14px;">
        ${paymentBanner}
        <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:10px;">
          <h2 style="margin:0;">הַבַּקְּתָה 🐄</h2>
          <p style="margin:4px 0;font-size:12px;">המבורגר של מושבניקים</p>
        </div>
        <div style="border-bottom:1px solid #000;padding-bottom:8px;margin-bottom:8px;">
          <strong>הזמנה #${order.order_number}</strong><br/>
          <span style="font-size:12px;">${new Date(order.created_at).toLocaleString("he-IL")}</span>
        </div>
        <div style="border-bottom:1px solid #000;padding-bottom:8px;margin-bottom:8px;">
          <strong>${order.customer_name}</strong><br/>
          📞 ${order.customer_phone}<br/>
          📍 ${order.customer_address || "—"}
          ${order.notes ? `<br/>📝 ${order.notes}` : ""}
        </div>
        ${itemsHtml}
        <div style="border-top:2px solid #000;padding-top:8px;font-size:18px;font-weight:bold;text-align:center;">
          סה״כ: ₪${order.total}
        </div>
        ${paymentFooter}
        <div style="text-align:center;margin-top:10px;font-size:10px;color:#999;">
          בתיאבון! 🍔
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const activeOrders = orders.filter((o) => ["new", "preparing", "ready"].includes(o.status));
  const historyOrders = orders.filter((o) => ["completed", "cancelled"].includes(o.status));
  const displayOrders = viewMode === "active" ? activeOrders : historyOrders;

  const timeSince = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return `${diff} שניות`;
    if (diff < 3600) return `${Math.floor(diff / 60)} דקות`;
    return `${Math.floor(diff / 3600)} שעות`;
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black text-foreground">🍔 מטבח הבקתה</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("active")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                viewMode === "active"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-secondary"
              }`}
            >
              <Clock size={14} className="inline ml-1" />
              פעילות ({activeOrders.length})
            </button>
            <button
              onClick={() => setViewMode("history")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                viewMode === "history"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-secondary"
              }`}
            >
              <History size={14} className="inline ml-1" />
              היסטוריה
            </button>
            <button
              onClick={() => setViewMode("availability")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                viewMode === "availability"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-secondary"
              }`}
            >
              <Package size={14} className="inline ml-1" />
              מלאי
            </button>
            <button
              onClick={() => setViewMode("dashboard")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                viewMode === "dashboard"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-secondary"
              }`}
            >
              <BarChart3 size={14} className="inline ml-1" />
              דשבורד
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoPrint(!autoPrint)}
            className={`p-2 rounded-lg transition-colors ${
              autoPrint ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
            }`}
            title={autoPrint ? "כבה הדפסה אוטומטית" : "הפעל הדפסה אוטומטית"}
          >
            <Printer size={20} />
          </button>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg transition-colors ${
              soundEnabled ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"
            }`}
            title={soundEnabled ? "כבה צלצול" : "הפעל צלצול"}
          >
            {soundEnabled ? <Bell size={20} /> : <BellOff size={20} />}
          </button>
          <div className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("he-IL")}
          </div>
        </div>
      </div>

      {/* Restaurant Status Bar */}
      <div className="bg-card border-b border-border px-6 py-3 flex items-center justify-center gap-6 flex-wrap">
        <div className="flex items-center gap-3">
          <Globe size={16} className={restaurantStatus.website_open ? "text-green-400" : "text-destructive"} />
          <span className="text-sm font-medium text-foreground">אתר הזמנות</span>
          <button
            onClick={() => toggleWebsite(!restaurantStatus.website_open)}
            className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
              restaurantStatus.website_open ? "bg-green-500" : "bg-destructive"
            }`}
          >
            <motion.div
              className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md"
              animate={{ left: restaurantStatus.website_open ? "1.5rem" : "0.125rem" }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
          <span className={`text-xs font-bold ${restaurantStatus.website_open ? "text-green-400" : "text-destructive"}`}>
            {restaurantStatus.website_open ? "פתוח" : "סגור"}
          </span>
        </div>

        <div className="w-px h-6 bg-border" />

        <div className="flex items-center gap-3">
          <Monitor size={16} className={restaurantStatus.station_open ? "text-green-400" : "text-destructive"} />
          <span className="text-sm font-medium text-foreground">עמדת הזמנות</span>
          <button
            onClick={() => toggleStation(!restaurantStatus.station_open)}
            className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
              restaurantStatus.station_open ? "bg-green-500" : "bg-destructive"
            }`}
          >
            <motion.div
              className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md"
              animate={{ left: restaurantStatus.station_open ? "1.5rem" : "0.125rem" }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
          <span className={`text-xs font-bold ${restaurantStatus.station_open ? "text-green-400" : "text-destructive"}`}>
            {restaurantStatus.station_open ? "פתוח" : "סגור"}
          </span>
        </div>

        <div className="w-px h-6 bg-border" />

        <div className="flex items-center gap-3">
          <Banknote size={16} className={restaurantStatus.cash_enabled ? "text-green-400" : "text-destructive"} />
          <span className="text-sm font-medium text-foreground">מזומן</span>
          <button
            onClick={() => toggleCash(!restaurantStatus.cash_enabled)}
            className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
              restaurantStatus.cash_enabled ? "bg-green-500" : "bg-destructive"
            }`}
          >
            <motion.div
              className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md"
              animate={{ left: restaurantStatus.cash_enabled ? "1.5rem" : "0.125rem" }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <CreditCard size={16} className={restaurantStatus.credit_enabled ? "text-green-400" : "text-destructive"} />
          <span className="text-sm font-medium text-foreground">אשראי</span>
          <button
            onClick={() => toggleCredit(!restaurantStatus.credit_enabled)}
            className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
              restaurantStatus.credit_enabled ? "bg-green-500" : "bg-destructive"
            }`}
          >
            <motion.div
              className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md"
              animate={{ left: restaurantStatus.credit_enabled ? "1.5rem" : "0.125rem" }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>

        <div className="w-px h-6 bg-border" />

        {restaurantStatus.website_open || restaurantStatus.station_open ? (
          <button
            onClick={closeAll}
            className="px-4 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-bold hover:bg-destructive/90 transition-colors"
          >
            סגור הכל
          </button>
        ) : (
          <button
            onClick={openAll}
            className="px-4 py-1.5 rounded-lg bg-green-500 text-white text-sm font-bold hover:bg-green-600 transition-colors"
          >
            פתח הכל
          </button>
        )}
      </div>

      {/* Availability View */}
      {viewMode === "availability" ? (
        <div className="max-w-2xl mx-auto px-4 py-6">
          {availabilityGrouped.map((group) => (
            <div key={group.category} className="mb-8">
              <h2 className="text-xl font-bold text-primary mb-3">{group.label}</h2>
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                {group.items.map((item, i) => (
                  <motion.div
                    key={item.item_id}
                    className={`flex items-center justify-between px-4 py-3.5 ${
                      i < group.items.length - 1 ? "border-b border-border/50" : ""
                    }`}
                  >
                    <button
                      onClick={() => toggleAvailability(item.item_id, item.available)}
                      className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                        item.available ? "bg-green-500" : "bg-muted"
                      }`}
                    >
                      <motion.div
                        className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md"
                        animate={{ left: item.available ? "1.5rem" : "0.125rem" }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </button>
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${!item.available ? "text-muted-foreground line-through" : "text-foreground"}`}>
                        {item.item_name}
                      </span>
                      {!item.available && (
                        <span className="text-[10px] font-bold bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full">
                          אזל
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Orders Grid */
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayOrders.length === 0 && (
            <div className="col-span-full text-center py-20 text-muted-foreground">
              <p className="text-4xl mb-4">{viewMode === "active" ? "🎉" : "📋"}</p>
              <p className="text-lg">{viewMode === "active" ? "אין הזמנות פעילות" : "אין היסטוריה עדיין"}</p>
            </div>
          )}

          {displayOrders.map((order) => {
            const config = statusConfig[order.status];
            const next = nextStatus[order.status];

            return (
              <div
                key={order.id}
                className={`bg-card border rounded-xl overflow-hidden ${
                  order.status === "new" ? "border-red-500 shadow-lg shadow-red-500/20 animate-pulse" : "border-border"
                }`}
              >
                {/* Order header */}
                <div className={`${config.color} px-4 py-3 flex items-center justify-between text-white`}>
                  <div className="flex items-center gap-2">
                    {config.icon}
                    <span className="font-bold">#{order.order_number}</span>
                    <span className="text-sm opacity-80">{config.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => printOrder(order)}
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                      title="הדפסת בון"
                    >
                      <Printer size={16} />
                    </button>
                    <span className="text-xs opacity-80">
                      <Clock size={12} className="inline ml-0.5" />
                      {timeSince(order.created_at)}
                    </span>
                  </div>
                </div>

                {/* Customer info */}
                <div className="px-4 py-3 border-b border-border bg-secondary/30">
                  <p className="font-bold text-foreground">{order.customer_name}</p>
                  <p className="text-sm text-muted-foreground">📞 {order.customer_phone}</p>
                  {order.customer_address && (
                    <p className="text-sm text-muted-foreground">📍 {order.customer_address}</p>
                  )}
                  {order.notes && (
                    <p className="text-sm text-primary mt-1">📝 {order.notes}</p>
                  )}
                  {order.payment_method === "cash" && (
                    <p className="text-sm font-bold text-yellow-400 mt-1">💵 מזומן — לא שולם</p>
                  )}
                  {order.payment_method === "credit" && (
                    <p className="text-sm font-bold text-green-400 mt-1">💳 שולם באשראי</p>
                  )}
                </div>

                {/* Items */}
                <div className="px-4 py-3 space-y-2 max-h-60 overflow-y-auto">
                  {order.order_items.map((item) => (
                    <div key={item.id} className="text-sm border-b border-border/50 pb-2 last:border-b-0">
                      <div className="flex justify-between font-medium">
                        <span>{item.item_name} x{item.quantity}</span>
                        <span className="text-primary">₪{item.price * item.quantity}</span>
                      </div>
                      {item.removals && item.removals.length > 0 && (
                        <p className="text-xs text-red-400">ללא: {item.removals.join(", ")}</p>
                      )}
                      {item.toppings && item.toppings.length > 0 && (
                        <p className="text-xs text-green-400">+ {item.toppings.join(", ")}</p>
                      )}
                      {item.with_meal && (
                        <p className="text-xs text-muted-foreground">
                          🍟 ארוחה{item.meal_side ? ` — ${item.meal_side}` : ""}{item.meal_drink ? `, ${item.meal_drink}` : ""}
                        </p>
                      )}
                      {item.deal_burgers && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {(item.deal_burgers as any[]).map((b: any, i: number) => (
                            <p key={i}>
                              🍔 המבורגר {i + 1}
                              {b.name && <span className="font-bold text-foreground"> ({b.name})</span>}
                              {b.removals?.length > 0 && ` — ${b.removals.join(", ")}`}
                            </p>
                          ))}
                          <p>🍟 צ׳יפס ענק</p>
                          {item.deal_drinks && (item.deal_drinks as any[]).map((d: any, i: number) => (
                            <p key={i}>🥤 {d.name}{d.extraCost > 0 ? ` (+₪${d.extraCost})` : ""}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Time picker overlay */}
                {showTimePicker === order.id && (
                  <div className="px-4 py-3 border-t border-border bg-secondary/50">
                    <p className="text-sm font-bold text-foreground mb-2">כמה זמן הכנה? ⏱️</p>
                    <div className="flex flex-wrap gap-2">
                      {PREP_TIMES.map((min) => (
                        <button
                          key={min}
                          onClick={() => updateStatus(order.id, "preparing", min)}
                          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
                        >
                          {min} דק׳
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowTimePicker(null)}
                      className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      ביטול
                    </button>
                  </div>
                )}

                {/* Footer */}
                <div className="px-4 py-3 border-t border-border flex items-center justify-between">
                  <span className="font-bold text-lg text-primary">₪{order.total}</span>
                  <div className="flex gap-2">
                    {order.status === "new" && (
                      <button
                        onClick={() => updateStatus(order.id, "cancelled")}
                        className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-sm hover:bg-destructive hover:text-destructive-foreground transition-colors"
                      >
                        ביטול
                      </button>
                    )}
                    {next && (
                      next === "preparing" ? (
                        <button
                          onClick={() => setShowTimePicker(order.id)}
                          className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
                        >
                          התחל הכנה 👨‍🍳
                        </button>
                      ) : (
                        <button
                          onClick={() => updateStatus(order.id, next)}
                          className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
                        >
                          {next === "ready" ? "מוכנה ✅" : "הושלמה"}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Tracking link */}
                {order.status === "preparing" && (
                  <div className="px-4 py-2 border-t border-border bg-secondary/20 text-center">
                    <p className="text-xs text-muted-foreground">
                      קישור מעקב: <span className="text-primary font-mono select-all">/track?order={order.order_number}</span>
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Kitchen;
