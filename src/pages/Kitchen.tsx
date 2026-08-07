import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { Clock, ChefHat, CheckCircle, XCircle, Printer, Bell, BellOff, History, Package, Store, Globe, Monitor, Banknote, CreditCard, BarChart3, Music, Wifi, WifiOff, Settings, AlertTriangle, Plus, Minus, Eye, X, ClipboardList, ListChecks, Bluetooth, BluetoothConnected, QrCode, Refrigerator, Pencil } from "lucide-react";
import EditOrderModal from "@/components/EditOrderModal";
import QRCode from "qrcode";
// DashboardView is lazy-loaded — pulls in recharts, admin-only, keep out of main bundle
const DashboardView = lazy(() => import("@/components/DashboardView"));
import { DeliveryZonesDialog, DeliveryRequestsPanel } from "@/components/kitchen/DeliveryPanel";
import { useRestaurantStatus } from "@/hooks/useRestaurantStatus";
import { useWakeLock } from "@/hooks/useWakeLock";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { printReceipt, buildReceiptHtml, buildRoundSummaryHtml, printRoundSummary, buildRoundChefSummaryHtml, printRoundChefSummary, extractOwnerName, applyVeggieShortcut, isBurgerItemName, sortByQueue, type RoundOrder } from "@/lib/kitchenReceipt";
import {
  isWebBluetoothSupported,
  isPrinterConnected,
  onPrinterStatusChange,
  pairPrinter,
  disconnectPrinter,
  tryAutoReconnect,
  printBluetoothReceipt,
  printBluetoothRoundSummary,
  printBluetoothRoundChef,
  printBluetoothFridgeRefill,
  printBluetoothPhoneQr,
  printTest,
  printHybridDiagnostic,
  getEncoding,
  setEncoding,
  getPaperWidthDots,
  setPaperWidthDots,
  getPrintRotate180,
  setPrintRotate180,
  type EncodingProfile,
} from "@/lib/bluetoothPrinter";
import {
  getPrintMode,
  setPrintMode,
  printRawBTReceipt,
  printRawBTRoundSummary,
  printRawBTRoundChef,
  printRawBTFridgeRefill,
  printRawBTPhoneQr,
  printRawBTPlainText,
  printRawBTPlainTextDirect,
  printRawBTPlainTextShare,
  type PrintMode,
  type RawBTDebugInfo,
} from "@/lib/rawbtPrinter";
import { printAgentReceipt, printAgentRoundSummary, printAgentRoundChef, printAgentFridgeRefill, printAgentTest, printAgentPhoneQr } from "@/lib/localPrintAgent";
import { usePrintAgentHealth } from "@/hooks/usePrintAgentHealth";
import { subscribeKitchenToPush, isKitchenSubscribed, unsubscribeKitchenFromPush } from "@/lib/push";
import { useActiveCustomerCount } from "@/hooks/useCustomerActivity";
import { ingredients } from "@/data/menu";
import { getRemovalShortcut, shortcutConsumedIds, removalShortcutLabel } from "@/lib/ingredientShortcuts";
import EventsKitchenPanel from "@/components/EventsKitchenPanel";

const REMOVAL_LABELS: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const ing of ingredients) {
    const clean = ing.name.replace(/🥬/g, "").trim();
    m[ing.removalId] = clean;
    if (ing.addId) m[ing.addId] = clean;
  }
  return m;
})();



interface OrderItem {
  id: string;
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

interface Order {
  id: string;
  order_number: number;
  /** Queue position — set when the order is marked paid. Null = still waiting for payment. */
  queue_number?: number | null;
  paid_at?: string | null;
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
  dine_in?: boolean | null;
  estimated_ready_at: string | null;
  order_items: OrderItem[];
}

const printableToppings = (toppings: string[] | null | undefined): string[] =>
  (toppings || []).filter((t) => String(t || "").trim() !== "כל הירקות + איולי");

type ViewMode = "active" | "ready" | "history" | "availability" | "dashboard";

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
  burger: ["classic", "smash-moshavnikim", "avishai", "double", "crazy-smash", "smash-double-cheese", "special-hadegel", "haf-mifsha", "crispy-chicken"],
  meal: ["meal-classic", "meal-smash-moshavnikim", "meal-avishai", "meal-double", "meal-crazy-smash", "meal-smash-double-cheese", "meal-special-hadegel", "meal-haf-mifsha", "meal-crispy-chicken"],
  side: ["fries", "sweet-potato-fries", "onion-rings", "tempura-onion", "friends-mix"],
  drink: [
    "drink-cola", "drink-zero", "drink-fanta", "drink-fanta-grape", "drink-fanta-exotic",
    "drink-sprite", "drink-sprite-zero", "drink-blu", "drink-blu-mojito", "drink-blu-day",
    "drink-watermelon",
    "drink-grapes", "drink-apples", "drink-flavored-water",
    "drink-flavored-water-apple", "drink-flavored-water-grape",
    "water", "soda",
    "drink-carlsberg", "drink-goldstar", "drink-heineken", "drink-corona",
    "drink-hoegaarden", "drink-laffe", "drink-unfiltered", "drink-guinness", "drink-weiss",
    "drink-stella", "drink-paulaner", "drink-shapira", "drink-maccabi",
  ],

  deal: ["family-deal", "friends-deal"],
  topping: ["onion-jam", "peanut-butter", "fried-onion", "garlic-confit", "egg", "vegan-cheddar", "roastbeef", "extra-patty", "extra-vegan-patty", "extra-smash-patty", "hot-pepper-jam", "onion-rings-topping", "maple"],
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
  "crispy-chicken": "meal-crispy-chicken",
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
const POLLING_FALLBACK_MS = 10000;
const AGGRESSIVE_RING_MS = 2000;
const NORMAL_RING_MS = 5000;

const Kitchen = () => {
  useWakeLock(true);
  const activeCustomers = useActiveCustomerCount();
  const { status: restaurantStatus, toggleWebsite, toggleStation, toggleCash, toggleCredit, toggleHighLoad, togglePreorder, setPreorderWindow, toggleDelivery, closeAll, openAll } = useRestaurantStatus();
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPrint, setAutoPrint] = useState(true);
  const [btConnected, setBtConnected] = useState<boolean>(() => isPrinterConnected());
  const [printMode, setPrintModeState] = useState<PrintMode>(() => getPrintMode());
  const [rawbtDebug, setRawbtDebug] = useState<RawBTDebugInfo | null>(null);
  const [agentHealth, refreshAgentHealth] = usePrintAgentHealth(printMode === "agent");
  const [deliveryZonesOpen, setDeliveryZonesOpen] = useState(false);

  const handleQuickConnect = useCallback(async () => {
    if (isPrinterConnected()) {
      setBtConnected(true);
      setPrintModeState("bt");
      setPrintMode("bt");
      toast.success("המדפסת כבר מחוברת");
      return;
    }
    if (!isWebBluetoothSupported()) {
      toast.error("הדפדפן הזה לא תומך ב-Web Bluetooth. השתמש ב-Chrome על אנדרואיד.");
      return;
    }
    try {
      await pairPrinter();
      setBtConnected(true);
      setPrintModeState("bt");
      setPrintMode("bt");
      toast.success("המדפסת חוברה בהצלחה");
    } catch (e: any) {
      if (e?.name !== "NotFoundError") {
        toast.error(e?.message || "שגיאה בחיבור המדפסת");
      }
    }
  }, []);


  const [showTimePicker, setShowTimePicker] = useState<string | null>(null);
  const [selectedRingtone, setSelectedRingtone] = useState<RingtoneId>(() => {
    return (localStorage.getItem("kitchen-ringtone") as RingtoneId) || "gentle-chime";
  });
  const [showRingtoneMenu, setShowRingtoneMenu] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showAvailMenu, setShowAvailMenu] = useState(false);
  const [audioActivated, setAudioActivated] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const printedOrdersRef = useRef<Set<string>>(new Set());
  const seenOrdersRef = useRef<Set<string>>(new Set());
  const prevOrderCountRef = useRef(0);
  const [availabilityItems, setAvailabilityItems] = useState<AvailabilityItem[]>([]);
  const [customToppings, setCustomToppings] = useState<{ id: string; item_id: string; name: string; price: number }[]>([]);
  const [newTopName, setNewTopName] = useState("");
  const [newTopPrice, setNewTopPrice] = useState("");
  const alertIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Realtime / fallback state
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEventsPanel, setShowEventsPanel] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [showRoundSummary, setShowRoundSummary] = useState(false);
  const [showRoundChefSummary, setShowRoundChefSummary] = useState(false);

  // Pause auto-refresh (polling/realtime) while a modal/bon is open so the
  // kitchen view doesn't re-render and scroll-jump under the user.
  const pauseRefreshRef = useRef(false);
  const pendingRefreshRef = useRef(false);
  // Suppress background refetches for a short window after a local mutation.
  // Without this, our own status click triggers a realtime event that re-fetches
  // every order + items and re-renders the whole grid, which makes the button
  // feel frozen for hundreds of ms on a busy tablet.
  const localMutationUntilRef = useRef<number>(0);
  // Track orders currently being mutated to disable buttons + show feedback,
  // and to prevent double-clicks that queue up multiple updates.
  const [pendingStatusIds, setPendingStatusIds] = useState<Set<string>>(new Set());
  const [paidPendingIds, setPaidPendingIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const open = showRoundSummary || showRoundChefSummary || !!previewOrder;
    pauseRefreshRef.current = open;
    if (!open && pendingRefreshRef.current) {
      pendingRefreshRef.current = false;
      // fire a single catch-up fetch after modal closes
      void fetchOrdersRef.current?.();
    }
  }, [showRoundSummary, showRoundChefSummary, previewOrder]);
  const fetchOrdersRef = useRef<(() => Promise<void>) | null>(null);

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
      dine_in: previewOrder.dine_in,
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

  // Swap the document <link rel="manifest"> to the kitchen manifest so the
  // browser offers "install" with the kitchen icon/name/start_url=/kitchen.
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    const prevHref = link?.getAttribute("href") ?? null;
    if (link) link.setAttribute("href", "/kitchen.webmanifest");
    const theme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    const prevTheme = theme?.getAttribute("content") ?? null;
    if (theme) theme.setAttribute("content", "#000000");
    return () => {
      if (link && prevHref) link.setAttribute("href", prevHref);
      if (theme && prevTheme) theme.setAttribute("content", prevTheme);
    };
  }, []);

  // Push notifications — subscribe THIS device as a kitchen device so it
  // receives a push every time a new order is created.
  const [pushEnabled, setPushEnabled] = useState(false);
  useEffect(() => {
    isKitchenSubscribed().then(setPushEnabled);
  }, []);
  const handleEnableKitchenPush = async () => {
    const res = await subscribeKitchenToPush();
    if (res.ok) {
      setPushEnabled(true);
      toast.success("עדכן אותי הופעל ✅ — תקבל התראה בטלפון על כל הזמנה חדשה");
    } else {
      const msg: Record<string, string> = {
        unsupported: "הדפדפן לא תומך בהתראות",
        ios_needs_install: "ב-iOS צריך קודם להוסיף למסך הבית ואז להפעיל",
        denied: "ההרשאה נדחתה — אפשר להפעיל מהגדרות הדפדפן",
        sw_failed: "טעינת ה-Service Worker נכשלה",
        save_failed: "שמירת המנוי נכשלה",
      };
      toast.error(msg[res.reason ?? ""] ?? "נכשל להפעיל התראות");
    }
  };
  const handleDisableKitchenPush = async () => {
    const res = await unsubscribeKitchenFromPush();
    if (res.ok) {
      setPushEnabled(false);
      toast.success("עדכן אותי כובה — לא תקבל יותר התראות לטלפון");
    } else {
      toast.error("נכשל לכבות התראות");
    }
  };
  const handleToggleKitchenPush = async () => {
    if (pushEnabled) await handleDisableKitchenPush();
    else await handleEnableKitchenPush();
  };

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

  const fetchCustomToppings = useCallback(async () => {
    const { data } = await supabase
      .from("custom_toppings")
      .select("id, item_id, name, price")
      .order("created_at");
    if (data) setCustomToppings(data.map((r: any) => ({ ...r, price: Number(r.price) })));
  }, []);

  const fetchOrders = useCallback(async () => {
    // Kitchen tablet only loads the last 7 days of orders. Older orders remain
    // in the database (accessible via reports/customer history) but are never
    // pulled here, so the tablet stays fast regardless of total order volume.
    const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(300);
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
  fetchOrdersRef.current = fetchOrders;

  // Auto-refresh variant: skipped while a modal/bon is open, and queues a
  // single catch-up fetch for when the user closes the modal.
  const fetchOrdersAuto = useCallback(() => {
    if (pauseRefreshRef.current) {
      pendingRefreshRef.current = true;
      return;
    }
    // Skip if we just performed a local mutation — the optimistic update
    // already applied the change, and re-fetching everything would jank the UI.
    if (Date.now() < localMutationUntilRef.current) {
      pendingRefreshRef.current = true;
      return;
    }
    void fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    fetchOrders();
    fetchAvailability();
    fetchCustomToppings();

    const channel = supabase
      .channel("orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrdersAuto())
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    const availChannel = supabase
      .channel("availability-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_availability" }, () => {
        fetchAvailability();
      })
      .subscribe();

    const ctChannel = supabase
      .channel("custom-toppings-kitchen")
      .on("postgres_changes", { event: "*", schema: "public", table: "custom_toppings" }, () => {
        fetchCustomToppings();
      })
      .subscribe();

    // Polling fallback — realtime already pushes updates instantly, so we only
    // need a slow safety-net poll (every 10s) to catch dropped events. A tight
    // 3s poll on top of realtime kept re-fetching the whole orders table and
    // made status-button taps feel unresponsive.
    const pollInterval = setInterval(() => {
      fetchOrdersAuto();
    }, POLLING_FALLBACK_MS);

    // Refetch on tab visibility (handles long-idle tablets)
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchOrdersAuto();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(availChannel);
      supabase.removeChannel(ctChannel);
      clearInterval(pollInterval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [fetchOrders, fetchOrdersAuto, fetchAvailability, fetchCustomToppings]);

  // Auto-print new orders.
  // Race: orders INSERT realtime fires before order_items rows finish writing,
  // so the first fetch may return an order with an empty order_items array.
  // When that happens, fetch THIS order directly with its items (retrying a
  // few times) and print as soon as items appear — no waiting for the next
  // poll cycle or for a manual confirmation.
  useEffect(() => {
    // Auto-print any order that has entered the queue (marked paid). With the
    // new workflow an order is accepted first (status becomes preparing/ready),
    // then paid and assigned a queue_number, so we look at all active orders.
    const printableOrders = orders.filter(
      (o) => ["new", "preparing", "ready"].includes(o.status) && !!o.queue_number,
    );
    if (autoPrint) {
      printableOrders.forEach((order) => {
        if (printedOrdersRef.current.has(order.id)) return;
        const hasItems = Array.isArray(order.order_items) && order.order_items.length > 0;
        if (hasItems) {
          printedOrdersRef.current.add(order.id);
          setTimeout(() => printOrder(order), 200);
          return;
        }
        // Reserve the slot immediately so we don't fire multiple fetch loops
        // for the same order across re-renders.
        printedOrdersRef.current.add(order.id);
        (async () => {
          for (let attempt = 0; attempt < 8; attempt++) {
            await new Promise((r) => setTimeout(r, 250 + attempt * 150));
            const { data, error } = await supabase
              .from("orders")
              .select("*, order_items(*)")
              .eq("id", order.id)
              .maybeSingle();
            if (!error && data && Array.isArray((data as any).order_items) && (data as any).order_items.length > 0) {
              const full = data as unknown as Order;
              // Sync into local state so the UI shows the items too.
              setOrders((prev) => prev.map((o) => (o.id === full.id ? full : o)));
              printOrder(full);
              return;
            }
          }
          // Gave up: clear the reservation so a manual reprint can still work.
          console.warn("[Kitchen] auto-print: order_items never arrived for", order.id);
          printedOrdersRef.current.delete(order.id);
        })();
      });
    }
    prevOrderCountRef.current = printableOrders.length;
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

  const addCustomTopping = async () => {
    const name = newTopName.trim();
    const price = parseFloat(newTopPrice);
    if (!name || isNaN(price) || price < 0) {
      toast.error("הכנס שם ומחיר תקין");
      return;
    }
    const slug = `custom-${Date.now()}`;
    const { error } = await supabase.from("custom_toppings").insert({
      item_id: slug, name, price,
    });
    if (error) { toast.error("שגיאה בהוספה"); return; }
    // Create matching availability row
    await supabase.from("menu_availability").insert({
      item_id: slug, item_name: name, category: "topping", available: true, manually_disabled: false,
    });
    setNewTopName(""); setNewTopPrice("");
    fetchCustomToppings(); fetchAvailability();
    toast.success(`התוספת "${name}" נוספה`);
  };

  const deleteCustomTopping = async (itemId: string, name: string) => {
    if (!confirm(`למחוק את "${name}"?`)) return;
    await supabase.from("custom_toppings").delete().eq("item_id", itemId);
    await supabase.from("menu_availability").delete().eq("item_id", itemId);
    fetchCustomToppings(); fetchAvailability();
    toast.success("נמחק");
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

  const completeAllReady = async () => {
    const readyIds = orders.filter((o) => o.status === "ready").map((o) => o.id);
    if (readyIds.length === 0) {
      toast.info("אין הזמנות מוכנות");
      return;
    }
    const prevOrders = orders;
    setOrders((curr) =>
      curr.map((o) => (readyIds.includes(o.id) ? { ...o, status: "completed" as Order["status"] } : o)),
    );
    const { error } = await supabase
      .from("orders")
      .update({ status: "completed" })
      .in("id", readyIds);
    if (error) {
      toast.error(`שגיאה: ${error.message}`);
      setOrders(prevOrders);
      return;
    }
    toast.success(`${readyIds.length} הזמנות הושלמו`);
  };

  // Mark an order as paid → it gets the next position in today's queue and
  // moves from the "waiting for payment" area into the preparation queue.
  const markPaid = async (order: Order) => {
    if (paidPendingIds.has(order.id) || order.queue_number) return;
    setPaidPendingIds((s) => new Set(s).add(order.id));
    const { data, error } = await supabase.rpc("mark_order_paid", { p_order_id: order.id });
    setPaidPendingIds((s) => {
      const n = new Set(s);
      n.delete(order.id);
      return n;
    });
    if (error) {
      console.error("[Kitchen] mark_order_paid failed:", error);
      toast.error("שגיאה בסימון תשלום");
      return;
    }
    const queueNumber = Number(data);
    setOrders((curr) =>
      curr.map((o) =>
        o.id === order.id ? { ...o, queue_number: queueNumber, paid_at: new Date().toISOString() } : o,
      ),
    );
    toast.success(`שולם ✅ נכנס לתור במקום ${queueNumber}`, { duration: 3000 });
    fetchOrders();
  };


  const updateStatus = async (orderId: string, newStatus: string, prepMinutes?: number) => {
    // Guard against double-clicks — if this order is already being updated,
    // ignore extra taps until the DB round-trip finishes.
    if (pendingStatusIds.has(orderId)) return;

    const updateData: any = { status: newStatus };
    if (newStatus === "preparing" && prepMinutes) {
      updateData.estimated_ready_at = new Date(Date.now() + prepMinutes * 60 * 1000).toISOString();
    }

    // Optimistic update — flip the card immediately so the user sees instant
    // feedback. We snapshot the prior state so we can roll back on error.
    const prevOrders = orders;
    setOrders((curr) =>
      curr.map((o) =>
        o.id === orderId
          ? { ...o, status: newStatus as Order["status"], ...(updateData.estimated_ready_at ? { estimated_ready_at: updateData.estimated_ready_at } : {}) }
          : o,
      ),
    );
    setShowTimePicker(null);
    setPendingStatusIds((s) => {
      const n = new Set(s);
      n.add(orderId);
      return n;
    });
    // Suppress the self-triggered realtime refetch for ~1.5s.
    localMutationUntilRef.current = Date.now() + 1500;

    const { data, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
      .select();

    setPendingStatusIds((s) => {
      const n = new Set(s);
      n.delete(orderId);
      return n;
    });

    if (error) {
      console.error("[Kitchen] Failed to update order status:", error);
      toast.error(`שגיאה בעדכון סטטוס: ${error.message}`);
      setOrders(prevOrders); // rollback
      return;
    }
    if (!data || data.length === 0) {
      console.warn("[Kitchen] Update returned no rows — likely RLS or session issue", { orderId, newStatus });
      toast.error("העדכון לא בוצע — בדוק הרשאות / התחברות מחדש");
      setOrders(prevOrders); // rollback
      return;
    }

    // Push notification is sent automatically by the DB trigger
    // (public.notify_order_ready) — no client call needed. Removed to keep
    // the send-order-ready-push endpoint restricted to server-side callers.
  };

  const printOrder = (order: Order) => {
    const payload = {
      order_number: order.order_number,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      notes: order.notes,
      total: order.total,
      created_at: order.created_at,
      payment_method: order.payment_method,
      order_source: order.order_source,
      dine_in: order.dine_in,
      order_items: order.order_items,
    };
    // If the direct Bluetooth connection is active, always use it first.
    // The test print uses this same path, so a working test means bons should
    // never be routed to the old Android print app / browser fallback.
    if (isPrinterConnected()) {
      printBluetoothReceipt(payload).catch((err) => {
        console.warn("[Kitchen] BT print failed", err);
        toast.error("שגיאה בהדפסה בלוטות׳ — חבר מחדש את המדפסת ונסה שוב");
      });
      return;
    }

    // Local Print Agent (preferred): tiny Android app on the same tablet
    // holds an open BT socket and writes ESC/POS bytes directly. Completely
    // silent — Kitchen stays visible. Falls back to RawBT if the agent is
    // unreachable or returns an error.
    if (printMode === "agent") {
      printAgentReceipt(payload)
        .then((info) => {
          setRawbtDebug({
            bytesLen: info.bytesLen,
            b64Len: 0,
            urlPreview: "",
            transport: info.transport,
            status: info.status,
            error: info.error,
            at: info.at,
            orderNumber: info.orderNumber,
          });
          if (info.status === "error") {
            console.warn("[Kitchen] Agent print failed, falling back to RawBT", info.error);
            toast.warning("Agent לא זמין — שולח דרך RawBT");
            printRawBTReceipt(payload).then((r) => setRawbtDebug(r));
          }
        });
      return;
    }
    // RawBT: send ESC/POS bytes via the RawBT Android app over Bluetooth.
    // No window.print(), no browser print dialog. Silent/background via
    // hidden-iframe rawbt: scheme — Kitchen stays visible.
    if (printMode === "rawbt") {
      printRawBTReceipt(payload)
        .then((info) => {
          setRawbtDebug(info);
          if (info.status === "error") {
            toast.error(`שגיאה ב-RawBT: ${info.error ?? "לא ידוע"}`);
          }
        })
        .catch((err) => {
          console.warn("[Kitchen] RawBT print failed", err);
          setRawbtDebug({
            bytesLen: 0,
            b64Len: 0,
            urlPreview: "",
            transport: "rawbt:base64",
            status: "error",
            error: String(err?.message ?? err),
            at: new Date().toISOString(),
            orderNumber: order.order_number,
          });
          toast.error("שגיאה בשליחה ל-RawBT");
        });
      return;
    }
    if (printMode === "bt") {
      toast.error("מדפסת בלוטות׳ לא מחוברת — לחץ על הדפסה ואז חבר מדפסת");
      return;
    }

    printReceipt(payload);
  };

  // Manual reprint: bypasses the once-per-order dedup guard.
  const reprintOrder = (order: Order) => {
    printedOrdersRef.current.add(order.id);
    printOrder(order);
  };

  // Print a standalone phone-QR bon through the same printer pipeline as the
  // kitchen bon (BT → Agent → RawBT → browser). No window.print() / popup.
  const printCustomerQr = async (order: Order) => {
    const phoneRaw = (order.customer_phone || "").trim();
    if (!phoneRaw) {
      toast.error("אין מספר טלפון להזמנה זו");
      return;
    }
    const payload = {
      order_number: order.order_number,
      customer_name: order.customer_name,
      customer_phone: phoneRaw,
      notes: order.notes,
      total: order.total,
      created_at: order.created_at,
      payment_method: order.payment_method,
      order_source: order.order_source,
      dine_in: order.dine_in,
      order_items: order.order_items,
    };

    if (isPrinterConnected()) {
      printBluetoothPhoneQr(payload).catch((err) => {
        console.warn("[Kitchen] BT QR print failed", err);
        toast.error("שגיאה בהדפסת QR בבלוטות׳");
      });
      return;
    }
    if (printMode === "agent") {
      printAgentPhoneQr(payload).then((info) => {
        if (info.status === "error") {
          console.warn("[Kitchen] Agent QR failed, falling back to RawBT", info.error);
          toast.warning("Agent לא זמין — שולח QR דרך RawBT");
          printRawBTPhoneQr(payload);
        }
      });
      return;
    }
    if (printMode === "rawbt") {
      printRawBTPhoneQr(payload).then((info) => {
        if (info.status === "error") {
          toast.error(`שגיאה ב-RawBT: ${info.error ?? "לא ידוע"}`);
        }
      });
      return;
    }
    if (printMode === "bt") {
      toast.error("מדפסת בלוטות׳ לא מחוברת");
      return;
    }
    // browser fallback
    try {
      const telDigits = phoneRaw.replace(/[^\d+]/g, "");
      const qrDataUrl = await QRCode.toDataURL(`tel:${telDigits}`, {
        width: 512, margin: 2, errorCorrectionLevel: "H",
      });
      const win = window.open("", "_blank", "width=400,height=600");
      if (!win) { toast.error("חלון ההדפסה נחסם"); return; }
      const safeName = (order.customer_name || "").replace(/[<>&]/g, "");
      const safePhone = phoneRaw.replace(/[<>&]/g, "");
      win.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>QR ${safeName}</title>
<style>@page{size:58mm auto;margin:2mm}html,body{margin:0;padding:0;font-family:-apple-system,"Heebo",Arial,sans-serif}.wrap{display:flex;flex-direction:column;align-items:center;padding:2mm 0}img{width:38mm;height:38mm;image-rendering:pixelated}.name{font-size:14pt;font-weight:800;margin-top:2mm;text-align:center}.phone{font-size:13pt;font-weight:700;margin-top:.5mm;direction:ltr;letter-spacing:.5px}.order{font-size:9pt;color:#555;margin-top:1mm}</style></head><body><div class="wrap"><img src="${qrDataUrl}" alt="QR"/><div class="name">${safeName}</div><div class="phone">${safePhone}</div><div class="order">הזמנה #${order.order_number}</div></div><script>window.onload=function(){setTimeout(function(){window.print()},150)};window.onafterprint=function(){window.close()}<\/script></body></html>`);
      win.document.close();
    } catch (e: any) {
      console.warn("[Kitchen] QR print failed", e);
      toast.error(e?.message || "שגיאה בהדפסת QR");
    }
  };


  // Try silent reconnect on mount + keep retrying in the background whenever
  // the printer is not connected (handles printer powering off/on, BT range loss,
  // OS putting the radio to sleep, etc.). Also retries when the tab becomes visible.
  useEffect(() => {
    let connected = false;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const unsub = onPrinterStatusChange((ok) => {
      connected = ok;
      setBtConnected(ok);
      if (!ok) scheduleRetry(2000);
    });

    const attempt = async () => {
      if (cancelled || connected) return;
      try {
        const ok = await tryAutoReconnect();
        if (ok) {
          connected = true;
          setBtConnected(true);
          return;
        }
      } catch {}
      scheduleRetry(5000);
    };

    const scheduleRetry = (ms: number) => {
      if (cancelled || connected) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(attempt, ms);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible" && !connected) attempt();
    };
    document.addEventListener("visibilitychange", onVisible);

    attempt();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      unsub();
    };
  }, []);

  const handleConnectPrinter = async () => {
    if (!isWebBluetoothSupported()) {
      toast.error("הדפדפן הזה לא תומך ב-Web Bluetooth. השתמש ב-Chrome על אנדרואיד.");
      return;
    }
    try {
      await pairPrinter();
      setPrintModeState("bt");
      setPrintMode("bt");
      toast.success("המדפסת חוברה בהצלחה");
    } catch (e: any) {
      if (e?.name !== "NotFoundError") {
        toast.error(e?.message || "שגיאה בחיבור המדפסת");
      }
    }
  };

  const handleDisconnectPrinter = async () => {
    await disconnectPrinter();
    toast.success("המדפסת נותקה");
  };

  const handleTestPrint = async () => {
    if (!isPrinterConnected()) {
      toast.error("חבר תחילה את המדפסת");
      return;
    }
    try {
      await printTest();
      toast.success("נשלחה בדיקת הדפסה");
    } catch (e: any) {
      toast.error(e?.message || "שגיאה בהדפסה");
    }
  };

  const [encoding, setEncodingState] = useState<EncodingProfile>(() => getEncoding());
  const [paperWidth, setPaperWidthState] = useState<number>(() => getPaperWidthDots());
  const [rotate180, setRotate180State] = useState<boolean>(() => getPrintRotate180());

  const handleRotateToggle = () => {
    const next = !rotate180;
    setPrintRotate180(next);
    setRotate180State(next);
    toast.success(next ? "הדפסה הפוכה הופעלה (180°)" : "הדפסה רגילה");
  };

  const handleEncodingChange = (p: EncodingProfile) => {
    setEncoding(p);
    setEncodingState(p);
    toast.success(`קידוד נשמר: ${p}`);
  };

  const handlePaperWidthChange = (dots: number) => {
    setPaperWidthDots(dots);
    setPaperWidthState(getPaperWidthDots());
    toast.success(`רוחב נייר: ${dots} נק׳`);
  };

  const handleHybridDiagnostic = async () => {
    if (!isPrinterConnected()) {
      toast.error("חבר תחילה את המדפסת");
      return;
    }
    try {
      await printHybridDiagnostic();
      toast.success("נשלחה בדיקת Hybrid מהירה");
    } catch (e: any) {
      toast.error(e?.message || "שגיאה בהדפסה");
    }
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

  // Active board: single list, always ordered by arrival time. Paying an order
  // only marks it as paid — it never changes position on the board. Orders
  // marked "ready" leave the board and move to the dedicated ready tab.
  const activeOrders = useMemo(() => {
    return orders
      .filter((o) => ["new", "preparing"].includes(o.status))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [orders]);
  const readyOrders = useMemo(() => {
    return orders
      .filter((o) => o.status === "ready")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [orders]);
  const historyOrders = orders.filter((o) => ["completed", "cancelled"].includes(o.status));
  const displayOrders =
    viewMode === "active" ? activeOrders : viewMode === "ready" ? readyOrders : historyOrders;

  // Active orders feeding the round bon — every order not yet completed/cancelled,
  // sorted by queue position so the bon matches the physical order of work.
  const activeRoundOrders = useMemo(
    () =>
      sortByQueue(
        orders
          .filter((o) => ["new", "preparing"].includes(o.status))
          .map((o) => ({
            id: o.id,
            order_number: o.order_number,
            queue_number: o.queue_number ?? null,
            customer_name: o.customer_name,
            created_at: o.created_at,
            status: o.status,
            order_items: o.order_items,
          })),
      ),
    [orders],
  );

  const printRoundBon = () => {
    if (activeRoundOrders.length === 0) return;
    if (isPrinterConnected()) {
      printBluetoothRoundSummary(activeRoundOrders).catch((err) => {
        console.warn("[Kitchen] BT round print failed", err);
        toast.error("שגיאה בהדפסה בלוטות׳ — חבר מחדש את המדפסת ונסה שוב");
      });
      return;
    }
    if (printMode === "bt") {
      toast.error("מדפסת בלוטות׳ לא מחוברת — לחץ על הדפסה ואז חבר מדפסת");
      return;
    }
    if (printMode === "agent") {
      printAgentRoundSummary(activeRoundOrders).then((info) => {
        if (info.status === "error") toast.error("Agent לא זמין להדפסה");
      });
      return;
    }
    if (printMode === "rawbt") {
      printRawBTRoundSummary(activeRoundOrders).then((info) => setRawbtDebug(info));
      return;
    }
    printRoundSummary(activeRoundOrders);
  };

  const printChefBon = () => {
    if (activeRoundOrders.length === 0) return;
    if (isPrinterConnected()) {
      printBluetoothRoundChef(activeRoundOrders).catch((err) => {
        console.warn("[Kitchen] BT chef print failed", err);
        toast.error("שגיאה בהדפסה בלוטות׳ — חבר מחדש את המדפסת ונסה שוב");
      });
      return;
    }
    if (printMode === "bt") {
      toast.error("מדפסת בלוטות׳ לא מחוברת — לחץ על הדפסה ואז חבר מדפסת");
      return;
    }
    if (printMode === "agent") {
      printAgentRoundChef(activeRoundOrders).then((info) => {
        if (info.status === "error") toast.error("Agent לא זמין להדפסה");
      });
      return;
    }
    if (printMode === "rawbt") {
      printRawBTRoundChef(activeRoundOrders).then((info) => setRawbtDebug(info));
      return;
    }
    printRoundChefSummary(activeRoundOrders);
  };


  const printFridgeRefillBon = async () => {
    try {
      const [itemsRes, availRes] = await Promise.all([
        supabase
          .from("inventory_items")
          .select("id, name, fridge_target, fridge_qty, menu_item_id, sort_order, category")
          .gt("fridge_target", 0)
          .order("sort_order", { ascending: true }),
        supabase.from("menu_availability").select("item_id, available"),
      ]);
      if (itemsRes.error) throw itemsRes.error;
      const unavailable = new Set(
        (availRes.data ?? [])
          .filter((a: { available: boolean }) => a.available === false)
          .map((a: { item_id: string }) => a.item_id),
      );
      const refill = (itemsRes.data ?? [])
        .filter((i) => !i.menu_item_id || !unavailable.has(i.menu_item_id))
        .map((i) => ({
          name: i.name as string,
          needed: Math.max(0, Number(i.fridge_target ?? 0) - Number(i.fridge_qty ?? 0)),
        }))
        .filter((i) => i.needed > 0);

      if (refill.length === 0) {
        toast.success("המקרר מלא ✅");
        return;
      }

      // Route through the same print pipeline as other bons.
      if (isPrinterConnected()) {
        printBluetoothFridgeRefill(refill).catch((err) => {
          console.warn("[Kitchen] BT fridge print failed", err);
          toast.error("שגיאה בהדפסה בלוטות׳ — חבר מחדש את המדפסת ונסה שוב");
        });
        return;
      }
      if (printMode === "bt") {
        toast.error("מדפסת בלוטות׳ לא מחוברת — לחץ על הדפסה ואז חבר מדפסת");
        return;
      }
      if (printMode === "agent") {
        printAgentFridgeRefill(refill).then((info) => {
          if (info.status === "error") toast.error("Agent לא זמין להדפסה");
        });
        return;
      }
      if (printMode === "rawbt") {
        printRawBTFridgeRefill(refill).then((info) => setRawbtDebug(info));
        return;
      }

      // Browser fallback — same as round summary fallback path.
      const w = window.open("", "_blank", "width=380,height=600");
      if (!w) {
        toast.error("חלון ההדפסה נחסם");
        return;
      }
      const dateStr = new Date().toLocaleString("he-IL");
      const escape = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const rows = refill
        .map((d) => `<tr><td class="qty">${d.needed}</td><td>${escape(d.name)}</td></tr>`)
        .join("");
      w.document.write(`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"/>
<title>בון מילוי מקרר</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: 'Heebo', sans-serif; color: #000; margin: 0; padding: 8px; }
  h1 { font-size: 22px; text-align: center; margin: 0 0 4px; }
  .sub { text-align: center; font-size: 12px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 18px; }
  td { padding: 6px 4px; border-bottom: 1px dashed #555; }
  td.qty { width: 56px; font-size: 26px; font-weight: 900; text-align: center; background: #000; color: #fff; border-radius: 6px; }
</style>
</head><body>
<h1>🧊 מילוי מקרר</h1>
<div class="sub">${dateStr}</div>
<table>${rows}</table>
<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300);};</script>
</body></html>`);
      w.document.close();
    } catch (e) {
      console.error(e);
      toast.error("שגיאה בטעינת נתוני המקרר");
    }
  };

  const roundSummaryHtml = useMemo(
    () => (showRoundSummary ? buildRoundSummaryHtml(activeRoundOrders, { interactive: true }) : ""),
    [showRoundSummary, activeRoundOrders],
  );
  const roundChefSummaryHtml = useMemo(
    () => (showRoundChefSummary ? buildRoundChefSummaryHtml(activeRoundOrders) : ""),
    [showRoundChefSummary, activeRoundOrders],
  );

  // Listen for "ready" clicks from inside the active-orders bon iframe.
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data as { type?: string; id?: string } | undefined;
      if (data?.type === "kitchen:order-ready" && data.id) {
        updateStatus(data.id, "completed");
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const timeSince = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return `${diff} שניות`;
    if (diff < 3600) return `${Math.floor(diff / 60)} דקות`;
    return `${Math.floor(diff / 3600)} שעות`;
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden" dir="rtl">
      {/* Push notifications activation prompt — highest priority */}
      {!pushEnabled && (
        <div
          className="bg-red-600 text-white text-center py-4 px-6 font-black text-base cursor-pointer animate-pulse flex items-center justify-center gap-2"
          onClick={handleEnableKitchenPush}
        >
          <Bell size={22} />
          🔔 לחץ כאן להפעיל "עדכן אותי" — התראות לטלפון על הזמנות חדשות
        </div>
      )}
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
      <div className="bg-card border-b border-border px-4 py-3 flex flex-col gap-3 sticky top-0 z-10 overflow-x-hidden max-w-full">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-2xl font-black text-foreground">🍔 מטבח הבקתה</h1>
          {activeCustomers > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-sm font-bold animate-pulse"
              title="לקוחות שכרגע בונים הזמנה באתר"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span>
                {activeCustomers === 1
                  ? "לקוח בונה הזמנה כרגע"
                  : `${activeCustomers} לקוחות בונים הזמנה כרגע`}
              </span>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
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
            <button
              onClick={completeAllReady}
              disabled={!orders.some((o) => o.status === "ready")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                orders.some((o) => o.status === "ready")
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-muted/40 text-muted-foreground/50 cursor-not-allowed"
              }`}
              title="העבר את כל ההזמנות המוכנות לסטטוס הושלמה"
            >
              <CheckCircle size={14} className="inline ml-1" />
              השלם הכל ({orders.filter((o) => o.status === "ready").length})
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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

          {/* Settings */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${
              showSettings ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground hover:bg-secondary"
            }`}
            title="הגדרות הסלמה"
          >
            <Settings size={20} />
          </button>

          {/* 🎉 Events */}
          <button
            onClick={() => setShowEventsPanel((v) => !v)}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              showEventsPanel ? "bg-pink-500/40 text-pink-100" : "bg-pink-500/20 text-pink-300 hover:bg-pink-500/30"
            }`}
            title="הזמנות אירועים — הכנות מטבח"
          >
            <span>🎉</span>
            <span>אירועים</span>
          </button>

          {/* 🔔 Notifications group */}
          <div className="relative">
            <button
              onClick={() => { setShowNotifMenu(!showNotifMenu); setShowPrintMenu(false); }}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                pushEnabled && soundEnabled
                  ? "bg-green-500/20 text-green-300"
                  : "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
              }`}
              title="התראות וצלצולים"
            >
              <Bell size={16} />
              <span>התראות</span>
            </button>
            {showNotifMenu && createPortal(<>
              <div role="button" tabIndex={0} aria-label="סגור תפריט התראות" onClick={() => setShowNotifMenu(false)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " " || e.key === "Escape") { e.preventDefault(); setShowNotifMenu(false); } }} className="fixed inset-0 bg-black/50 z-40" />
              <div className="fixed top-16 inset-x-2 mx-auto max-w-sm bg-card border border-border rounded-xl shadow-2xl z-50 p-3 space-y-2">
                <div className="text-xs font-bold text-muted-foreground px-1 pb-1 border-b border-border">
                  התראות וצלצולים
                </div>
                <button
                  onClick={handleToggleKitchenPush}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-bold flex items-center justify-between gap-2 ${
                    pushEnabled ? "bg-green-500/20 text-green-300 hover:bg-green-500/30" : "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                  }`}
                >
                  <span className="flex items-center gap-2"><Bell size={14} /> עדכן אותי (התראה לטלפון)</span>
                  <span>{pushEnabled ? "✓ פעיל — לחץ לכיבוי" : "כבוי — לחץ להפעלה"}</span>
                </button>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-bold flex items-center justify-between gap-2 ${
                    soundEnabled ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2">{soundEnabled ? <Bell size={14} /> : <BellOff size={14} />} צלצול בתוך האפליקציה</span>
                  <span>{soundEnabled ? "מופעל" : "כבוי"}</span>
                </button>
                <div className="pt-1 border-t border-border">
                  <div className="text-xs font-bold text-muted-foreground px-1 py-1">בחר צלצול</div>
                  {RINGTONES.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSelectedRingtone(r.id);
                        playRingtone(r.id);
                      }}
                      className={`w-full text-right px-3 py-1.5 rounded-lg text-sm flex items-center justify-between ${
                        selectedRingtone === r.id ? "bg-primary/20 text-primary font-bold" : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <span>{r.label}</span>
                      {selectedRingtone === r.id && <span>✓</span>}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowNotifMenu(false)}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-xs bg-muted hover:bg-secondary text-foreground"
                >
                  סגור
                </button>
              </div>
            </>, document.body)}
          </div>

          {/* 🟢 Availability group */}
          <div className="relative">
            <button
              onClick={() => { setShowAvailMenu(!showAvailMenu); setShowNotifMenu(false); setShowPrintMenu(false); }}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                restaurantStatus.website_open || restaurantStatus.station_open
                  ? "bg-green-500/20 text-green-300"
                  : "bg-destructive/20 text-destructive hover:bg-destructive/30"
              }`}
              title="זמינות הזמנות ותשלום"
            >
              <Globe size={16} />
              <span>זמינות</span>
            </button>
            {showAvailMenu && createPortal(<>
              <div role="button" tabIndex={0} aria-label="סגור תפריט זמינות" onClick={() => setShowAvailMenu(false)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " " || e.key === "Escape") { e.preventDefault(); setShowAvailMenu(false); } }} className="fixed inset-0 bg-black/50 z-40" />
              <div className="fixed top-16 inset-x-2 mx-auto max-w-sm bg-card border border-border rounded-xl shadow-2xl z-50 p-3 space-y-2">
                <div className="text-xs font-bold text-muted-foreground px-1 pb-1 border-b border-border">
                  זמינות הזמנות ותשלום
                </div>

                <button
                  onClick={() => toggleWebsite(!restaurantStatus.website_open)}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-bold flex items-center justify-between gap-2 ${
                    restaurantStatus.website_open ? "bg-green-500/20 text-green-300" : "bg-destructive/20 text-destructive hover:bg-destructive/30"
                  }`}
                >
                  <span className="flex items-center gap-2"><Globe size={14} /> אתר הזמנות</span>
                  <span>{restaurantStatus.website_open ? "פתוח" : "סגור"}</span>
                </button>

                <button
                  onClick={() => toggleStation(!restaurantStatus.station_open)}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-bold flex items-center justify-between gap-2 ${
                    restaurantStatus.station_open ? "bg-green-500/20 text-green-300" : "bg-destructive/20 text-destructive hover:bg-destructive/30"
                  }`}
                >
                  <span className="flex items-center gap-2"><Monitor size={14} /> עמדת הזמנות</span>
                  <span>{restaurantStatus.station_open ? "פתוח" : "סגור"}</span>
                </button>

                <button
                  onClick={() => toggleCash(!restaurantStatus.cash_enabled)}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-bold flex items-center justify-between gap-2 ${
                    restaurantStatus.cash_enabled ? "bg-green-500/20 text-green-300" : "bg-destructive/20 text-destructive hover:bg-destructive/30"
                  }`}
                >
                  <span className="flex items-center gap-2"><Banknote size={14} /> מזומן</span>
                  <span>{restaurantStatus.cash_enabled ? "פעיל" : "כבוי"}</span>
                </button>

                <button
                  onClick={() => toggleCredit(!restaurantStatus.credit_enabled)}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-bold flex items-center justify-between gap-2 ${
                    restaurantStatus.credit_enabled ? "bg-green-500/20 text-green-300" : "bg-destructive/20 text-destructive hover:bg-destructive/30"
                  }`}
                >
                  <span className="flex items-center gap-2"><CreditCard size={14} /> אשראי</span>
                  <span>{restaurantStatus.credit_enabled ? "פעיל" : "כבוי"}</span>
                </button>

                <button
                  onClick={() => toggleHighLoad(!restaurantStatus.high_load)}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-bold flex items-center justify-between gap-2 border-2 ${
                    restaurantStatus.high_load
                      ? "bg-orange-500/25 text-orange-300 border-orange-500/60 animate-pulse"
                      : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted/60"
                  }`}
                >
                  <span className="flex items-center gap-2">🔥 מצב עומס</span>
                  <span>{restaurantStatus.high_load ? "פעיל — לקוחות רואים התראה" : "כבוי"}</span>
                </button>

                {/* 🕒 Preorder (הזמנה מראש) */}
                <div className={`rounded-lg border-2 ${restaurantStatus.preorder_enabled ? "border-blue-500/50 bg-blue-500/10" : "border-transparent bg-muted/30"} p-2 space-y-2`}>
                  <button
                    onClick={() => togglePreorder(!restaurantStatus.preorder_enabled)}
                    className={`w-full px-3 py-2 rounded-lg text-sm font-bold flex items-center justify-between gap-2 ${
                      restaurantStatus.preorder_enabled ? "bg-blue-500/20 text-blue-300" : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    <span className="flex items-center gap-2">🕒 הזמנה מראש לשעה</span>
                    <span>{restaurantStatus.preorder_enabled ? "פעיל" : "כבוי"}</span>
                  </button>
                  {restaurantStatus.preorder_enabled && (
                    <div className="flex items-center gap-2 text-xs text-foreground px-1">
                      <span className="text-muted-foreground">שעות זמינות:</span>
                      <input
                        type="time"
                        value={(restaurantStatus.preorder_start_time || "10:00").slice(0, 5)}
                        onChange={(e) => setPreorderWindow(e.target.value, (restaurantStatus.preorder_end_time || "22:00").slice(0, 5))}
                        className="bg-secondary border border-border rounded px-2 py-1 text-foreground"
                      />
                      <span>עד</span>
                      <input
                        type="time"
                        value={(restaurantStatus.preorder_end_time || "22:00").slice(0, 5)}
                        onChange={(e) => setPreorderWindow((restaurantStatus.preorder_start_time || "10:00").slice(0, 5), e.target.value)}
                        className="bg-secondary border border-border rounded px-2 py-1 text-foreground"
                      />
                    </div>
                  )}
                </div>

                {/* 🛵 Delivery toggle + zones */}
                <div className={`rounded-lg border-2 ${restaurantStatus.delivery_enabled ? "border-orange-500/50 bg-orange-500/10" : "border-transparent bg-muted/30"} p-2 space-y-2`}>
                  <button
                    onClick={() => toggleDelivery(!restaurantStatus.delivery_enabled)}
                    className={`w-full px-3 py-2 rounded-lg text-sm font-bold flex items-center justify-between gap-2 ${
                      restaurantStatus.delivery_enabled ? "bg-orange-500/20 text-orange-300" : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    <span className="flex items-center gap-2">🛵 משלוחים</span>
                    <span>{restaurantStatus.delivery_enabled ? "פעילים" : "כבויים"}</span>
                  </button>
                  <button
                    onClick={() => setDeliveryZonesOpen(true)}
                    className="w-full px-3 py-2 rounded-lg text-xs font-bold bg-secondary hover:bg-secondary/70 text-foreground"
                  >
                    ⚙️ ניהול אזורי משלוח
                  </button>
                </div>



                <div className="pt-1 border-t border-border">

                  {restaurantStatus.website_open || restaurantStatus.station_open ? (
                    <button
                      onClick={closeAll}
                      className="w-full px-3 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-bold hover:bg-destructive/90"
                    >
                      סגור הכל
                    </button>
                  ) : (
                    <button
                      onClick={openAll}
                      className="w-full px-3 py-2 rounded-lg bg-green-500 text-white text-sm font-bold hover:bg-green-600"
                    >
                      פתח הכל
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setShowAvailMenu(false)}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-xs bg-muted hover:bg-secondary text-foreground"
                >
                  סגור
                </button>
              </div>
            </>, document.body)}
          </div>



          {/* ⚡ Quick connect to printer (Bluetooth) */}
          <button
            onClick={handleQuickConnect}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              btConnected
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-red-500/20 text-red-300 hover:bg-red-500/30"
            }`}
            title="חיבור מדפסת בלוטות׳"
          >
            {btConnected ? <BluetoothConnected size={16} /> : <Bluetooth size={16} />}
            <span>{btConnected ? "מדפסת מחוברת" : "חבר מדפסת"}</span>
          </button>

          {/* 🖨️ Print & Diagnostics group */}
          <div className="relative">
            {/* Print settings live inside the ⚙️ settings panel — the old
                toolbar button was removed as it cluttered the header. */}
            {showPrintMenu && createPortal(<>
              <div role="button" tabIndex={0} aria-label="סגור תפריט הדפסה" onClick={() => setShowPrintMenu(false)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " " || e.key === "Escape") { e.preventDefault(); setShowPrintMenu(false); } }} className="fixed inset-0 bg-black/50 z-40" />
              <div className="fixed top-16 inset-x-2 mx-auto max-w-sm bg-card border border-border rounded-xl shadow-2xl z-50 p-3 space-y-2 max-h-[80vh] overflow-y-auto">
                <div className="text-xs font-bold text-muted-foreground px-1 pb-1 border-b border-border">
                  הגדרות הדפסה ובדיקות
                </div>

                {/* Auto print */}
                <button
                  onClick={() => setAutoPrint(!autoPrint)}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-bold flex items-center justify-between ${
                    autoPrint ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2"><Printer size={14} /> הדפסה אוטומטית</span>
                  <span>{autoPrint ? "מופעל" : "כבוי"}</span>
                </button>

                {/* Print mode */}
                <div className="px-3 py-2 rounded-lg bg-muted text-foreground border border-border text-sm flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">מצב הדפסה</span>
                  <span className="font-bold">{btConnected ? "Bluetooth" : printMode === "agent" ? "Agent (מקומי)" : printMode}</span>
                </div>

                {/* Agent health */}
                {printMode === "agent" && (
                  <div
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                      agentHealth?.ok
                        ? "bg-emerald-500/20 text-emerald-300"
                        : agentHealth?.reachable
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-red-500/20 text-red-300"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {agentHealth?.ok ? <BluetoothConnected size={14} /> : <WifiOff size={14} />}
                      סטטוס Agent
                    </span>
                    <span>{agentHealth?.ok ? "✓ מחובר" : agentHealth?.reachable ? "ללא מדפסת" : "לא זמין"}</span>
                  </div>
                )}

                {/* Bluetooth connect */}
                <button
                  onClick={btConnected ? handleDisconnectPrinter : handleConnectPrinter}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-bold flex items-center justify-between ${
                    btConnected ? "bg-blue-500/20 text-blue-300" : "bg-muted text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {btConnected ? <BluetoothConnected size={14} /> : <Bluetooth size={14} />}
                    מדפסת בלוטות׳
                  </span>
                  <span>{btConnected ? "✓ מחוברת" : "חבר"}</span>
                </button>

                {/* Encoding & paper width (only if BT connected) */}
                {btConnected && (
                  <>
                    <div>
                      <div className="text-xs text-muted-foreground px-1 pb-1">קידוד</div>
                      <select
                        value={encoding}
                        onChange={(e) => handleEncodingChange(e.target.value as EncodingProfile)}
                        className="w-full text-sm px-2 py-2 rounded-lg bg-muted text-foreground border border-border"
                      >
                        <option value="cp862-21">A · CP862 n=21</option>
                        <option value="cp862-15">B · CP862 n=15</option>
                        <option value="cp1255-33">C · CP1255 n=33</option>
                      </select>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground px-1 pb-1">רוחב נייר</div>
                      <select
                        value={paperWidth}
                        onChange={(e) => handlePaperWidthChange(parseInt(e.target.value, 10))}
                        className="w-full text-sm px-2 py-2 rounded-lg bg-muted text-foreground border border-border"
                      >
                        <option value={256}>32מ״מ · 256</option>
                        <option value={320}>40מ״מ · 320</option>
                        <option value={384}>58מ״מ · 384</option>
                        <option value={576}>80מ״מ · 576</option>
                      </select>
                    </div>
                    <button
                      onClick={handleRotateToggle}
                      className={`w-full px-3 py-2 rounded-lg text-sm font-bold flex items-center justify-between ${
                        rotate180
                          ? "bg-green-500/20 text-green-300 hover:bg-green-500/30"
                          : "bg-muted text-foreground hover:bg-muted/70"
                      }`}
                    >
                      <span>הפוך הדפסה 180°</span>
                      <span>{rotate180 ? "✓ פעיל" : "כבוי"}</span>
                    </button>
                  </>
                )}


                <button
                  onClick={() => setShowPrintMenu(false)}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-xs bg-muted hover:bg-secondary text-foreground"
                >
                  סגור
                </button>
              </div>
            </>, document.body)}
          </div>

          {/* Round bon (per-order detail) — preview + print */}
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
            onClick={printRoundBon}
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
          {/* Round CHEF summary */}
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
            onClick={printChefBon}
            disabled={activeRoundOrders.length === 0}
            className={`p-3 rounded-xl transition-all duration-150 flex items-center gap-1.5 ${
              activeRoundOrders.length === 0
                ? "bg-green/20 text-green-foreground/40 cursor-not-allowed"
                : "bg-green text-green-foreground shadow-[0_0_20px_hsl(var(--green-glow)/0.6)] hover:shadow-[0_0_30px_hsl(var(--green-glow)/0.85)] hover:scale-105 active:scale-95 active:brightness-110"
            }`}
            title="הדפס סיכום סבב לטבח"
          >
            <Printer size={28} />
          </button>

          <div className="text-sm text-muted-foreground ml-auto">
            {new Date().toLocaleDateString("he-IL")}
          </div>

          <button
            onClick={printFridgeRefillBon}
            className="p-2 rounded-lg transition-colors bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 flex items-center gap-1"
            title="הדפס בון מילוי מקרר"
          >
            <Refrigerator size={20} />
            <Printer size={14} />
          </button>
        </div>
      </div>


      {/* RawBT debug panel removed */}




      {/* Events kitchen inline panel */}
      {showEventsPanel && (
        <div className="bg-card border-b border-border px-4 py-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                🎉 הזמנות אירועים — הכנות מטבח
              </h3>
              <button
                onClick={() => setShowEventsPanel(false)}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                סגור
              </button>
            </div>
            <EventsKitchenPanel />
          </div>
        </div>
      )}

      {/* Escalation settings panel */}
      {showSettings && (
        <div className="bg-card border-b border-border px-6 py-4">
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => { setShowSettings(false); setShowPrintMenu(true); setShowNotifMenu(false); }}
              className="w-full mb-3 px-3 py-2 rounded-lg text-sm font-bold bg-muted text-foreground hover:bg-secondary flex items-center justify-between"
            >
              <span className="flex items-center gap-2"><Printer size={16} /> הגדרות הדפסה ובדיקות</span>
              <span className="text-muted-foreground text-xs">פתח</span>
            </button>
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

          {/* Custom toppings management */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-primary mb-3">➕ ניהול תוספות מותאמות אישית</h2>
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <input
                  type="text"
                  value={newTopName}
                  onChange={(e) => setNewTopName(e.target.value)}
                  placeholder="שם התוספת"
                  className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-right"
                />
                <input
                  type="number"
                  value={newTopPrice}
                  onChange={(e) => setNewTopPrice(e.target.value)}
                  placeholder="מחיר ₪"
                  className="w-full sm:w-28 px-3 py-2 rounded-md border border-border bg-background text-foreground text-right"
                />
                <button
                  onClick={addCustomTopping}
                  className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-bold hover:opacity-90 transition"
                >
                  הוסף תוספת
                </button>
              </div>
              {customToppings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">אין תוספות מותאמות אישית</p>
              ) : (
                <div className="divide-y divide-border/50">
                  {customToppings.map((t) => (
                    <div key={t.id} className="flex items-center justify-between py-2.5">
                      <button
                        onClick={() => deleteCustomTopping(t.item_id, t.name)}
                        className="px-3 py-1 rounded-md bg-destructive text-destructive-foreground text-sm font-bold hover:opacity-90"
                      >
                        מחק
                      </button>
                      <div className="text-right">
                        <span className="font-medium text-foreground">{t.name}</span>
                        <span className="text-muted-foreground text-sm mr-2">₪{t.price}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : viewMode === "dashboard" ? (
        <Suspense fallback={<div className="p-8 text-center text-muted-foreground">טוען לוח בקרה…</div>}>
          <DashboardView />
        </Suspense>
      ) : (
        /* Orders Grid */
        <div className="p-4">
          {viewMode === "active" && <DeliveryRequestsPanel />}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayOrders.length === 0 && (
            <div className="col-span-full text-center py-20 text-muted-foreground">
              <p className="text-4xl mb-4">{viewMode === "active" ? "🎉" : "📋"}</p>
              <p className="text-lg">{viewMode === "active" ? "אין הזמנות פעילות" : "אין היסטוריה עדיין"}</p>
            </div>
          )}

          {displayOrders.map((order, displayIndex) => {
            const config = statusConfig[order.status];
            const next = nextStatus[order.status];
            const escLevel = order.status === "new" ? getEscalationLevel(order.created_at) : 0;
            const isNewUnaccepted = order.status === "new" && !order.queue_number;
            const isAcceptedPendingPayment = order.status !== "new" && !order.queue_number;
            const awaitingPayment = viewMode === "active" && !order.queue_number;

            // Card visual escalation
            const cardClass = awaitingPayment
              ? isNewUnaccepted
                ? escLevel === 2
                  ? "border-red-600 border-2 shadow-2xl shadow-red-600/50 animate-pulse bg-red-950/20"
                  : escLevel === 1
                  ? "border-red-500 border-2 shadow-lg shadow-red-500/40 bg-red-950/10"
                  : "border-red-500 border-2 shadow-lg shadow-red-500/20 animate-pulse bg-red-950/10"
                : "border-amber-500 border-2 shadow-lg shadow-amber-500/30 bg-amber-950/10"
              : "border-green-600/60 border-2";

            return (
              <React.Fragment key={order.id}>

              <div
                className={`bg-card border rounded-xl overflow-hidden ${cardClass}`}
              >
                {/* Order header */}
                <div className={`${config.color} px-4 py-3 flex items-center justify-between text-white`}>
                  <div className="flex items-center gap-2">
                    {config.icon}
                    {order.queue_number ? (
                      <span className="bg-white text-black font-bold text-xs px-1.5 py-0.5 rounded">
                        {order.queue_number}
                      </span>
                    ) : null}
                    <span className="font-bold">#{order.order_number}</span>
                    {order.queue_number ? (
                      <span className="text-[10px] font-black bg-green-500 text-white px-1.5 py-0.5 rounded-full">
                        שולם ✓
                      </span>
                    ) : null}
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
                      onClick={() => reprintOrder(order)}
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                      title="הדפס שוב"
                    >
                      <Printer size={16} />
                    </button>
                    {(order.status === "new" || order.status === "preparing") && (
                      <button
                        onClick={() => setEditingOrder(order)}
                        className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                        title="ערוך הזמנה"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {order.order_source !== "kiosk" && order.order_source !== "station" && (
                      <button
                        onClick={() => printCustomerQr(order)}
                        className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                        title="הדפס QR טלפון לקוח"
                      >
                        <QrCode size={16} />
                      </button>
                    )}
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
                  {(order as any).scheduled_for && (
                    <p className="text-sm font-bold text-blue-400 mt-1">
                      🕒 הזמנה מראש ל־{new Date((order as any).scheduled_for).toLocaleString("he-IL", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                    </p>
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
                  {order.order_items.map((item) => {
                    // Same logic as the printed bon (kitchenReceipt buildReceiptHtml):
                    // strip __FAVORITE__, __OWNER__:<name>, doneness-* out of the
                    // removals array; show owner as a header, doneness as 🔥,
                    // and the rest as "— שינויים: a, b, c".
                    const { ownerName, doneness, cleanedRemovals } = extractOwnerName(item.removals);
                    const isFavorite = item.removals?.some(r => r === "__FAVORITE__");
                    const toppingsToPrint = printableToppings(item.toppings);
                    return (
                      <div key={item.id} className="text-sm border-b border-border/50 pb-2 last:border-b-0">
                        {isFavorite && (
                          <p className="text-xs font-extrabold text-green-400 mb-0.5">⭐ הקבוע</p>
                        )}
                        {ownerName && (
                          <p className="text-xs font-bold text-foreground">👤 {ownerName}</p>
                        )}
                        <div className="flex justify-between font-medium">
                          <span>{item.item_name} x{item.quantity}</span>
                          <span className="text-primary">₪{item.price * item.quantity}</span>
                        </div>
                        {doneness && (
                          <p className="text-xs font-extrabold text-orange-400">🔥 {doneness}</p>
                        )}
                        {(() => {
                          const { label: shortcutLbl, rest } = applyVeggieShortcut(cleanedRemovals, item.item_name);
                          const noChanges = !shortcutLbl && rest.length === 0 && isBurgerItemName(item.item_name);
                          return (
                            <>
                              {shortcutLbl && (
                                <p className="text-xs font-extrabold text-red-400">{shortcutLbl}</p>
                              )}
                              {rest.length > 0 && (
                                <p className="text-xs font-bold text-red-400">— שינויים: {rest.join(", ")}</p>
                              )}
                              {noChanges && (
                                <p className="text-xs font-bold text-muted-foreground">— ללא שינויים</p>
                              )}
                            </>
                          );
                        })()}
                        {toppingsToPrint.length > 0 && (
                          <p className="text-xs font-extrabold text-green-400">+ {toppingsToPrint.join(", ")}</p>
                        )}
                        {item.with_meal && (
                          <p className="text-xs text-muted-foreground">
                            → ארוחה{item.meal_side ? ` — ${item.meal_side}` : ""}{item.meal_drink ? `, ${item.meal_drink}` : ""}
                          </p>
                        )}
                        {item.deal_burgers && Array.isArray(item.deal_burgers) && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {(item.deal_burgers as any[]).map((b: any, i: number) => (
                              <div key={i}>
                                <p>{i + 1}. {b.name || ""}</p>
                                {(() => {
                                  const bRemovals = b.removals || [];
                                  const { label: bShort, rest: bRest } = applyVeggieShortcut(bRemovals, b.name);
                                  const noChanges = !bShort && bRest.length === 0;
                                  return (
                                    <>
                                      {bShort && <p className="font-extrabold text-red-400">{bShort}</p>}
                                      {bRest.length > 0 && <p className="font-bold text-red-400">— שינויים: {bRest.join(", ")}</p>}
                                      {noChanges && <p className="font-bold text-muted-foreground">— ללא שינויים</p>}
                                    </>
                                  );
                                })()}
                                {Array.isArray(b.toppings) && b.toppings.length > 0 && (
                                  <p className="font-extrabold text-green-400">+ {b.toppings.join(", ")}</p>
                                )}
                              </div>
                            ))}
                            <p>+ צ׳יפס ענק</p>
                            {item.deal_drinks && Array.isArray(item.deal_drinks) && (item.deal_drinks as any[]).map((d: any, i: number) => (
                              <p key={i}>+ {d.name}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                    {(() => { const isPending = pendingStatusIds.has(order.id); return (<>
                    {order.status === "new" && (
                      <button
                        onClick={() => updateStatus(order.id, "cancelled")}
                        disabled={isPending}
                        className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-sm hover:bg-destructive hover:text-destructive-foreground transition-colors disabled:opacity-60 disabled:cursor-wait"
                      >
                        ביטול
                      </button>
                    )}
                    {order.status === "preparing" && !order.queue_number && (
                      <button
                        onClick={() => markPaid(order)}
                        disabled={paidPendingIds.has(order.id)}
                        className="px-6 py-3 rounded-lg bg-green-600 text-white font-black text-lg hover:bg-green-500 transition-all active:scale-95 shadow-md shadow-green-600/40 disabled:opacity-60 disabled:cursor-wait"
                      >
                        {paidPendingIds.has(order.id) ? "מעדכן..." : "שולם 💵"}
                      </button>
                    )}
                    {order.status === "ready" && (
                      <button
                        onClick={() => updateStatus(order.id, "preparing")}
                        disabled={isPending}
                        className="px-4 py-3 rounded-lg bg-muted text-foreground text-base font-bold hover:bg-secondary transition-colors active:scale-95 disabled:opacity-60 disabled:cursor-wait"
                        title="החזר להכנה"
                      >
                        ↩ חזור להכנה
                      </button>
                    )}
                    {next && (
                      next === "preparing" ? (
                        order.order_source === "kiosk" ? (
                          <button
                            onClick={() => updateStatus(order.id, "preparing")}
                            disabled={isPending}
                            className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-black text-lg hover:opacity-90 transition-all active:scale-95 shadow-md disabled:opacity-60 disabled:cursor-wait"
                          >
                            {isPending ? "מעדכן..." : "קבל הזמנה ✅"}
                          </button>
                        ) : (
                          <button
                            onClick={() => setShowTimePicker(order.id)}
                            disabled={isPending}
                            className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-black text-lg hover:opacity-90 transition-all active:scale-95 shadow-md disabled:opacity-60 disabled:cursor-wait"
                          >
                            התחל הכנה 👨‍🍳
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => {
                            if (next === "completed" && !order.queue_number) {
                              toast.error("צריך לסמן 'שולם 💵' לפני סיום ההזמנה");
                              return;
                            }
                            updateStatus(order.id, next);
                          }}
                          disabled={isPending || (next === "completed" && !order.queue_number)}
                          className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-black text-lg hover:opacity-90 transition-all active:scale-95 shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                          title={next === "completed" && !order.queue_number ? "יש לסמן שולם קודם" : undefined}
                        >
                          {isPending ? "מעדכן..." : (next === "ready" ? "מוכנה ✅" : (order.queue_number ? "הושלמה ✅" : "הושלמה 🔒"))}
                        </button>
                      )
                    )}
                    </>); })()}
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
              </React.Fragment>
            );
          })}
          </div>
        </div>
      )}

      <DeliveryZonesDialog open={deliveryZonesOpen} onClose={() => setDeliveryZonesOpen(false)} />


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
                  onClick={printRoundBon}
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
                  onClick={printChefBon}
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
      {editingOrder && (
        <EditOrderModal
          open={!!editingOrder}
          onClose={() => setEditingOrder(null)}
          orderId={editingOrder.id}
          orderNumber={editingOrder.order_number}
          items={editingOrder.order_items.map((it) => ({
            id: it.id,
            item_id: it.item_id,
            item_name: it.item_name,
            price: it.price,
            quantity: it.quantity,
            toppings: it.toppings,
            removals: it.removals,
            with_meal: it.with_meal,
            meal_side: it.meal_side,
            meal_drink: it.meal_drink,
            deal_burgers: it.deal_burgers,
            deal_drinks: it.deal_drinks,
          }))}
          onSaved={async ({ requires_reprint }) => {
            // Refetch the updated order so we have fresh items for reprint
            const { data } = await supabase
              .from("orders")
              .select("*, order_items(*)")
              .eq("id", editingOrder.id)
              .maybeSingle();
            if (requires_reprint && data) {
              printedOrdersRef.current.add(data.id);
              printOrder(data as Order);
              toast.info("מדפיס בון מעודכן למטבח");
            }
          }}
        />
      )}
    </div>
  );
};

export default Kitchen;
