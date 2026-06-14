import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Printer, RefreshCw, ArrowRight, Refrigerator, Check, Ban, RotateCcw } from "lucide-react";
import { toast } from "sonner";

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  sort_order: number;
  fridge_target: number;
  fridge_qty: number;
  menu_item_id: string | null;
};

const DRINK_CATEGORIES = ["בירות", "פחיות", "בקבוקים", "שתיה"];

type Tab = "refill" | "unavailable";

export default function InventoryFridge() {
  const { token } = useParams<{ token: string }>();
  const [authState, setAuthState] = useState<"checking" | "ok" | "bad">("checking");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("refill");

  const call = useCallback(
    async (action: string, payload: Record<string, unknown> = {}) => {
      const { data, error } = await supabase.functions.invoke("inventory-action", {
        body: { token, action, ...payload },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    [token],
  );

  const loadAvailability = useCallback(async () => {
    const { data } = await supabase.from("menu_availability").select("item_id, available");
    const s = new Set<string>();
    for (const a of data ?? []) if (a.available === false) s.add(a.item_id as string);
    setUnavailable(s);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await call("list");
      setItems((data.items ?? []) as InventoryItem[]);
      await loadAvailability();
      setAuthState("ok");
    } catch (e) {
      if (String(e).includes("invalid_token")) setAuthState("bad");
      else toast.error(`שגיאה: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [call, loadAvailability]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (authState !== "ok") return;
    const channel = supabase
      .channel("inventory_fridge_changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "inventory_items" },
        (payload) => {
          const updated = payload.new as InventoryItem;
          setItems((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authState]);

  const isUnavailable = (item: InventoryItem) =>
    !!item.menu_item_id && unavailable.has(item.menu_item_id);

  const drinks = useMemo(
    () =>
      items
        .filter((i) => DRINK_CATEGORIES.includes(i.category))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, "he")),
    [items],
  );

  const availableDrinks = useMemo(() => drinks.filter((d) => !isUnavailable(d)), [drinks, unavailable]);
  const unavailableDrinks = useMemo(() => drinks.filter((d) => isUnavailable(d)), [drinks, unavailable]);

  const grouped = useMemo(() => {
    const map = new Map<string, InventoryItem[]>();
    for (const d of availableDrinks) {
      if (!map.has(d.category)) map.set(d.category, []);
      map.get(d.category)!.push(d);
    }
    return Array.from(map.entries());
  }, [availableDrinks]);

  const refillList = useMemo(
    () =>
      availableDrinks
        .filter((d) => (d.fridge_target ?? 0) > 0)
        .map((d) => ({
          ...d,
          needed: Math.max(0, (d.fridge_target ?? 0) - (d.fridge_qty ?? 0)),
        }))
        .filter((d) => d.needed > 0),
    [availableDrinks],
  );

  const setTarget = async (id: string, target: number) => {
    setSavingId(id);
    try {
      await call("fridge_set_target", { item_id: id, fridge_target: target });
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, fridge_target: target } : i)));
    } catch (e) {
      toast.error(`שגיאה: ${String(e)}`);
    } finally {
      setSavingId(null);
    }
  };

  const setQty = async (id: string, qty: number) => {
    setSavingId(id);
    try {
      await call("fridge_set_qty", { item_id: id, fridge_qty: qty });
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, fridge_qty: qty } : i)));
    } catch (e) {
      toast.error(`שגיאה: ${String(e)}`);
    } finally {
      setSavingId(null);
    }
  };

  const markRefilledItem = async (id: string) => {
    setSavingId(id);
    try {
      await call("fridge_mark_refilled", { item_id: id });
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, fridge_qty: i.fridge_target } : i)),
      );
      toast.success("סומן כמולא");
    } catch (e) {
      toast.error(`שגיאה: ${String(e)}`);
    } finally {
      setSavingId(null);
    }
  };

  const markAllRefilled = async () => {
    const itemsToMark = refillList.map((d) => ({ id: d.id, qty: d.fridge_target }));
    if (!itemsToMark.length) {
      toast.info("המקרר מלא — אין מה לעדכן");
      return;
    }
    try {
      await call("fridge_mark_refilled", { items: itemsToMark });
      setItems((prev) =>
        prev.map((i) => {
          const m = itemsToMark.find((x) => x.id === i.id);
          return m ? { ...i, fridge_qty: m.qty } : i;
        }),
      );
      toast.success("המקרר סומן כמולא");
    } catch (e) {
      toast.error(`שגיאה: ${String(e)}`);
    }
  };

  const toggleAvailability = async (item: InventoryItem, makeAvailable: boolean) => {
    if (!item.menu_item_id) {
      toast.error("פריט זה לא מקושר לתפריט");
      return;
    }
    setSavingId(item.id);
    try {
      await call("set_menu_available", {
        menu_item_id: item.menu_item_id,
        available: makeAvailable,
      });
      setUnavailable((prev) => {
        const next = new Set(prev);
        if (makeAvailable) next.delete(item.menu_item_id!);
        else next.add(item.menu_item_id!);
        return next;
      });
      toast.success(makeAvailable ? "הוחזר כזמין" : "סומן כאזל מהמלאי");
    } catch (e) {
      toast.error(`שגיאה: ${String(e)}`);
    } finally {
      setSavingId(null);
    }
  };

  const printBon = () => {
    const w = window.open("", "_blank", "width=380,height=600");
    if (!w) {
      toast.error("חסום ע״י הדפדפן");
      return;
    }
    const now = new Date();
    const dateStr = now.toLocaleString("he-IL");
    const rows = refillList
      .map(
        (d) =>
          `<tr><td class="qty">${d.needed}</td><td>${escapeHtml(d.name)}</td></tr>`,
      )
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
  .empty { text-align: center; padding: 40px 0; font-size: 16px; }
  .footer { margin-top: 12px; text-align: center; font-size: 11px; color: #444; }
</style>
</head><body>
<h1>🧊 מילוי מקרר</h1>
<div class="sub">${dateStr}</div>
${refillList.length ? `<table>${rows}</table>` : `<div class="empty">המקרר מלא ✅</div>`}
<div class="footer">לאחר המילוי — לחץ "סמן כמולא" באפליקציה</div>
<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300);};</script>
</body></html>`);
    w.document.close();
  };

  if (authState === "checking" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (authState === "bad") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        קישור לא תקין
      </div>
    );
  }

  const totalNeeded = refillList.reduce((s, d) => s + d.needed, 0);

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground pb-24">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto p-3 flex items-center gap-2">
          <Link to={`/inventory/${token}`}>
            <Button size="icon" variant="ghost">
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <Refrigerator className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold">מילוי מקרר</h1>
          </div>
          <Button size="sm" variant="ghost" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-w-3xl mx-auto px-3 pb-2 flex gap-2">
          <button
            onClick={() => setTab("refill")}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold ${
              tab === "refill" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            מילוי
          </button>
          <button
            onClick={() => setTab("unavailable")}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold ${
              tab === "unavailable" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            לא זמינים במלאי {unavailableDrinks.length > 0 && `(${unavailableDrinks.length})`}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-3 space-y-4">
        {tab === "refill" ? (
          <>
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">חסר במקרר כרגע</p>
                  <p className="text-3xl font-black">
                    {totalNeeded} <span className="text-base font-normal text-muted-foreground">יח׳</span>
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button onClick={printBon} className="gap-2" disabled={!refillList.length}>
                    <Printer className="h-4 w-4" />
                    הדפס בון מילוי
                  </Button>
                  <Button onClick={markAllRefilled} variant="outline" className="gap-2" disabled={!refillList.length}>
                    <Check className="h-4 w-4" />
                    סמן הכל כמולא
                  </Button>
                </div>
              </div>
              {refillList.length > 0 ? (
                <div className="rounded-lg bg-muted/40 p-2 text-xs space-y-1">
                  {refillList.map((d) => (
                    <div key={d.id} className="flex justify-between">
                      <span>{d.name}</span>
                      <span className="font-bold">{d.needed} יח׳</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  המקרר מלא ✅
                </p>
              )}
            </div>

            {grouped.map(([cat, list]) => (
              <section key={cat} className="space-y-2">
                <h2 className="text-lg font-bold px-1">{cat}</h2>
                <div className="space-y-2">
                  {list.map((item) => (
                    <FridgeRow
                      key={item.id}
                      item={item}
                      saving={savingId === item.id}
                      onTarget={(v) => setTarget(item.id, v)}
                      onQty={(v) => setQty(item.id, v)}
                      onMarkRefilled={() => markRefilledItem(item.id)}
                      onMarkUnavailable={() => toggleAvailability(item, false)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </>
        ) : (
          <section className="space-y-2">
            <p className="text-sm text-muted-foreground px-1">
              פריטים שסומנו כאזלו מהמלאי. לחץ "החזר לזמין" כדי שיופיעו שוב במילוי המקרר ובאתר.
            </p>
            {unavailableDrinks.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
                אין פריטים שאזלו מהמלאי
              </div>
            ) : (
              unavailableDrinks.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-orange-500/40 bg-orange-500/5 p-3 flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-bold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.category}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => toggleAvailability(item, true)}
                    disabled={savingId === item.id}
                    className="gap-2"
                  >
                    {savingId === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    החזר לזמין
                  </Button>
                </div>
              ))
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function FridgeRow({
  item,
  saving,
  onTarget,
  onQty,
  onMarkRefilled,
  onMarkUnavailable,
}: {
  item: InventoryItem;
  saving: boolean;
  onTarget: (v: number) => void;
  onQty: (v: number) => void;
  onMarkRefilled: () => void;
  onMarkUnavailable: () => void;
}) {
  const [target, setTargetVal] = useState(String(item.fridge_target ?? 0));
  const [qty, setQtyVal] = useState(String(item.fridge_qty ?? 0));

  useEffect(() => setTargetVal(String(item.fridge_target ?? 0)), [item.fridge_target]);
  useEffect(() => setQtyVal(String(item.fridge_qty ?? 0)), [item.fridge_qty]);

  const needed = Math.max(0, (item.fridge_target ?? 0) - (item.fridge_qty ?? 0));
  const tracked = (item.fridge_target ?? 0) > 0;

  return (
    <div
      className={`rounded-lg border p-3 ${
        tracked ? (needed > 0 ? "border-orange-500/50 bg-orange-500/5" : "border-green-500/40 bg-green-500/5") : "border-border bg-card"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-bold">{item.name}</p>
          {tracked && (
            <p className="text-xs text-muted-foreground">
              {needed > 0 ? `חסר: ${needed} יח׳` : "מלא"}
            </p>
          )}
        </div>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>
      <div className="grid grid-cols-3 gap-2 items-end">
        <div>
          <label className="text-[11px] text-muted-foreground">יעד</label>
          <Input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            value={target}
            onChange={(e) => setTargetVal(e.target.value)}
            onBlur={() => {
              const n = Math.max(0, Math.round(Number(target) || 0));
              if (n !== item.fridge_target) onTarget(n);
            }}
            className="h-10 text-center font-bold"
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">במקרר</label>
          <Input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            value={qty}
            onChange={(e) => setQtyVal(e.target.value)}
            onBlur={() => {
              const n = Math.max(0, Math.round(Number(qty) || 0));
              if (n !== item.fridge_qty) onQty(n);
            }}
            className="h-10 text-center font-bold"
            disabled={!tracked}
          />
        </div>
        <Button
          size="sm"
          variant={needed > 0 ? "default" : "outline"}
          onClick={onMarkRefilled}
          disabled={!tracked}
          className="h-10"
        >
          סמן כמולא
        </Button>
      </div>
      <div className="mt-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={onMarkUnavailable}
          disabled={!item.menu_item_id}
          className="h-8 w-full text-orange-600 hover:text-orange-700 hover:bg-orange-500/10 gap-2 text-xs"
          title={item.menu_item_id ? "סמן שאזל מהמלאי" : "פריט לא מקושר לתפריט"}
        >
          <Ban className="h-3.5 w-3.5" />
          אזל מהמלאי
        </Button>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
