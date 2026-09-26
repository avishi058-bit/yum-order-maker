import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, LineChart, Line, Legend, AreaChart, Area
} from "recharts";
import { excludeTestOrders } from "@/lib/testCustomers";
import { countBurgers, type CountableOrderItem } from "@/lib/burgerStats";
import { computeProfit, ACCOUNTANT_MONTHLY, PAYSLIP_MONTHLY, OIL_WEEKLY, TRASH_BAGS_DAILY } from "@/lib/profitStats";
import { toast } from "sonner";
import SuppliesManager from "@/components/SuppliesManager";
import { suppliesCostInRange, type SupplyPurchase } from "@/lib/supplies";
import {
  TrendingUp, TrendingDown, ShoppingBag, DollarSign, Clock, Globe, Beef,
  CalendarRange, Trophy, Flame, BarChart3, Lock, X,
} from "lucide-react";

interface Order {
  id: string;
  order_number: number;
  total: number;
  status: string;
  created_at: string;
  payment_method: string | null;
  paid_at?: string | null;
  order_source: string;
  dine_in?: boolean | null;
  customer_name?: string | null;
  customer_phone?: string | null;
}

const COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444", "#eab308"];

// Orders that never completed payment must not count as revenue
const UNCOUNTED_STATUSES = new Set([
  "cancelled",
  "pending_payment",
  "payment_failed",
  "declined",
]);

const tzOffsetMs = (date: Date): number => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const localAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return localAsUtc - Math.floor(date.getTime() / 1000) * 1000;
};

// Business day in the restaurant runs 06:00 Jerusalem time → next day 06:00.
const getBusinessDayStart = (date = new Date()): Date => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const offsetMs = tzOffsetMs(date);
  let startLocal = Date.UTC(get("year"), get("month") - 1, get("day"), 6, 0, 0);
  if ((get("hour") % 24) < 6) {
    startLocal -= 24 * 60 * 60 * 1000;
  }
  return new Date(startLocal - offsetMs);
};

/** 06:00 Jerusalem on a given calendar date (yyyy-mm-dd) */
const dayStartFromISO = (isoDate: string): Date => {
  const guess = new Date(`${isoDate}T06:00:00Z`);
  return new Date(guess.getTime() - tzOffsetMs(guess));
};

const DAY = 24 * 60 * 60 * 1000;

const monthKey = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit" })
    .format(d)
    .slice(0, 7);

const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("he-IL", { month: "long", year: "numeric" });
};

const monthRange = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const start = dayStartFromISO(`${key}-01`);
  const nextKey = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const end = dayStartFromISO(`${nextKey}-01`);
  return { start, end };
};

const lastMonths = (count: number): string[] => {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 15)));
  }
  return keys;
};

const isoToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());

const DASHBOARD_CODE = "2138";
const TRUSTED_KEY = "dashboard-trusted-device";

type Mode = "today" | "yesterday" | "week" | "month" | "custom" | "pickMonth" | "compare";

const DashboardView = ({ todayOnly = false }: { todayOnly?: boolean }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<CountableOrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("today");
  const [customFrom, setCustomFrom] = useState(isoToday());
  const [customTo, setCustomTo] = useState(isoToday());
  const months = useMemo(() => lastMonths(18), []);
  const [selectedMonth, setSelectedMonth] = useState(months[0]);
  const [monthA, setMonthA] = useState(months[0]);
  const [monthB, setMonthB] = useState(months[1] ?? months[0]);

  const [unlocked, setUnlocked] = useState(() => {
    try {
      return localStorage.getItem(TRUSTED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [codeOpen, setCodeOpen] = useState(false);

  const tryUnlock = () => {
    if (codeInput !== DASHBOARD_CODE) {
      setCodeError(true);
      return;
    }
    if (rememberDevice) {
      try {
        localStorage.setItem(TRUSTED_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    setUnlocked(true);
  };

  const forgetDevice = () => {
    try {
      localStorage.removeItem(TRUSTED_KEY);
    } catch {
      /* ignore */
    }
    setCodeInput("");
    setUnlocked(false);
  };

  // ===== ranges =====
  const ranges = useMemo(() => {
    const todayStart = getBusinessDayStart();
    const tomorrow = new Date(todayStart.getTime() + DAY);
    switch (mode) {
      case "today":
        return [{ key: "today", label: "היום", start: todayStart, end: tomorrow }];
      case "yesterday":
        return [{ key: "yesterday", label: "אתמול", start: new Date(todayStart.getTime() - DAY), end: todayStart }];
      case "week":
        return [{ key: "week", label: "שבוע אחרון", start: new Date(todayStart.getTime() - 6 * DAY), end: tomorrow }];
      case "month": {
        const key = monthKey(new Date());
        return [{ key, label: `החודש · ${monthLabel(key)}`, ...monthRange(key) }];
      }
      case "custom": {
        const from = dayStartFromISO(customFrom);
        const to = new Date(dayStartFromISO(customTo).getTime() + DAY);
        return [{
          key: "custom",
          label: `${new Date(customFrom).toLocaleDateString("he-IL")} – ${new Date(customTo).toLocaleDateString("he-IL")}`,
          start: from,
          end: to > from ? to : new Date(from.getTime() + DAY),
        }];
      }
      case "pickMonth": {
        const r = monthRange(selectedMonth);
        return [{ key: selectedMonth, label: monthLabel(selectedMonth), ...r }];
      }
      case "compare": {
        const a = monthRange(monthA);
        const b = monthRange(monthB);
        return [
          { key: monthA, label: monthLabel(monthA), ...a },
          { key: monthB, label: monthLabel(monthB), ...b },
        ];
      }
    }
  }, [mode, customFrom, customTo, selectedMonth, monthA, monthB]);

  /** When viewing a full calendar month, also pull the previous month for day-vs-day comparison. */
  const monthSelection = useMemo(() => {
    if (mode !== "month" && mode !== "pickMonth") return null;
    const key = mode === "pickMonth" ? selectedMonth : monthKey(new Date());
    const [y, m] = key.split("-").map(Number);
    const prevKey = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    return { key, prevKey, cur: monthRange(key), prev: monthRange(prevKey) };
  }, [mode, selectedMonth]);

  const fetchStart = useMemo(
    () => new Date(Math.min(
      ...ranges.map((r) => r.start.getTime()),
      ...(monthSelection ? [monthSelection.prev.start.getTime()] : []),
    )),
    [ranges, monthSelection],
  );
  const fetchEnd = useMemo(
    () => new Date(Math.max(...ranges.map((r) => r.end.getTime()))),
    [ranges],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, total, status, created_at, payment_method, paid_at, order_source, dine_in, customer_name, customer_phone")
        .gte("created_at", fetchStart.toISOString())
        .lt("created_at", fetchEnd.toISOString())
        .order("created_at", { ascending: true });

      if (cancelled) return;
      const clean = excludeTestOrders((data ?? []) as Order[]);
      setOrders(clean);

      const ids = clean.map((o) => o.id);
      const collected: CountableOrderItem[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { data: rows } = await supabase
          .from("order_items")
          .select("order_id, item_id, item_name, quantity, toppings, meal_drink, meal_side, deal_drinks")
          .in("order_id", chunk);
        if (rows) collected.push(...(rows as CountableOrderItem[]));
      }
      if (cancelled) return;
      setItems(collected);
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [fetchStart, fetchEnd]);

  const [monthlyFixed, setMonthlyFixed] = useState(0);
  const [fixedExpenses, setFixedExpenses] = useState<{ label: string; monthly: number }[]>([]);
  const [newExpLabel, setNewExpLabel] = useState("");
  const [newExpAmount, setNewExpAmount] = useState("");
  const [wages, setWages] = useState<Record<string, number>>({});
  const [wageInput, setWageInput] = useState("");
  const [shifts, setShifts] = useState<{ clock_in: string; clock_out: string | null }[]>([]);
  useEffect(() => {
    (supabase as any).from("work_shifts").select("clock_in, clock_out").gte("clock_in", fetchStart.toISOString()).lt("clock_in", fetchEnd.toISOString())
      .then(({ data }: any) => setShifts(data || []));
  }, [fetchStart, fetchEnd]);
  const [supplies, setSupplies] = useState<SupplyPurchase[]>([]);
  const loadSupplies = () => (supabase as any).from("supply_purchases").select("*").order("purchased_at", { ascending: false }).then(({ data }: any) => setSupplies(data || []));
  useEffect(() => { loadSupplies(); }, []);
  const [workDays, setWorkDays] = useState<Record<string, Set<string>>>({});
  /** חשמל = הוצאה לא מדווחת: לא מנוכה לפני ביטוח לאומי אלא בסוף, אחריו */
  const isElectricity = (e: { label: string }) => e.label.includes("חשמל");
  const electricityMonthly = useMemo(
    () => fixedExpenses.filter(isElectricity).reduce((s, e) => s + (Number(e.monthly) || 0), 0),
    [fixedExpenses],
  );
  useEffect(() => {
    (supabase as any).from("site_settings").select("id, monthly_fixed_costs, monthly_wages, fixed_expenses").limit(1).maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          setWages((data.monthly_wages as Record<string, number>) || {});
          const list = Array.isArray(data.fixed_expenses) ? (data.fixed_expenses as { label: string; monthly: number }[]) : [];
          setFixedExpenses(list);
          setMonthlyFixed(list.filter((e) => !isElectricity(e)).reduce((s, e) => s + (Number(e.monthly) || 0), 0));
        }
      });
  }, []);
  const saveFixedExpenses = async (next: { label: string; monthly: number }[]) => {
    const { data } = await (supabase as any).from("site_settings").select("id").limit(1).maybeSingle();
    if (!data) return;
    const { error } = await (supabase as any).from("site_settings").update({ fixed_expenses: next }).eq("id", data.id);
    if (error) toast.error("השמירה נכשלה");
    else {
      setFixedExpenses(next);
      setMonthlyFixed(next.filter((e) => !isElectricity(e)).reduce((s, e) => s + (Number(e.monthly) || 0), 0));
      toast.success("נשמר");
    }
  };
  const updateExpense = (i: number, patch: Partial<{ label: string; monthly: number }>) =>
    void saveFixedExpenses(fixedExpenses.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const removeExpense = (i: number) => void saveFixedExpenses(fixedExpenses.filter((_, j) => j !== i));
  const addExpense = () => {
    const label = newExpLabel.trim();
    const monthly = Math.max(0, Number(newExpAmount) || 0);
    if (!label || !monthly) { toast.error("יש למלא שם וסכום"); return; }
    void saveFixedExpenses([...fixedExpenses, { label, monthly }]);
    setNewExpLabel(""); setNewExpAmount("");
  };

  const saveWage = async () => {
    const k = ranges[0].key.match(/^\d{4}-\d{2}$/) ? ranges[0].key : monthKey(ranges[0].start);
    const next = { ...wages, [k]: Math.max(0, Number(wageInput) || 0) };
    const { data } = await (supabase as any).from("site_settings").select("id").limit(1).maybeSingle();
    if (!data) return;
    const { error } = await (supabase as any).from("site_settings").update({ monthly_wages: next }).eq("id", data.id);
    if (error) toast.error("השמירה נכשלה"); else { setWages(next); toast.success(`שכר ${monthLabel(k)} נשמר`); }
  };

  const currentMonthKey = monthKey(getBusinessDayStart());
  const avgWorkDays = useMemo(() => {
    const past = Object.entries(workDays).filter(([k, s]) => k !== currentMonthKey && s.size > 0);
    return past.length ? past.reduce((a, [, s]) => a + s.size, 0) / past.length : 0;
  }, [workDays, currentMonthKey]);
  /** divisor for spreading a month's costs: actual work days, or the average for the running month */
  const workDaysDivisor = (k: string) => {
    const actual = workDays[k]?.size ?? 0;
    if (k === currentMonthKey) return Math.max(actual, Math.round(avgWorkDays) || actual, 1);
    return Math.max(actual, 1);
  };

  const HOURLY_WAGE = 41.6; // 40 ₪ + ביטוח לאומי — עלות אמיתית למעסיק
  const isCounted = (o: Order) =>
    !UNCOUNTED_STATUSES.has(o.status) && !(o.payment_method === "credit" && !o.paid_at);

  const isKioskOrder = (o: Order) => o.order_source === "station" || o.order_source === "kiosk";

  const statsFor = (start: Date, end: Date) => {
    const list = orders.filter((o) => {
      if (!isCounted(o)) return false;
      const d = new Date(o.created_at);
      return d >= start && d < end;
    });
    const ids = new Set(list.map((o) => o.id));
    const rangeItems = items.filter((i) => ids.has(i.order_id));
    const { burgers, patties } = countBurgers(rangeItems);
    const revenue = list.reduce((s, o) => s + o.total, 0);
    const creditRevenue = list.filter((o) => o.payment_method === "credit").reduce((s, o) => s + o.total, 0);
    const dayByMonth: Record<string, Set<string>> = {};
    list.forEach((o) => {
      const ds = getBusinessDayStart(new Date(o.created_at));
      const k = monthKey(ds);
      (dayByMonth[k] ??= new Set()).add(ds.toISOString().slice(0, 10));
    });
    let fixed = 0, wagesAlloc = 0, accountant = 0, electricity = 0;
    Object.entries(dayByMonth).forEach(([k, set]) => {
      const share = set.size / workDaysDivisor(k);
      fixed += monthlyFixed * share;
      wagesAlloc += (wages[k] || 0) * share;
      accountant += ACCOUNTANT_MONTHLY * share;
      electricity += electricityMonthly * share;
    });
    const shiftHours = shifts.filter((sh) => { const d = new Date(sh.clock_in); return d >= start && d < end; })
      .reduce((a, sh) => a + (new Date(sh.clock_out || Date.now()).getTime() - new Date(sh.clock_in).getTime()) / 3600000, 0);
    const shiftPay = shiftHours * HOURLY_WAGE;
    wagesAlloc += shiftPay;
    const days = Object.values(dayByMonth).reduce((a, s2) => a + s2.size, 0);
    const oil = (days * OIL_WEEKLY) / 7; // שמן טיגון: עלות שבועית מתחלקת לימי עבודה
    const trashBags = days * TRASH_BAGS_DAILY; // שקיות זבל ליום עבודה
    // תלוש שכר 50 ₪ לחודש — רק בחודשים שבהם העובד עבד בפועל, מתחלק לפי ימי העבודה
    const shiftMonths = new Set(shifts.filter((sh) => { const d = new Date(sh.clock_in); return d >= start && d < end; }).map((sh) => monthKey(new Date(sh.clock_in))));
    let payslip = 0;
    Object.entries(dayByMonth).forEach(([k, set]) => {
      if (shiftMonths.has(k)) payslip += PAYSLIP_MONTHLY * (set.size / workDaysDivisor(k));
    });
    const suppliesCost = suppliesCostInRange(supplies, start, end > new Date() ? new Date() : end);
    fixed += suppliesCost;
    const profit = computeProfit({ revenue, creditRevenue, items: rangeItems, takeawayIds: new Set(list.filter((o) => o.dine_in === false).map((o) => o.id)), dineInIds: new Set(list.filter((o) => o.dine_in === true).map((o) => o.id)), fixed, wages: wagesAlloc, accountant, payslip, oil, trashBags, unreported: electricity });
    return {
      orders: list,
      revenue,
      suppliesCost,
      count: list.length,
      avg: list.length ? revenue / list.length : 0,
      burgers,
      patties,
      days,
      profit,
      shiftHours,
      shiftPay,
    };
  };

  const primary = useMemo(
    () => statsFor(ranges[0].start, ranges[0].end),
    [orders, items, ranges, monthlyFixed, electricityMonthly, wages, workDays, avgWorkDays, shifts, supplies],
  );
  const secondary = useMemo(
    () => (ranges[1] ? statsFor(ranges[1].start, ranges[1].end) : null),
    [orders, items, ranges, monthlyFixed, electricityMonthly, wages, workDays, avgWorkDays, shifts, supplies],
  );

  const filteredOrders = primary.orders;
  const websiteOrders = filteredOrders.filter((o) => !isKioskOrder(o));
  const kioskOrders = filteredOrders.filter(isKioskOrder);

  const pieData = [
    { name: "אתר", value: websiteOrders.reduce((s, o) => s + o.total, 0), count: websiteOrders.length },
    { name: "קיוסק", value: kioskOrders.reduce((s, o) => s + o.total, 0), count: kioskOrders.length },
  ].filter((d) => d.value > 0);

  const sumBy = (m: string | null) =>
    filteredOrders.filter((o) => (m ? o.payment_method === m : !["cash", "credit", "paybox"].includes(o.payment_method ?? ""))).reduce((s, o) => s + o.total, 0);

  const paymentPieData = [
    { name: "מזומן", value: sumBy("cash") },
    { name: "אשראי", value: sumBy("credit") },
    { name: "פייבוקס", value: sumBy("paybox") },
    { name: "לא סומן", value: sumBy(null) },
  ].filter((d) => d.value > 0);

  // Always-visible (no code needed): today's cash + paybox takings
  const openTotals = useMemo(() => {
    const todayStart = getBusinessDayStart();
    const todays = orders.filter(
      (o) => !UNCOUNTED_STATUSES.has(o.status) && new Date(o.created_at) >= todayStart,
    );
    const sum = (m: string) => todays.filter((o) => o.payment_method === m).reduce((s, o) => s + o.total, 0);
    const count = (m: string) => todays.filter((o) => o.payment_method === m).length;
    return { cash: sum("cash"), cashCount: count("cash"), paybox: sum("paybox"), payboxCount: count("paybox") };
  }, [orders]);

  const isHourly = mode === "today" || mode === "yesterday";

  const hourlyData = useMemo(() => {
    const hours: Record<number, { hour: string; revenue: number; orders: number }> = {};
    for (let h = 0; h < 24; h++) hours[h] = { hour: `${h.toString().padStart(2, "0")}:00`, revenue: 0, orders: 0 };
    filteredOrders.forEach((o) => {
      const h = new Date(o.created_at).getHours();
      hours[h].revenue += o.total;
      hours[h].orders += 1;
    });
    return Object.values(hours).filter((h) => h.revenue > 0 || h.orders > 0);
  }, [filteredOrders]);

  const dailyData = useMemo(() => {
    const days: Record<string, { date: string; revenue: number; orders: number; website: number; kiosk: number }> = {};
    filteredOrders.forEach((o) => {
      const d = getBusinessDayStart(new Date(o.created_at)).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
      if (!days[d]) days[d] = { date: d, revenue: 0, orders: 0, website: 0, kiosk: 0 };
      days[d].revenue += o.total;
      days[d].orders += 1;
      if (isKioskOrder(o)) days[d].kiosk += o.total;
      else days[d].website += o.total;
    });
    return Object.values(days);
  }, [filteredOrders]);

  const compareData = useMemo(() => {
    if (!secondary || !ranges[1]) return [];
    return [
      { metric: "הכנסות", [ranges[0].label]: primary.revenue, [ranges[1].label]: secondary.revenue },
      { metric: "הזמנות", [ranges[0].label]: primary.count, [ranges[1].label]: secondary.count },
      { metric: "המבורגרים", [ranges[0].label]: primary.burgers, [ranges[1].label]: secondary.burgers },
      { metric: "קציצות", [ranges[0].label]: primary.patties, [ranges[1].label]: secondary.patties },
    ];
  }, [primary, secondary, ranges]);

  // ===== day-of-month: this month vs previous month =====
  const dayOfMonth = (iso: string) => {
    const start = getBusinessDayStart(new Date(iso));
    return Number(
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", day: "2-digit" }).format(start),
    );
  };

  const monthDayCompare = useMemo(() => {
    if (!monthSelection) return [];
    const bucket = (start: Date, end: Date) => {
      const map: Record<number, number> = {};
      orders.forEach((o) => {
        if (!isCounted(o)) return;
        const d = new Date(o.created_at);
        if (d < start || d >= end) return;
        const day = dayOfMonth(o.created_at);
        map[day] = (map[day] ?? 0) + o.total;
      });
      return map;
    };
    const cur = bucket(monthSelection.cur.start, monthSelection.cur.end);
    const prev = bucket(monthSelection.prev.start, monthSelection.prev.end);
    const days = Math.max(...Object.keys(cur).map(Number), ...Object.keys(prev).map(Number), 1);
    let cumCur = 0;
    let cumPrev = 0;
    const rows = [];
    for (let day = 1; day <= days; day++) {
      cumCur += cur[day] ?? 0;
      cumPrev += prev[day] ?? 0;
      rows.push({
        day: String(day),
        current: cur[day] ?? 0,
        previous: prev[day] ?? 0,
        cumCurrent: cumCur,
        cumPrevious: cumPrev,
      });
    }
    return rows;
  }, [orders, monthSelection]);

  /** Same-days-so-far comparison (fair month-to-date delta) */
  const monthToDate = useMemo(() => {
    if (!monthSelection || monthDayCompare.length === 0) return null;
    const lastActiveDay = monthDayCompare.reduce((m, r) => (r.current > 0 ? Number(r.day) : m), 0);
    if (!lastActiveDay) return null;
    const slice = monthDayCompare.filter((r) => Number(r.day) <= lastActiveDay);
    const cur = slice.reduce((s, r) => s + r.current, 0);
    const prev = slice.reduce((s, r) => s + r.previous, 0);
    const delta = prev > 0 ? ((cur - prev) / prev) * 100 : null;
    return { days: lastActiveDay, cur, prev, delta, prevLabel: monthLabel(monthSelection.prevKey) };
  }, [monthDayCompare, monthSelection]);

  // ===== top selling items =====
  const topItems = useMemo(() => {
    const ids = new Set(primary.orders.map((o) => o.id));
    const map: Record<string, number> = {};
    items.forEach((i) => {
      if (!ids.has(i.order_id)) return;
      const name = i.item_name ?? "—";
      map[name] = (map[name] ?? 0) + (i.quantity ?? 1);
    });
    return Object.entries(map)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [items, primary.orders]);

  // ===== weekday performance =====
  const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  const weekdayData = useMemo(() => {
    const map: Record<number, { revenue: number; orders: number; days: Set<string> }> = {};
    for (let i = 0; i < 7; i++) map[i] = { revenue: 0, orders: 0, days: new Set() };
    filteredOrders.forEach((o) => {
      const start = getBusinessDayStart(new Date(o.created_at));
      const idx = start.getDay();
      map[idx].revenue += o.total;
      map[idx].orders += 1;
      map[idx].days.add(start.toISOString().slice(0, 10));
    });
    return WEEKDAYS.map((name, i) => ({
      name,
      revenue: map[i].revenue,
      orders: map[i].orders,
      avg: map[i].days.size ? Math.round(map[i].revenue / map[i].days.size) : 0,
    }));
  }, [filteredOrders]);

  // ===== 12 month trend (loaded once) =====
  const [trend, setTrend] = useState<{ month: string; revenue: number; orders: number }[]>([]);
  const [trendOrders, setTrendOrders] = useState<Order[]>([]);
  const [trendItems, setTrendItems] = useState<CountableOrderItem[]>([]);
  const [trendShifts, setTrendShifts] = useState<{ clock_in: string; clock_out: string | null }[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const keys = lastMonths(12).reverse();
      const start = monthRange(keys[0]).start;
      const { data } = await supabase
        .from("orders")
        .select("id, total, status, created_at, payment_method, paid_at, order_source, order_number, customer_name, customer_phone, dine_in")
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: true });
      if (cancelled) return;
      const clean = excludeTestOrders((data ?? []) as Order[]).filter(isCounted);
      setTrendOrders(clean);
      const map: Record<string, { revenue: number; orders: number }> = {};
      keys.forEach((k) => (map[k] = { revenue: 0, orders: 0 }));
      const wd: Record<string, Set<string>> = {};
      clean.forEach((o) => {
        const ds = getBusinessDayStart(new Date(o.created_at));
        (wd[monthKey(ds)] ??= new Set()).add(ds.toISOString().slice(0, 10));
      });
      setWorkDays(wd);
      clean.forEach((o) => {
        const k = monthKey(getBusinessDayStart(new Date(o.created_at)));
        if (!map[k]) return;
        map[k].revenue += o.total;
        map[k].orders += 1;
      });
      setTrend(keys.map((k) => ({
        month: monthLabel(k).replace(/\s\d{4}$/, ""),
        revenue: map[k].revenue,
        orders: map[k].orders,
      })));
      // order items + shifts for per-month profit calculation
      const ids = clean.map((o) => o.id);
      const collected: CountableOrderItem[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data: rows } = await supabase
          .from("order_items")
          .select("order_id, item_id, item_name, quantity, toppings, meal_drink, meal_side, deal_drinks")
          .in("order_id", ids.slice(i, i + 200));
        if (rows) collected.push(...(rows as CountableOrderItem[]));
        if (cancelled) return;
      }
      setTrendItems(collected);
      const { data: sh } = await (supabase as any).from("work_shifts").select("clock_in, clock_out").gte("clock_in", start.toISOString());
      if (!cancelled) setTrendShifts(sh || []);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const bestDay = useMemo(() => {
    if (dailyData.length === 0) return null;
    return dailyData.reduce((max, d) => (d.revenue > max.revenue ? d : max), dailyData[0]);
  }, [dailyData]);

  if (!unlocked) {
    return (
      <div dir="rtl" className="p-6 space-y-4 max-w-md mx-auto">
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">מזומן היום</p>
              <p className="text-xl font-black text-foreground">₪{openTotals.cash.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{openTotals.cashCount} הזמנות</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">פייבוקס היום</p>
              <p className="text-xl font-black text-foreground">₪{openTotals.paybox.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{openTotals.payboxCount} הזמנות</p>
            </CardContent>
          </Card>
        </div>

        {!codeOpen ? (
          <div className="flex justify-center pt-1">
            <button
              onClick={() => setCodeOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <Lock size={14} />
              נתוני הכנסות מלאים
            </button>
          </div>
        ) : (
          <Card className="max-w-xs mx-auto">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">הזן קוד לצפייה בכל הנתונים</p>
                <button
                  onClick={() => {
                    setCodeOpen(false);
                    setCodeError(false);
                  }}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label="סגור"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={codeInput}
                  onChange={(e) => {
                    setCodeInput(e.target.value);
                    setCodeError(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") tryUnlock();
                  }}
                  placeholder="קוד"
                  className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-center text-lg tracking-[0.3em] text-foreground"
                />
                <button
                  onClick={tryUnlock}
                  className="h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground"
                >
                  אישור
                </button>
              </div>
              {codeError && <p className="text-xs text-destructive">קוד שגוי</p>}
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                />
                זכור את המכשיר הזה
              </label>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const selectClass =
    "h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground";

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex justify-end">
        <button onClick={forgetDevice} className="text-xs text-muted-foreground underline">
          נעל מכשיר זה
        </button>
      </div>

      {/* Period Selector */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} dir="rtl">
        <TabsList className="grid grid-cols-4 md:grid-cols-7 w-full">
          <TabsTrigger value="today">היום</TabsTrigger>
          <TabsTrigger value="yesterday">אתמול</TabsTrigger>
          <TabsTrigger value="week">שבוע</TabsTrigger>
          <TabsTrigger value="month">חודש</TabsTrigger>
          <TabsTrigger value="pickMonth">חודש אחר</TabsTrigger>
          <TabsTrigger value="custom">לפי תאריך</TabsTrigger>
          <TabsTrigger value="compare">השוואה</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "custom" && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted-foreground">מתאריך</label>
          <input type="date" value={customFrom} max={isoToday()} onChange={(e) => setCustomFrom(e.target.value)} className={selectClass} />
          <label className="text-sm text-muted-foreground">עד תאריך</label>
          <input type="date" value={customTo} max={isoToday()} onChange={(e) => setCustomTo(e.target.value)} className={selectClass} />
        </div>
      )}

      {mode === "pickMonth" && (
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className={selectClass}>
          {months.map((m) => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </select>
      )}

      {mode === "compare" && (
        <div className="flex flex-wrap items-center gap-3">
          <select value={monthA} onChange={(e) => setMonthA(e.target.value)} className={selectClass}>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <span className="text-muted-foreground">מול</span>
          <select value={monthB} onChange={(e) => setMonthB(e.target.value)} className={selectClass}>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground">טוען נתונים…</p>}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-green-500/20">
              <DollarSign className="text-green-400" size={24} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">הכנסות {ranges[0].label}</p>
              <p className="text-2xl font-black text-foreground">₪{primary.revenue.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/20">
              <ShoppingBag className="text-blue-400" size={24} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">הזמנות</p>
              <p className="text-2xl font-black text-foreground">{primary.count}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/20">
              <TrendingUp className="text-purple-400" size={24} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ממוצע להזמנה</p>
              <p className="text-2xl font-black text-foreground">₪{primary.avg.toFixed(0)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-orange-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-orange-500/20">
              <Clock className="text-orange-400" size={24} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">שעת שיא</p>
              <p className="text-2xl font-black text-foreground">
                {hourlyData.length > 0
                  ? hourlyData.reduce((max, h) => (h.revenue > max.revenue ? h : max), hourlyData[0]).hour
                  : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Burgers & patties */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-amber-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-500/20">
              <Beef className="text-amber-400" size={24} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">המבורגרים שנמכרו · {ranges[0].label}</p>
              <p className="text-2xl font-black text-foreground">{primary.burgers}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-red-500/20">
              <Beef className="text-red-400" size={24} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">סה״כ קציצות · {ranges[0].label}</p>
              <p className="text-2xl font-black text-foreground">{primary.patties}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Net profit */}
      <Card className="border-emerald-500/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign size={18} className="text-emerald-500" /> רווח נקי משוער · {ranges[0].label}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className={`text-3xl font-black ${primary.profit.profit >= 0 ? "text-emerald-500" : "text-destructive"}`}>
            ₪{Math.round(primary.profit.profit).toLocaleString()}
            <span className="text-sm font-medium text-muted-foreground mr-2">
              ({Math.round(primary.profit.margin * 100)}% מההכנסה ללא מע״מ)
            </span>
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ["הכנסות כולל מע״מ", primary.revenue],
              ["מע״מ (18%)", -primary.profit.vat],
              ["עלות חומרי גלם", -primary.profit.foodCost],
              ["הכנסות ללא מע״מ", primary.profit.netRevenue],
              ["אריזות (טייקאווי + סירות בישיבה)", -primary.profit.packaging],
              ["עמלות אשראי", -primary.profit.creditFees],
              ["שכר עובדים", -primary.profit.wages],
              ["רואת חשבון", -primary.profit.accountant],
              ["הכנת תלוש שכר", -primary.profit.payslip],
              ["שמן טיגון", -primary.profit.oil],
              ["שקיות זבל", -primary.profit.trashBags],
              ["מתכלים (סבון, מפיות, רטבים...)", -primary.suppliesCost],
              ["הוצאות קבועות", -(primary.profit.fixed - primary.suppliesCost)],
              ["רווח לפני ביטוח לאומי", primary.profit.beforeTax],
              ["ביטוח לאומי (8%)", -primary.profit.nationalInsurance],
              ["חשמל (לא מדווח — אחרי ביטוח לאומי)", -primary.profit.unreported],
            ].map(([label, v]) => (
              <div key={label as string} className="flex justify-between rounded-lg bg-muted/40 px-3 py-2">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-bold">₪{Math.round(v as number).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between font-bold">
              <span>הוצאות קבועות (₪ לחודש):</span>
              <span>סה״כ ₪{Math.round(monthlyFixed).toLocaleString()}</span>
            </div>
            <div className="space-y-1.5">
              {fixedExpenses.map((e, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-1.5">
                  <input
                    value={e.label}
                    onChange={(ev) => updateExpense(i, { label: ev.target.value })}
                    className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={e.monthly}
                    onChange={(ev) => updateExpense(i, { monthly: Math.max(0, Number(ev.target.value) || 0) })}
                    className="w-24 rounded-md border bg-background px-2 py-1"
                  />
                  <button
                    onClick={() => removeExpense(i)}
                    className="rounded-md px-2 py-1 text-destructive font-bold"
                    aria-label="מחק הוצאה"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={newExpLabel}
                onChange={(e) => setNewExpLabel(e.target.value)}
                placeholder="שם הוצאה חדשה"
                className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={newExpAmount}
                onChange={(e) => setNewExpAmount(e.target.value)}
                placeholder="₪/חודש"
                className="w-24 rounded-md border bg-background px-2 py-1"
              />
              <button onClick={addExpense} className="rounded-md bg-primary px-3 py-1 text-primary-foreground font-bold">
                הוסף
              </button>
            </div>
          </div>
          <SuppliesManager list={supplies} onChange={loadSupplies} />
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-lg bg-muted/40 px-3 py-2">שעות אליה בירן: <b>{primary.shiftHours.toFixed(2)}</b> · ₪{Math.round(primary.shiftPay).toLocaleString()} (41.60 ₪/שעה כולל ביטוח לאומי, כלול בשכר)</span>
            <span className="rounded-lg bg-muted/40 px-3 py-2">ימי עבודה בתקופה: <b>{primary.days}</b></span>
            <span className="rounded-lg bg-muted/40 px-3 py-2">ימי עבודה החודש: <b>{workDays[currentMonthKey]?.size ?? 0}</b></span>
            <span className="rounded-lg bg-muted/40 px-3 py-2">ממוצע ימי עבודה בחודש: <b>{avgWorkDays ? avgWorkDays.toFixed(1) : "—"}</b></span>
          </div>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <label className="text-muted-foreground">
              שכר עובדים · {monthLabel(ranges[0].key.match(/^\d{4}-\d{2}$/) ? ranges[0].key : monthKey(ranges[0].start))} (₪):
            </label>
            <input
              type="number"
              min={0}
              placeholder={String(wages[ranges[0].key.match(/^\d{4}-\d{2}$/) ? ranges[0].key : monthKey(ranges[0].start)] ?? 0)}
              value={wageInput}
              onChange={(e) => setWageInput(e.target.value)}
              className="w-28 rounded-md border bg-background px-2 py-1"
            />
            <button onClick={saveWage} className="rounded-md bg-primary px-3 py-1 text-primary-foreground font-bold">שמור</button>
          </div>
          <p className="text-xs text-muted-foreground">
            שכר, רואת חשבון (350 ₪ לפני מע״מ) והוצאות קבועות מתחלקים לפי ימי העבודה בפועל בחודש (בחודש הנוכחי — לפי ממוצע ימי העבודה). שכירות, עובדים וכו׳ — מתחלק לפי מספר הימים בתקופה. שתייה ומוצרים ללא עלות מוגדרת לא נספרים בעלות. חשמל הוצאה לא מדווחת — מנוכה בסוף, אחרי ביטוח לאומי.
          </p>
        </CardContent>
      </Card>

      {/* Month-to-date vs previous month */}
      {monthSelection && monthToDate && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarRange size={18} className="text-emerald-400" />
              {monthLabel(monthSelection.key)} מול {monthToDate.prevLabel} — {monthToDate.days} הימים הראשונים
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground mb-1">החודש</p>
                <p className="text-xl font-black text-foreground">₪{monthToDate.cur.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground mb-1">{monthToDate.prevLabel}</p>
                <p className="text-xl font-black text-foreground">₪{monthToDate.prev.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground mb-1">שינוי</p>
                {monthToDate.delta === null ? (
                  <p className="text-xl font-black text-muted-foreground">—</p>
                ) : (
                  <p className={`text-xl font-black flex items-center justify-center gap-1 ${monthToDate.delta >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {monthToDate.delta >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                    {monthToDate.delta >= 0 ? "+" : ""}{monthToDate.delta.toFixed(1)}%
                  </p>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">הכנסות לפי יום בחודש</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthDayCompare}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip
                    formatter={(value: number, name: string) => [`₪${value.toLocaleString()}`, name === "current" ? monthLabel(monthSelection.key) : monthToDate.prevLabel]}
                    labelFormatter={(l) => `יום ${l} בחודש`}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, direction: "rtl" }}
                  />
                  <Legend formatter={(v) => (v === "current" ? monthLabel(monthSelection.key) : monthToDate.prevLabel)} />
                  <Bar dataKey="previous" fill="#64748b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="current" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">מרוץ מצטבר לאורך החודש</p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={monthDayCompare}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip
                    formatter={(value: number, name: string) => [`₪${value.toLocaleString()}`, name === "cumCurrent" ? monthLabel(monthSelection.key) : monthToDate.prevLabel]}
                    labelFormatter={(l) => `יום ${l} בחודש`}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, direction: "rtl" }}
                  />
                  <Legend formatter={(v) => (v === "cumCurrent" ? monthLabel(monthSelection.key) : monthToDate.prevLabel)} />
                  <Line type="monotone" dataKey="cumPrevious" stroke="#64748b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="cumCurrent" stroke="#10b981" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Trophy size={14} className="text-yellow-400" /> היום החזק בתקופה</p>
            <p className="text-lg font-black text-foreground">{bestDay ? bestDay.date : "—"}</p>
            <p className="text-xs text-muted-foreground">{bestDay ? `₪${bestDay.revenue.toLocaleString()}` : ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Flame size={14} className="text-orange-400" /> המנה הנמכרת ביותר</p>
            <p className="text-lg font-black text-foreground truncate">{topItems[0]?.name ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{topItems[0] ? `${topItems[0].qty} יחידות` : ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Beef size={14} className="text-amber-400" /> קציצות להזמנה</p>
            <p className="text-lg font-black text-foreground">{primary.count ? (primary.patties / primary.count).toFixed(1) : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><BarChart3 size={14} className="text-blue-400" /> היום הכי חזק בשבוע</p>
            <p className="text-lg font-black text-foreground">
              {weekdayData.some((w) => w.revenue > 0)
                ? weekdayData.reduce((max, w) => (w.revenue > max.revenue ? w : max), weekdayData[0]).name
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top items + weekday */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Flame size={18} className="text-orange-400" />
              10 המנות הנמכרות ביותר
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topItems.length > 0 ? (
              <div className="space-y-2">
                {topItems.map((it, i) => (
                  <div key={it.name} className="flex items-center gap-3">
                    <span className="w-5 text-xs text-muted-foreground">{i + 1}</span>
                    <span className="flex-1 text-sm text-foreground truncate">{it.name}</span>
                    <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${(it.qty / topItems[0].qty) * 100}%` }} />
                    </div>
                    <span className="w-10 text-sm font-bold text-foreground text-left">{it.qty}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">אין נתונים</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarRange size={18} className="text-emerald-400" />
              ביצועים לפי יום בשבוע (ממוצע ליום)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weekdayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  formatter={(value: number) => [`₪${value.toLocaleString()}`, "ממוצע"]}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, direction: "rtl" }}
                />
                <Bar dataKey="avg" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 12 month trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp size={18} className="text-green-400" />
            12 החודשים האחרונים
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trend.some((t) => t.revenue > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  formatter={(value: number, name: string) => (name === "revenue" ? [`₪${value.toLocaleString()}`, "הכנסות"] : [value, "הזמנות"])}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, direction: "rtl" }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="revenue" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-12">אין עדיין נתונים לחודשים קודמים</p>
          )}
        </CardContent>
      </Card>


      {/* Month comparison */}
      {mode === "compare" && secondary && ranges[1] && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">השוואה: {ranges[0].label} מול {ranges[1].label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-center">
              {[
                { label: "הכנסות", a: `₪${primary.revenue.toLocaleString()}`, b: `₪${secondary.revenue.toLocaleString()}` },
                { label: "הזמנות", a: primary.count, b: secondary.count },
                { label: "המבורגרים", a: primary.burgers, b: secondary.burgers },
                { label: "קציצות", a: primary.patties, b: secondary.patties },
              ].map((row) => (
                <div key={row.label} className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground mb-1">{row.label}</p>
                  <p className="text-lg font-bold text-foreground">{row.a}</p>
                  <p className="text-sm text-muted-foreground">{row.b}</p>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={compareData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="metric" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, direction: "rtl" }} />
                <Legend />
                <Bar dataKey={ranges[0].label} fill="#f97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey={ranges[1].label} fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe size={18} className="text-orange-400" />
              הכנסות לפי מקור
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => `₪${value.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{d.name}</p>
                        <p className="text-xs text-muted-foreground">₪{d.value.toLocaleString()} · {d.count} הזמנות</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">אין נתונים לתקופה זו</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign size={18} className="text-green-400" />
              חלוקה לפי תשלום
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paymentPieData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={paymentPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                      {paymentPieData.map((_, i) => <Cell key={i} fill={COLORS[i + 2]} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => `₪${value.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {paymentPieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i + 2] }} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{d.name}</p>
                        <p className="text-xs text-muted-foreground">₪{d.value.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">אין נתונים</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue Over Time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-400" />
            {isHourly ? "הכנסות לפי שעה" : "הכנסות לפי יום"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isHourly ? (
            hourlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    formatter={(value: number, name: string) => (name === "revenue" ? [`₪${value}`, "הכנסות"] : [value, "הזמנות"])}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, direction: "rtl" }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#f97316" fill="#f97316" fillOpacity={0.2} name="revenue" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">אין נתונים לתקופה זו</p>
            )
          ) : (
            dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = { website: "אתר", kiosk: "קיוסק" };
                      return [`₪${value}`, labels[name] || name];
                    }}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, direction: "rtl" }}
                  />
                  <Legend formatter={(v) => (v === "website" ? "אתר" : "קיוסק")} />
                  <Bar dataKey="website" stackId="a" fill="#f97316" name="website" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="kiosk" stackId="a" fill="#3b82f6" name="kiosk" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">אין נתונים לתקופה זו</p>
            )
          )}
        </CardContent>
      </Card>

      {/* Orders count over time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingBag size={18} className="text-purple-400" />
            כמות הזמנות לפי {isHourly ? "שעה" : "יום"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isHourly ? (
            hourlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    formatter={(value: number) => [value, "הזמנות"]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, direction: "rtl" }}
                  />
                  <Bar dataKey="orders" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">אין נתונים</p>
            )
          ) : (
            dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    formatter={(value: number) => [value, "הזמנות"]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, direction: "rtl" }}
                  />
                  <Line type="monotone" dataKey="orders" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">אין נתונים</p>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardView;
