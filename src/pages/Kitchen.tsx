import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, ChefHat, CheckCircle, XCircle, Printer, Bell, BellOff, History, Package, Store, Globe, Monitor, Banknote, CreditCard, BarChart3, Music, Wifi, WifiOff, Settings, AlertTriangle, Plus, Minus, Eye, X, ClipboardList, ListChecks } from "lucide-react";
import DashboardView from "@/components/DashboardView";
import { useRestaurantStatus } from "@/hooks/useRestaurantStatus";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { printReceipt, buildReceiptHtml, buildRoundSummaryHtml, printRoundSummary, buildRoundChefSummaryHtml, printRoundChefSummary } from "@/lib/kitchenReceipt";

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
  order_source: string;
  estimated_ready_at: string | null;
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
  doneness: "🔥 מידת עשייה",
};

const availabilityCategoryOrder = ["burger", "meal", "side", "drink", "deal", "topping", "sauce", "ingredient", "doneness"];

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
  topping: ["onion-jam", "peanut-butter", "fried-onion", "garlic-confit", "egg", "vegan-cheddar", "roastbeef", "extra-patty", "extra-smash-patty", "hot-pepper-jam", "onion-rings-topping", "maple"],
  sauce: ["ketchup", "mayo", "chili", "plum"],
  ingredient: ["lettuce", "tomato", "pickles", "aioli", "onion"],
  doneness: ["doneness-category", "doneness-m", "doneness-mw", "doneness-wd"],
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

// Ringtone definitions using Web Audio API
type RingtoneId = "gentle-chime" | "double-bell" | "soft-pulse" | "ding-dong" | "triple-tap";

const RINGTONES: { id: RingtoneId; label: string }[] = [
  { id: "gentle-chime", label: "🔔 צלצול עדין" },
  { id: "double-bell", label: "🎵 פעמון כפול" },
  { id: "soft-pulse", label: "🎶 פולס רך" },
  { id: "ding-dong", label: "🛎️ דינג דונג" },
  { id: "triple-tap", label: "🎼 שלוש נקישות" },
];

// Reuse a single AudioContext to avoid browser limits
let sharedAudioCtx: AudioContext | null = null;

const getAudioCtx = (): AudioContext | null => {
  try {
    if (!sharedAudioCtx) {
      sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
};

// Unlock audio on first user click
if (typeof window !== "undefined") {
  const unlock = () => {
    getAudioCtx();
    document.removeEventListener("click", unlock);
    document.removeEventListener("touchstart", unlock);
  };
  document.addEventListener("click", unlock, { once: true });
  document.addEventListener("touchstart", unlock, { once: true });
}

const playRingtone = (ringtoneId: RingtoneId) => {
  const ctx = getAudioCtx();
  if (!ctx) return;

  const now = ctx.currentTime;

  const playTone = (freq: number, start: number, duration: number, type: OscillatorType = "sine", vol = 0.25) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = type;
    gain.gain.setValueAtTime(vol, now + start);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
    osc.start(now + start);
    osc.stop(now + start + duration);
  };

  switch (ringtoneId) {
    case "gentle-chime":
      playTone(880, 0, 0.8);
      playTone(1100, 0.5, 0.9);
      playTone(880, 1.2, 0.6);
      break;
    case "double-bell":
      playTone(660, 0, 0.7, "triangle", 0.3);
      playTone(880, 0.6, 0.7, "triangle", 0.3);
      playTone(1050, 1.2, 0.8, "triangle", 0.25);
      break;
    case "soft-pulse":
      playTone(520, 0, 0.8, "sine", 0.2);
      playTone(520, 0.9, 0.8, "sine", 0.15);
      playTone(650, 1.8, 0.7, "sine", 0.2);
      playTone(780, 2.5, 0.9, "sine", 0.2);
      break;
    case "ding-dong":
      playTone(830, 0, 0.9, "triangle", 0.3);
      playTone(620, 0.8, 1.0, "triangle", 0.25);
      playTone(830, 1.7, 0.8, "triangle", 0.2);
      break;
    case "triple-tap":
      playTone(700, 0, 0.5, "square", 0.1);
      playTone(700, 0.55, 0.5, "square", 0.1);
      playTone(900, 1.1, 0.7, "square", 0.12);
      playTone(1100, 1.8, 0.6, "square", 0.1);
      break;
  }
};

// Escalation thresholds (seconds) — saved in localStorage
const DEFAULT_RED_AFTER = 60;
const DEFAULT_AGGRESSIVE_AFTER = 120;
const POLLING_FALLBACK_MS = 3000;
const AGGRESSIVE_RING_MS = 2000;
const NORMAL_RING_MS = 5000;

const Kitchen = () => {
  const { status: restaurantStatus, toggleWebsite, toggleStation, toggleCash, toggleCredit, closeAll, openAll } = useRestaurantStatus();
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPrint, setAutoPrint] = useState(true);
  const [showTimePicker, setShowTimePicker] = useState<string | null>(null);
  const [selectedRingtone, setSelectedRingtone] = useState<RingtoneId>(() => {
    return (localStorage.getItem("kitchen-ringtone") as RingtoneId) || "gentle-chime";
  });
  const [showRingtoneMenu, setShowRingtoneMenu] = useState(false);
  const [audioActivated, setAudioActivated] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const printedOrdersRef = useRef<Set<string>>(new Set());
  const seenOrdersRef = useRef<Set<string>>(new Set());
  const prevOrderCountRef = useRef(0);
  const [availabilityItems, setAvailabilityItems] = useState<AvailabilityItem[]>([]);
  const alertIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Realtime / fallback state
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [showRoundSummary, setShowRoundSummary] = useState(false);
  const [showRoundChefSummary, setShowRoundChefSummary] = useState(false);

  // Build the preview HTML asynchronously (QR generation needs a Promise).
  useEffect(() => {
    if (!previewOrder) {
      setPreviewHtml("");
      return;
    }
    let cancelled = false;
    buildReceiptHtml({
      order_number: previewOrder.order_number,
      customer_name: previewOrder.customer_name,
      customer_phone: previewOrder.customer_phone,
      notes: previewOrder.notes,
      total: previewOrder.total,
      created_at: previewOrder.created_at,
      payment_method: previewOrder.payment_method,
      order_source: previewOrder.order_source,
      order_items: previewOrder.order_items,
    }).then((html) => {
      if (!cancelled) setPreviewHtml(html);
    });
    return () => {
      cancelled = true;
    };
  }, [previewOrder]);

  // Lock body scroll while the receipt preview modal is open — prevents background
  // scrolling on iOS/touch devices and traps the gesture inside the modal.
  useEffect(() => {
    if (!previewOrder) return;
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevWidth = document.body.style.width;
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.width = prevWidth;
      window.scrollTo(0, scrollY);
    };
  }, [previewOrder]);

  // Escalation thresholds (configurable from UI)
  const [redAfter, setRedAfter] = useState<number>(() => {
    const v = parseInt(localStorage.getItem("kitchen-red-after") || "");
    return isNaN(v) ? DEFAULT_RED_AFTER : v;
  });
  const [aggressiveAfter, setAggressiveAfter] = useState<number>(() => {
    const v = parseInt(localStorage.getItem("kitchen-aggressive-after") || "");
    return isNaN(v) ? DEFAULT_AGGRESSIVE_AFTER : v;
  });

  useEffect(() => { localStorage.setItem("kitchen-red-after", String(redAfter)); }, [redAfter]);
  useEffect(() => { localStorage.setItem("kitchen-aggressive-after", String(aggressiveAfter)); }, [aggressiveAfter]);

  // Tick every second so escalation re-evaluates without re-fetching
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => (t + 1) % 1000000), 1000);
    return () => clearInterval(i);
  }, []);

  // Activate audio on first interaction
  useEffect(() => {
    const activate = () => {
      const ctx = getAudioCtx();
      if (ctx) setAudioActivated(true);
      document.removeEventListener("click", activate);
      document.removeEventListener("touchstart", activate);
    };
    document.addEventListener("click", activate);
    document.addEventListener("touchstart", activate);
    // Check if already activated
    if (sharedAudioCtx && sharedAudioCtx.state === "running") {
      setAudioActivated(true);
    }
    return () => {
      document.removeEventListener("click", activate);
      document.removeEventListener("touchstart", activate);
    };
  }, []);

  // Save ringtone choice
  useEffect(() => {
    localStorage.setItem("kitchen-ringtone", selectedRingtone);
  }, [selectedRingtone]);

  // Compute escalation level for a "new" order based on server time (created_at)
  // 0 = fresh (<= redAfter), 1 = waiting (red), 2 = aggressive (very red + fast ring)
  const getEscalationLevel = useCallback((createdAt: string): 0 | 1 | 2 => {
    const ageSec = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    if (ageSec >= aggressiveAfter) return 2;
    if (ageSec >= redAfter) return 1;
    return 0;
  }, [redAfter, aggressiveAfter]);

  // Determine the highest escalation level among "new" orders → controls ring cadence
  const maxEscalation = useMemo(() => {
    let max: 0 | 1 | 2 = 0;
    for (const o of orders) {
      if (o.status !== "new") continue;
      const lvl = getEscalationLevel(o.created_at);
      if (lvl > max) max = lvl;
      if (max === 2) break;
    }
    return max;
  }, [orders, getEscalationLevel]);

  // Repeating alert for new orders — cadence depends on escalation level
  useEffect(() => {
    const hasNewOrders = orders.some((o) => o.status === "new");

    if (hasNewOrders && soundEnabled) {
      const cadence = maxEscalation === 2 ? AGGRESSIVE_RING_MS : NORMAL_RING_MS;
      playRingtone(selectedRingtone);
      alertIntervalRef.current = setInterval(() => {
        playRingtone(selectedRingtone);
      }, cadence);
    } else {
      if (alertIntervalRef.current) {
        clearInterval(alertIntervalRef.current);
        alertIntervalRef.current = null;
      }
    }

    return () => {
      if (alertIntervalRef.current) {
        clearInterval(alertIntervalRef.current);
        alertIntervalRef.current = null;
      }
    };
  }, [orders, soundEnabled, selectedRingtone, maxEscalation]);

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
      const fetched = data as Order[];

      // Detect newly-arrived orders since last fetch and toast for them
      const prevSeen = seenOrdersRef.current;
      const isFirstLoad = prevSeen.size === 0;
      const newlyArrived = fetched.filter(
        (o) => o.status === "new" && !prevSeen.has(o.id)
      );

      const nextSeen = new Set<string>();
      fetched.forEach((o) => nextSeen.add(o.id));
      seenOrdersRef.current = nextSeen;

      if (!isFirstLoad) {
        newlyArrived.forEach((o) => {
          toast.success(`🔔 הזמנה חדשה #${o.order_number}`, {
            description: `${o.customer_name} • ₪${o.total}`,
            duration: 6000,
          });
        });
      }

      setOrders(fetched);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchAvailability();

    const channel = supabase
      .channel("orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrders())
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    const availChannel = supabase
      .channel("availability-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "menu_availability" }, (payload) => {
        const updated = payload.new as AvailabilityItem;
        setAvailabilityItems((prev) =>
          prev.map((item) => (item.item_id === updated.item_id ? { ...item, available: updated.available } : item))
        );
      })
      .subscribe();

    // Polling fallback — runs every 3s as a safety net even if realtime drops
    const pollInterval = setInterval(() => {
      fetchOrders();
    }, POLLING_FALLBACK_MS);

    // Refetch on tab visibility (handles long-idle tablets)
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchOrders();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(availChannel);
      clearInterval(pollInterval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [fetchOrders, fetchAvailability]);

  // Auto-print new orders
  useEffect(() => {
    const newOrders = orders.filter((o) => o.status === "new");
    if (autoPrint) {
      newOrders.forEach((order) => {
        if (!printedOrdersRef.current.has(order.id)) {
          printedOrdersRef.current.add(order.id);
          setTimeout(() => printOrder(order), 500);
        }
      });
    }
    prevOrderCountRef.current = newOrders.length;
  }, [orders, autoPrint]);

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
    const { data, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
      .select();

    if (error) {
      console.error("[Kitchen] Failed to update order status:", error);
      toast.error(`שגיאה בעדכון סטטוס: ${error.message}`);
      return;
    }
    if (!data || data.length === 0) {
      console.warn("[Kitchen] Update returned no rows — likely RLS or session issue", { orderId, newStatus });
      toast.error("העדכון לא בוצע — בדוק הרשאות / התחברות מחדש");
      return;
    }
    setShowTimePicker(null);
    fetchOrders();
  };

  const printOrder = (order: Order) => {
    printReceipt({
      order_number: order.order_number,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      notes: order.notes,
      total: order.total,
      created_at: order.created_at,
      payment_method: order.payment_method,
      order_source: order.order_source,
      order_items: order.order_items,
    });
  };

  // Adjust ETA by +/- N minutes for an in-progress order
  const adjustEta = async (order: Order, deltaMinutes: number) => {
    const base = order.estimated_ready_at
      ? new Date(order.estimated_ready_at).getTime()
      : Date.now();
    const newEta = new Date(base + deltaMinutes * 60 * 1000);
    // Don't allow ETA before now
    if (newEta.getTime() < Date.now() - 60_000) {
      toast.error("לא ניתן להגדיר זמן עבר");
      return;
    }
    const { error } = await supabase
      .from("orders")
      .update({ estimated_ready_at: newEta.toISOString() })
      .eq("id", order.id);
    if (error) {
      toast.error("שגיאה בעדכון זמן הכנה");
      return;
    }
    toast.success(
      deltaMinutes > 0
        ? `הזמן הוארך ב-${deltaMinutes} דק׳`
        : `הזמן קוצר ב-${Math.abs(deltaMinutes)} דק׳`,
      { duration: 2000 }
    );
    fetchOrders();
  };

  const etaCountdown = (eta: string | null): string | null => {
    if (!eta) return null;
    const diffSec = Math.floor((new Date(eta).getTime() - Date.now()) / 1000);
    if (diffSec <= 0) return "מוכן עכשיו";
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    if (mins === 0) return `${secs} שנ׳`;
    return `${mins}:${String(secs).padStart(2, "0")} דק׳`;
  };

  const activeOrders = orders.filter((o) => ["new", "preparing", "ready"].includes(o.status));
  const historyOrders = orders.filter((o) => ["completed", "cancelled"].includes(o.status));
  const displayOrders = viewMode === "active" ? activeOrders : historyOrders;

  // Active orders feeding the round bon — every order not yet completed/cancelled.
  // Sorted oldest → newest so the customer who ordered first appears first
  // (and gets prepared first).
  const activeRoundOrders = useMemo(
    () =>
      orders
        .filter((o) => ["new", "preparing"].includes(o.status))
        .map((o) => ({
          order_number: o.order_number,
          customer_name: o.customer_name,
          created_at: o.created_at,
          status: o.status,
          order_items: o.order_items,
        }))
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        ),
    [orders],
  );
  const roundSummaryHtml = useMemo(
    () => (showRoundSummary ? buildRoundSummaryHtml(activeRoundOrders) : ""),
    [showRoundSummary, activeRoundOrders],
  );
  const roundChefSummaryHtml = useMemo(
    () => (showRoundChefSummary ? buildRoundChefSummaryHtml(activeRoundOrders) : ""),
    [showRoundChefSummary, activeRoundOrders],
  );

  const timeSince = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return `${diff} שניות`;
    if (diff < 3600) return `${Math.floor(diff / 60)} דקות`;
    return `${Math.floor(diff / 3600)} שעות`;
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Audio activation prompt */}
      {!audioActivated && soundEnabled && (
        <div
          className="bg-primary text-primary-foreground text-center py-3 px-6 font-bold text-sm cursor-pointer animate-pulse"
          onClick={() => {
            const ctx = getAudioCtx();
            if (ctx) {
              setAudioActivated(true);
              playRingtone(selectedRingtone);
            }
          }}
        >
          🔊 לחץ כאן כדי להפעיל צלצולים להזמנות חדשות
        </div>
      )}
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
          {/* Realtime status indicator */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold ${
              realtimeConnected ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
            }`}
            title={realtimeConnected ? "Realtime פעיל" : "Realtime מנותק — משתמש ב-polling"}
          >
            {realtimeConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span>{realtimeConnected ? "Live" : "Polling"}</span>
          </div>
          {/* Settings button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${
              showSettings ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground hover:bg-secondary"
            }`}
            title="הגדרות הסלמה"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={() => setAutoPrint(!autoPrint)}
            className={`p-2 rounded-lg transition-colors ${
              autoPrint ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
            }`}
            title={autoPrint ? "כבה הדפסה אוטומטית" : "הפעל הדפסה אוטומטית"}
          >
            <Printer size={20} />
          </button>
          {/* Round bon (per-order detail) — preview (clipboard) + print (purple). */}
          <button
            onClick={() => setShowRoundSummary(true)}
            disabled={activeRoundOrders.length === 0}
            className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeRoundOrders.length === 0
                ? "bg-muted/40 text-muted-foreground/50 cursor-not-allowed"
                : "bg-purple-500/20 text-purple-300 hover:bg-purple-500/30"
            }`}
            title={`הצג בון הזמנות פעילות (${activeRoundOrders.length})`}
          >
            <ClipboardList size={20} />
            <span className="text-xs font-bold">{activeRoundOrders.length}</span>
          </button>
          <button
            onClick={() => {
              if (activeRoundOrders.length === 0) return;
              printRoundSummary(activeRoundOrders);
            }}
            disabled={activeRoundOrders.length === 0}
            className={`p-2 rounded-lg transition-colors ${
              activeRoundOrders.length === 0
                ? "bg-muted/40 text-muted-foreground/50 cursor-not-allowed"
                : "bg-purple-500/20 text-purple-300 hover:bg-purple-500/30"
            }`}
            title="הדפס בון הזמנות פעילות"
          >
            <Printer size={20} />
          </button>
          {/* Round CHEF summary (aggregated only) — preview (list) + print (orange). */}
          <button
            onClick={() => setShowRoundChefSummary(true)}
            disabled={activeRoundOrders.length === 0}
            className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeRoundOrders.length === 0
                ? "bg-muted/40 text-muted-foreground/50 cursor-not-allowed"
                : "bg-orange-500/20 text-orange-300 hover:bg-orange-500/30"
            }`}
            title={`הצג סיכום סבב לטבח (${activeRoundOrders.length})`}
          >
            <ListChecks size={20} />
          </button>
          <button
            onClick={() => {
              if (activeRoundOrders.length === 0) return;
              printRoundChefSummary(activeRoundOrders);
            }}
            disabled={activeRoundOrders.length === 0}
            className={`p-2 rounded-lg transition-colors ${
              activeRoundOrders.length === 0
                ? "bg-muted/40 text-muted-foreground/50 cursor-not-allowed"
                : "bg-orange-500/20 text-orange-300 hover:bg-orange-500/30"
            }`}
            title="הדפס סיכום סבב לטבח"
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
          <div className="relative">
            <button
              onClick={() => setShowRingtoneMenu(!showRingtoneMenu)}
              className="p-2 rounded-lg transition-colors bg-muted text-muted-foreground hover:bg-secondary"
              title="בחר צלצול"
            >
              <Music size={20} />
            </button>
            {showRingtoneMenu && (
              <div className="absolute left-0 top-full mt-2 bg-card border border-border rounded-xl shadow-xl z-50 min-w-[200px] p-2">
                <div className="text-xs font-bold text-muted-foreground px-3 py-1 mb-1">בחר צלצול</div>
                {RINGTONES.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedRingtone(r.id);
                      playRingtone(r.id);
                    }}
                    className={`w-full text-right px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                      selectedRingtone === r.id
                        ? "bg-primary/20 text-primary font-bold"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <span>{r.label}</span>
                    {selectedRingtone === r.id && <span className="text-primary">✓</span>}
                  </button>
                ))}
                <button
                  onClick={() => playRingtone(selectedRingtone)}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-sm bg-muted hover:bg-secondary text-foreground transition-colors"
                >
                  ▶ נגן דוגמה
                </button>
              </div>
            )}
          </div>
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

      {/* Escalation settings panel */}
      {showSettings && (
        <div className="bg-card border-b border-border px-6 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <AlertTriangle size={16} className="text-yellow-400" />
                הגדרות הסלמה — הזמנות שלא אושרו
              </h3>
              <button
                onClick={() => {
                  setRedAfter(DEFAULT_RED_AFTER);
                  setAggressiveAfter(DEFAULT_AGGRESSIVE_AFTER);
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                איפוס לברירת מחדל
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-muted/40 rounded-lg p-3">
                <label className="text-sm font-bold text-orange-400 mb-2 block">
                  🟧 התראה אדומה אחרי: {redAfter} שניות
                </label>
                <input
                  type="range"
                  min={15}
                  max={300}
                  step={5}
                  value={redAfter}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setRedAfter(v);
                    if (v >= aggressiveAfter) setAggressiveAfter(v + 30);
                  }}
                  className="w-full accent-orange-500"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  הכרטיס יקבל מסגרת אדומה ובאדג׳ "ממתין"
                </p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <label className="text-sm font-bold text-red-500 mb-2 block">
                  🚨 צלצול אגרסיבי אחרי: {aggressiveAfter} שניות
                </label>
                <input
                  type="range"
                  min={Math.max(30, redAfter + 10)}
                  max={600}
                  step={10}
                  value={aggressiveAfter}
                  onChange={(e) => setAggressiveAfter(parseInt(e.target.value))}
                  className="w-full accent-red-500"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  צלצול חזק כל {AGGRESSIVE_RING_MS / 1000} שניות עד אישור
                </p>
              </div>
            </div>
          </div>
        </div>
      )}


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
      ) : viewMode === "dashboard" ? (
        <DashboardView />
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
            const escLevel = order.status === "new" ? getEscalationLevel(order.created_at) : 0;

            // Card visual escalation
            const cardClass =
              order.status !== "new"
                ? "border-border"
                : escLevel === 2
                ? "border-red-600 border-2 shadow-2xl shadow-red-600/50 animate-pulse bg-red-950/20"
                : escLevel === 1
                ? "border-red-500 border-2 shadow-lg shadow-red-500/40 bg-red-950/10"
                : "border-red-500 shadow-lg shadow-red-500/20 animate-pulse";

            return (
              <div
                key={order.id}
                className={`bg-card border rounded-xl overflow-hidden ${cardClass}`}
              >
                {/* Order header */}
                <div className={`${config.color} px-4 py-3 flex items-center justify-between text-white`}>
                  <div className="flex items-center gap-2">
                    {config.icon}
                    <span className="font-bold">#{order.order_number}</span>
                    <span className="text-sm opacity-80">{config.label}</span>
                    {order.status === "new" && escLevel === 0 && (
                      <span className="text-[10px] font-black bg-white text-red-600 px-1.5 py-0.5 rounded-full animate-pulse">
                        חדש
                      </span>
                    )}
                    {order.status === "new" && escLevel === 1 && (
                      <span className="text-[10px] font-black bg-yellow-300 text-red-700 px-1.5 py-0.5 rounded-full animate-pulse">
                        ⏳ ממתין!
                      </span>
                    )}
                    {order.status === "new" && escLevel === 2 && (
                      <span className="text-[10px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded-full animate-pulse">
                        🚨 דחוף!
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPreviewOrder(order)}
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                      title="צפייה בבון"
                    >
                      <Eye size={16} />
                    </button>
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
                  {order.payment_method === "counter" && (
                    <p className="text-sm font-bold text-red-400 mt-1 animate-pulse">⚠️ לתשלום בקופה</p>
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
                      {(() => {
                        const doneEntry = item.removals?.find(r => r.startsWith("doneness-"));
                        const doneLabel: Record<string, string> = { "doneness-m": "M — מדיום", "doneness-mw": "MW — מדיום וואל", "doneness-wd": "WD — וואל דאן" };
                        const otherRemovals = item.removals?.filter(r => !r.startsWith("doneness-") && !r.startsWith("__OWNER__:")) || [];
                        return (
                          <>
                            {doneEntry && (
                              <p className="text-xs font-bold text-orange-400">🔥 {doneLabel[doneEntry] || doneEntry}</p>
                            )}
                            {otherRemovals.length > 0 && (
                              <p className="text-xs text-red-400">ללא: {otherRemovals.join(", ")}</p>
                            )}
                          </>
                        );
                      })()}
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
                        order.order_source === "kiosk" ? (
                          <button
                            onClick={() => updateStatus(order.id, "preparing")}
                            className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
                          >
                            קבל הזמנה ✅
                          </button>
                        ) : (
                          <button
                            onClick={() => setShowTimePicker(order.id)}
                            className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
                          >
                            התחל הכנה 👨‍🍳
                          </button>
                        )
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

                {/* ETA control + tracking link (preparing only) */}
                {order.status === "preparing" && (
                  <div className="px-4 py-3 border-t border-border bg-secondary/30 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Clock size={14} className="text-primary" />
                        זמן הכנה:
                        <span className="text-primary font-black text-base">
                          {etaCountdown(order.estimated_ready_at) || "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => adjustEta(order, -5)}
                          className="px-2 py-1 rounded-md bg-muted text-foreground hover:bg-secondary transition-colors flex items-center gap-1 text-xs font-bold"
                          title="קצר ב-5 דקות"
                        >
                          <Minus size={12} /> 5
                        </button>
                        <button
                          onClick={() => adjustEta(order, 5)}
                          className="px-2 py-1 rounded-md bg-muted text-foreground hover:bg-secondary transition-colors flex items-center gap-1 text-xs font-bold"
                          title="הוסף 5 דקות"
                        >
                          <Plus size={12} /> 5
                        </button>
                        <button
                          onClick={() => adjustEta(order, 10)}
                          className="px-2 py-1 rounded-md bg-muted text-foreground hover:bg-secondary transition-colors flex items-center gap-1 text-xs font-bold"
                          title="הוסף 10 דקות"
                        >
                          <Plus size={12} /> 10
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center">
                      קישור מעקב: <span className="text-primary font-mono select-all">/track?order={order.order_number}</span>
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Receipt preview modal */}
      {previewOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overscroll-contain touch-none"
          onClick={() => setPreviewOrder(null)}
          onTouchMove={(e) => {
            // Block touch-scroll on the backdrop so iOS Safari doesn't bubble it to body
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div
            className="bg-card rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
              <span className="font-bold text-foreground">תצוגת בון #{previewOrder.order_number}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { printOrder(previewOrder); }}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold flex items-center gap-1"
                >
                  <Printer size={14} /> הדפס
                </button>
                <button
                  onClick={() => setPreviewOrder(null)}
                  className="p-1.5 rounded-lg hover:bg-secondary text-foreground"
                  aria-label="סגור"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe
              title="receipt-preview"
              srcDoc={previewHtml}
              className="flex-1 w-full bg-white"
              style={{ minHeight: "60vh" }}
            />
          </div>
        </div>
      )}

      {/* Round-summary preview modal — shows aggregated chef summary for all
          orders currently in 'preparing' status. */}
      {showRoundSummary && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overscroll-contain touch-none"
          onClick={() => setShowRoundSummary(false)}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div
            className="bg-card rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
              <span className="font-bold text-foreground flex items-center gap-2">
                <ClipboardList size={16} className="text-purple-400" />
                בון הזמנות פעילות — {activeRoundOrders.length} הזמנות
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printRoundSummary(activeRoundOrders)}
                  disabled={activeRoundOrders.length === 0}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold flex items-center gap-1 disabled:opacity-50"
                >
                  <Printer size={14} /> הדפס
                </button>
                <button
                  onClick={() => setShowRoundSummary(false)}
                  className="p-1.5 rounded-lg hover:bg-secondary text-foreground"
                  aria-label="סגור"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe
              title="round-summary-preview"
              srcDoc={roundSummaryHtml}
              className="flex-1 w-full bg-white"
              style={{ minHeight: "60vh" }}
            />
          </div>
        </div>
      )}

      {/* Round CHEF summary preview modal — aggregated counts only (no per-order detail). */}
      {showRoundChefSummary && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overscroll-contain touch-none"
          onClick={() => setShowRoundChefSummary(false)}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div
            className="bg-card rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
              <span className="font-bold text-foreground flex items-center gap-2">
                <ListChecks size={16} className="text-orange-400" />
                סיכום סבב לטבח — {activeRoundOrders.length} הזמנות
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printRoundChefSummary(activeRoundOrders)}
                  disabled={activeRoundOrders.length === 0}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold flex items-center gap-1 disabled:opacity-50"
                >
                  <Printer size={14} /> הדפס
                </button>
                <button
                  onClick={() => setShowRoundChefSummary(false)}
                  className="p-1.5 rounded-lg hover:bg-secondary text-foreground"
                  aria-label="סגור"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe
              title="round-chef-summary-preview"
              srcDoc={roundChefSummaryHtml}
              className="flex-1 w-full bg-white"
              style={{ minHeight: "60vh" }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Kitchen;
