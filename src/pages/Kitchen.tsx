import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, ChefHat, CheckCircle, XCircle, Printer, Bell, BellOff, History } from "lucide-react";

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
  order_items: OrderItem[];
}

type ViewMode = "active" | "history";

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
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showTimePicker, setShowTimePicker] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevOrderCountRef = useRef(0);

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

    // Subscribe to real-time changes
    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  // Play sound on new order
  useEffect(() => {
    const newOrders = orders.filter((o) => o.status === "new");
    if (newOrders.length > prevOrderCountRef.current && soundEnabled) {
      playAlert();
    }
    prevOrderCountRef.current = newOrders.length;
  }, [orders, soundEnabled]);

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

    printWindow.document.write(`
      <html dir="rtl">
      <head><title>בון #${order.order_number}</title></head>
      <body style="font-family:Arial;width:280px;margin:0 auto;padding:10px;font-size:14px;">
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
          </div>
        </div>
        <div className="flex items-center gap-3">
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

      {/* Orders Grid */}
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
                    <button
                      onClick={() => updateStatus(order.id, next)}
                      className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
                    >
                      {next === "preparing" ? "התחל הכנה 👨‍🍳" : next === "ready" ? "מוכנה ✅" : "הושלמה"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Kitchen;
