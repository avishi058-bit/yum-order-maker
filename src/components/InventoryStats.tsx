import { useCallback, useEffect, useMemo, useState } from "react";
// xlsx is dynamically imported inside exportExcel() to keep it out of the initial bundle
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, Download, X, TrendingUp, TrendingDown, Package, ShoppingCart, Trash2, DollarSign } from "lucide-react";
import { toast } from "sonner";

type PerItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_qty: number;
  unit_cost: number;
  current_value: number;
  purchased_qty: number;
  purchased_value: number;
  manual_added_qty: number;
  manual_added_value: number;
  waste_qty: number;
  waste_value: number;
  consumed_qty: number;
  consumed_value: number;
  manual_removed_qty: number;
};

type TopItem = { id: string; name: string; qty: number; revenue: number };

type StatsResp = {
  from: string;
  to: string;
  per_item: PerItem[];
  totals: {
    purchases_value: number;
    manual_added_value: number;
    waste_value: number;
    consumed_value: number;
    current_value: number;
    revenue: number;
    orders_count: number;
  };
  top_items: TopItem[];
};

type Range = "this_month" | "last_month" | "last_7" | "last_30" | "custom";

function rangeToDates(r: Range, customFrom?: string, customTo?: string): { from: string; to: string } {
  const now = new Date();
  if (r === "this_month") {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
    };
  }
  if (r === "last_month") {
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
      to: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    };
  }
  if (r === "last_7") {
    const t = new Date(); t.setHours(23, 59, 59, 999);
    const f = new Date(); f.setDate(f.getDate() - 6); f.setHours(0, 0, 0, 0);
    return { from: f.toISOString(), to: t.toISOString() };
  }
  if (r === "last_30") {
    const t = new Date(); t.setHours(23, 59, 59, 999);
    const f = new Date(); f.setDate(f.getDate() - 29); f.setHours(0, 0, 0, 0);
    return { from: f.toISOString(), to: t.toISOString() };
  }
  return {
    from: customFrom ? new Date(customFrom).toISOString() : now.toISOString(),
    to: customTo ? new Date(customTo + "T23:59:59").toISOString() : now.toISOString(),
  };
}

function fmtMoney(n: number): string {
  return `₪${Math.round(n).toLocaleString("he-IL")}`;
}
function fmtQty(q: number, unit: string): string {
  if (unit === "g") return Math.abs(q) >= 1000 ? `${(q / 1000).toFixed(2)} ק״ג` : `${Math.round(q)} g`;
  if (unit === "ml") return Math.abs(q) >= 1000 ? `${(q / 1000).toFixed(2)} L` : `${Math.round(q)} מ״ל`;
  return `${q % 1 === 0 ? q : q.toFixed(2)}`;
}

export function InventoryStats({
  onClose,
  loadStats,
}: {
  onClose: () => void;
  loadStats: (from: string, to: string) => Promise<StatsResp>;
}) {
  const [range, setRange] = useState<Range>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsResp | null>(null);

  const dates = useMemo(() => rangeToDates(range, customFrom, customTo), [range, customFrom, customTo]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await loadStats(dates.from, dates.to);
      setStats(s);
    } catch (e) {
      toast.error(`שגיאה בטעינת סטטיסטיקות: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [dates.from, dates.to, loadStats]);

  useEffect(() => { refresh(); }, [refresh]);

  const rangeLabel = useMemo(() => {
    const f = new Date(dates.from).toLocaleDateString("he-IL");
    const t = new Date(dates.to).toLocaleDateString("he-IL");
    return `${f} - ${t}`;
  }, [dates]);

  const exportExcel = () => {
    if (!stats) return;
    const wb = XLSX.utils.book_new();

    const summary = [
      ["דוח מלאי - הבקתה"],
      ["תקופה", rangeLabel],
      [],
      ["הכנסות", stats.totals.revenue],
      ["מספר הזמנות", stats.totals.orders_count],
      ["שווי מלאי נוכחי", stats.totals.current_value],
      ["סך קניות בתקופה", stats.totals.purchases_value],
      ["סך פחת (בלאי) בתקופה", stats.totals.waste_value],
      ["סך צריכה דרך הזמנות", stats.totals.consumed_value],
      ["הוספות ידניות (ללא מחיר)", stats.totals.manual_added_value],
      [],
      ["רווח גולמי משוער", stats.totals.revenue - stats.totals.consumed_value - stats.totals.waste_value],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "סיכום");

    const perItemRows = [
      ["פריט", "קטגוריה", "יחידה", "מלאי נוכחי", "מחיר ליחידה", "שווי מלאי",
        "נקנה (כמות)", "נקנה (₪)", "פחת (כמות)", "פחת (₪)",
        "צריכה הזמנות (כמות)", "צריכה (₪)", "הוסף ידנית", "הוסר ידנית"],
      ...stats.per_item.map((p) => [
        p.name, p.category, p.unit,
        Number(p.current_qty), Number(p.unit_cost), Number(p.current_value),
        Number(p.purchased_qty), Number(p.purchased_value),
        Number(p.waste_qty), Number(p.waste_value),
        Number(p.consumed_qty), Number(p.consumed_value),
        Number(p.manual_added_qty), Number(p.manual_removed_qty),
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(perItemRows), "פריטי מלאי");

    const topRows = [
      ["מוצר תפריט", "מזהה", "כמות שנמכרה", "הכנסה (₪)"],
      ...stats.top_items.map((t) => [t.name, t.id, Number(t.qty), Number(t.revenue)]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(topRows), "מוצרים נמכרים");

    const fileName = `inventory-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success("הקובץ הורד");
  };

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto" dir="rtl">
      <header className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between z-10">
        <div>
          <h1 className="text-xl font-bold">סטטיסטיקות מלאי</h1>
          <p className="text-xs text-muted-foreground">{rangeLabel}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportExcel} disabled={!stats}>
            <Download className="h-4 w-4 ml-1" /> אקסל
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="p-4 max-w-5xl mx-auto space-y-4 pb-24">
        <Card className="p-3">
          <div className="flex flex-wrap gap-2 mb-2">
            {([
              ["this_month", "החודש"],
              ["last_month", "חודש שעבר"],
              ["last_7", "7 ימים"],
              ["last_30", "30 ימים"],
              ["custom", "מותאם"],
            ] as Array<[Range, string]>).map(([k, l]) => (
              <Button
                key={k}
                size="sm"
                variant={range === k ? "default" : "outline"}
                onClick={() => setRange(k)}
              >
                {l}
              </Button>
            ))}
          </div>
          {range === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">מתאריך</Label>
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">עד תאריך</Label>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </div>
          )}
        </Card>

        {loading || !stats ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={<DollarSign className="h-4 w-4" />} label="הכנסות" value={fmtMoney(stats.totals.revenue)} sub={`${stats.totals.orders_count} הזמנות`} accent="text-green-600" />
              <StatCard icon={<ShoppingCart className="h-4 w-4" />} label="קניות" value={fmtMoney(stats.totals.purchases_value)} accent="text-blue-600" />
              <StatCard icon={<Trash2 className="h-4 w-4" />} label="פחת / בלאי" value={fmtMoney(stats.totals.waste_value)} accent="text-destructive" />
              <StatCard icon={<Package className="h-4 w-4" />} label="שווי מלאי כעת" value={fmtMoney(stats.totals.current_value)} />
              <StatCard icon={<TrendingDown className="h-4 w-4" />} label="עלות מכר (הזמנות)" value={fmtMoney(stats.totals.consumed_value)} />
              <StatCard
                icon={<TrendingUp className="h-4 w-4" />}
                label="רווח גולמי משוער"
                value={fmtMoney(stats.totals.revenue - stats.totals.consumed_value - stats.totals.waste_value)}
                sub="הכנסות פחות עלות+בלאי"
                accent="text-primary"
              />
            </div>

            <Card className="p-3">
              <h2 className="font-semibold mb-2">לפי פריט מלאי</h2>
              <div className="overflow-x-auto -mx-3">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="border-b">
                      <th className="text-right p-2">פריט</th>
                      <th className="text-right p-2">מלאי</th>
                      <th className="text-right p-2">נקנה</th>
                      <th className="text-right p-2">צריכה</th>
                      <th className="text-right p-2 text-destructive">פחת</th>
                      <th className="text-right p-2">שווי בלאי</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.per_item.map((p) => (
                      <tr key={p.id} className="border-b">
                        <td className="p-2 font-medium">{p.name}</td>
                        <td className="p-2">{fmtQty(p.current_qty, p.unit)}</td>
                        <td className="p-2">{fmtQty(p.purchased_qty, p.unit)}</td>
                        <td className="p-2">{fmtQty(p.consumed_qty, p.unit)}</td>
                        <td className="p-2 text-destructive">{fmtQty(p.waste_qty, p.unit)}</td>
                        <td className="p-2">{p.waste_value ? fmtMoney(p.waste_value) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-3">
              <h2 className="font-semibold mb-2">מוצרים שנמכרו הכי הרבה</h2>
              {stats.top_items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">אין מכירות בתקופה</p>
              ) : (
                <div className="space-y-1">
                  {stats.top_items.slice(0, 10).map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-sm border-b py-1.5">
                      <div className="font-medium truncate">{t.name}</div>
                      <div className="flex gap-3 text-xs">
                        <span className="text-muted-foreground">{t.qty} יח׳</span>
                        <span className="font-bold text-primary">{fmtMoney(t.revenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <p className="text-xs text-muted-foreground text-center">
              שווי הקניות מחושב מתוך מחיר היחידה שנשמר לכל פריט. ערוך פריט כדי לעדכן מחיר.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon} {label}
      </div>
      <div className={`text-lg font-bold ${accent ?? ""}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}
