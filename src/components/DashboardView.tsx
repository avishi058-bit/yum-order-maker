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
import { TrendingUp, ShoppingBag, DollarSign, Clock, Globe, Beef } from "lucide-react";

interface Order {
  id: string;
  order_number: number;
  total: number;
  status: string;
  created_at: string;
  payment_method: string | null;
  paid_at?: string | null;
  order_source: string;
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
      case "month":
        return [{ key: "month", label: "30 ימים אחרונים", start: new Date(todayStart.getTime() - 29 * DAY), end: tomorrow }];
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

  const fetchStart = useMemo(
    () => new Date(Math.min(...ranges.map((r) => r.start.getTime()))),
    [ranges],
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
        .select("id, order_number, total, status, created_at, payment_method, paid_at, order_source, customer_name, customer_phone")
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
          .select("order_id, item_id, item_name, quantity, toppings")
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
    const { burgers, patties } = countBurgers(items.filter((i) => ids.has(i.order_id)));
    const revenue = list.reduce((s, o) => s + o.total, 0);
    return {
      orders: list,
      revenue,
      count: list.length,
      avg: list.length ? revenue / list.length : 0,
      burgers,
      patties,
    };
  };

  const primary = useMemo(
    () => statsFor(ranges[0].start, ranges[0].end),
    [orders, items, ranges],
  );
  const secondary = useMemo(
    () => (ranges[1] ? statsFor(ranges[1].start, ranges[1].end) : null),
    [orders, items, ranges],
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

  if (!unlocked) {
    return (
      <div dir="rtl" className="p-6 space-y-6 max-w-md mx-auto">
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">מזומן היום</p>
              <p className="text-2xl font-black text-foreground">₪{openTotals.cash.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{openTotals.cashCount} הזמנות</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">פייבוקס היום</p>
              <p className="text-2xl font-black text-foreground">₪{openTotals.paybox.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{openTotals.payboxCount} הזמנות</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">נתוני הכנסות מלאים</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">להצגת כל הנתונים יש להזין קוד</p>
            <input
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
              className="w-full h-12 rounded-lg border border-border bg-background px-4 text-center text-2xl tracking-[0.4em] text-foreground"
            />
            {codeError && <p className="text-sm text-destructive">קוד שגוי</p>}
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
              />
              זכור את המכשיר הזה ואל תבקש קוד בפעם הבאה
            </label>
            <button onClick={tryUnlock} className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-bold">
              הצג נתונים
            </button>
          </CardContent>
        </Card>
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
