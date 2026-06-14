import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Minus, Settings, History, AlertTriangle, Trash2, Trash, BarChart3, ShoppingCart, PackageX } from "lucide-react";
import { toast } from "sonner";
import { InventoryStats } from "@/components/InventoryStats";


type Preset = { label: string; amount: number };

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  low_threshold: number;
  presets: Preset[];
  menu_item_id: string | null;
  sort_order: number;
  notes: string | null;
  unit_cost: number;
};

type Movement = {
  id: string;
  inventory_item_id: string;
  delta: number;
  reason: string;
  order_id: string | null;
  note: string | null;
  created_at: string;
};

const REASON_LABEL: Record<string, string> = {
  manual_add: "הוספה ידנית",
  manual_remove: "הורדה ידנית",
  waste: "פחת / נזרק",
  purchase: "קנייה",
  order_ready: "הזמנה הושלמה",
  order_cancelled: "החזרה מביטול",
  init: "התחלה",
};


function formatQty(q: number, unit: string): string {
  if (unit === "g") {
    if (Math.abs(q) >= 1000) return `${(q / 1000).toFixed(2)} ק״ג`;
    return `${Math.round(q)} g`;
  }
  if (unit === "ml") {
    if (Math.abs(q) >= 1000) return `${(q / 1000).toFixed(2)} L`;
    return `${Math.round(q)} מ״ל`;
  }
  return `${q % 1 === 0 ? q : q.toFixed(2)} יח׳`;
}

function formatDelta(d: number, unit: string): string {
  const sign = d > 0 ? "+" : "";
  return `${sign}${formatQty(d, unit)}`;
}

// Extracts the "box size" from presets — the largest positive preset amount
// whose label looks like a box/package (ארגז/חבילה/קרטון). Returns null if none.
function getBoxSize(item: InventoryItem): { size: number; label: string } | null {
  if (!item.presets?.length) return null;
  const boxPresets = item.presets.filter(
    (p) =>
      p.amount > 1 &&
      /ארגז|חבילה|קרטון|ארגיז/.test(p.label),
  );
  if (!boxPresets.length) return null;
  const biggest = boxPresets.reduce((a, b) => (a.amount >= b.amount ? a : b));
  return { size: biggest.amount, label: biggest.label };
}

// Top-level grouping of inventory categories into themed sections.
const CATEGORY_GROUPS: { key: string; label: string; cats: string[] }[] = [
  { key: "drinks", label: "שתיה", cats: ["בירות", "פחיות", "בקבוקים", "שתיה"] },
  { key: "frozen", label: "קפואים", cats: ["בשר", "צ׳יפס", "לחם", "קפואים"] },
];

function groupKeyForCategory(cat: string): string {
  for (const g of CATEGORY_GROUPS) {
    if (g.cats.includes(cat)) return g.key;
  }
  return "other";
}


export default function Inventory() {
  const { token } = useParams<{ token: string }>();
  const [authState, setAuthState] = useState<"checking" | "ok" | "bad">("checking");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [recentMovements, setRecentMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [showMovementsFor, setShowMovementsFor] = useState<InventoryItem | null>(null);
  const [zeroAlertFor, setZeroAlertFor] = useState<InventoryItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [wasteFor, setWasteFor] = useState<InventoryItem | null>(null);
  const [purchaseFor, setPurchaseFor] = useState<InventoryItem | null>(null);
  const [correctionFor, setCorrectionFor] = useState<InventoryItem | null>(null);
  const [showStats, setShowStats] = useState(false);


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

  const refresh = useCallback(async () => {
    try {
      const data = await call("list");
      setItems(data.items ?? []);
      setRecentMovements(data.movements ?? []);
      setAuthState("ok");
    } catch (e) {
      if (String(e).includes("invalid_token")) setAuthState("bad");
      else toast.error(`שגיאה: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime
  useEffect(() => {
    if (authState !== "ok") return;
    const channel = supabase
      .channel("inventory_items_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory_items" },
        (payload) => {
          setItems((prev) => {
            if (payload.eventType === "INSERT") return [...prev, payload.new as InventoryItem];
            if (payload.eventType === "DELETE")
              return prev.filter((i) => i.id !== (payload.old as InventoryItem).id);
            const updated = payload.new as InventoryItem;
            const before = prev.find((i) => i.id === updated.id);
            // detect crossing to 0 from positive
            if (before && Number(before.quantity) > 0 && Number(updated.quantity) <= 0) {
              setZeroAlertFor(updated);
            }
            return prev.map((i) => (i.id === updated.id ? updated : i));
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inventory_movements" },
        (payload) => {
          setRecentMovements((prev) => [payload.new as Movement, ...prev].slice(0, 200));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authState]);

  const grouped = useMemo(() => {
    // Two-level grouping: super-group (drinks/frozen/other) → category → items
    const superMap = new Map<string, Map<string, InventoryItem[]>>();
    for (const item of items) {
      const gk = groupKeyForCategory(item.category);
      const catMap = superMap.get(gk) ?? new Map<string, InventoryItem[]>();
      const arr = catMap.get(item.category) ?? [];
      arr.push(item);
      catMap.set(item.category, arr);
      superMap.set(gk, catMap);
    }
    const orderedKeys = [
      ...CATEGORY_GROUPS.map((g) => g.key),
      "other",
    ];
    return orderedKeys
      .filter((k) => superMap.has(k))
      .map((k) => ({
        key: k,
        label:
          CATEGORY_GROUPS.find((g) => g.key === k)?.label ??
          "אחר",
        categories: Array.from(superMap.get(k)!.entries()),
      }));
  }, [items]);


  const handleAdjust = async (item: InventoryItem, delta: number) => {
    // Optimistic update — instant visual feedback
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, quantity: Number(i.quantity) + delta } : i,
      ),
    );
    try {
      const data = await call("adjust", { item_id: item.id, delta });
      if (data?.item) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? data.item : i)));
      }
    } catch (e) {
      // rollback
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, quantity: Number(i.quantity) - delta } : i,
        ),
      );
      toast.error(`שגיאה: ${String(e)}`);
    }
  };

  const handleZeroConfirm = async (disable: boolean) => {
    const item = zeroAlertFor;
    setZeroAlertFor(null);
    if (!item || !disable || !item.menu_item_id) return;
    try {
      await call("set_menu_available", {
        menu_item_id: item.menu_item_id,
        available: false,
      });
      toast.success(`כובה באתר: ${item.name}`);
    } catch (e) {
      toast.error(`שגיאה: ${String(e)}`);
    }
  };

  if (authState === "checking" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (authState === "bad") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">404</h1>
          <p className="text-muted-foreground">הדף לא קיים.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">ניהול מלאי - הבקתה</h1>
          <p className="text-xs text-muted-foreground">
            {items.length} פריטים · עדכון בלייב
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowStats(true)}>
            <BarChart3 className="h-4 w-4 ml-1" /> דוחות
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 ml-1" /> פריט
          </Button>
        </div>
      </header>

      <main className="p-3 pb-32 max-w-3xl mx-auto space-y-6">
        {grouped.map(([category, list]) => (
          <section key={category}>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-1">
              {category}
            </h2>
            <div className="space-y-2">
              {list.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onAdjust={(d) => handleAdjust(item, d)}
                  onEdit={() => setEditing(item)}
                  onShowLog={() => setShowMovementsFor(item)}
                  onWaste={() => setWasteFor(item)}
                  onPurchase={() => setPurchaseFor(item)}
                  onCorrection={() => setCorrectionFor(item)}
                  onMarkOut={async () => {
                    if (!confirm(`לסמן את "${item.name}" כנגמר עכשיו? יתרת המלאי תירשם כפחת.`)) return;
                    try {
                      await call("mark_out_of_stock", { item_id: item.id });
                      toast.success("סומן כנגמר");
                    } catch (e) {
                      toast.error(`שגיאה: ${String(e)}`);
                    }
                  }}
                />
              ))}

            </div>
          </section>
        ))}
        {items.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            אין פריטים. הוסף פריט ראשון בכפתור למעלה.
          </div>
        )}
      </main>

      {editing && (
        <EditItemDialog
          item={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            await call("update_item", { item_id: editing.id, patch });
            setEditing(null);
          }}
          onDelete={async () => {
            if (!confirm(`למחוק את "${editing.name}"?`)) return;
            await call("delete_item", { item_id: editing.id });
            setEditing(null);
          }}
        />
      )}

      {showMovementsFor && (
        <MovementsDialog
          item={showMovementsFor}
          movements={recentMovements.filter(
            (m) => m.inventory_item_id === showMovementsFor.id,
          )}
          onClose={() => setShowMovementsFor(null)}
        />
      )}

      {showCreate && (
        <CreateItemDialog
          onClose={() => setShowCreate(false)}
          onCreate={async (item) => {
            await call("create_item", { item });
            setShowCreate(false);
          }}
        />
      )}

      <Dialog open={!!zeroAlertFor} onOpenChange={(o) => !o && setZeroAlertFor(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {zeroAlertFor?.name} נגמר!
            </DialogTitle>
            <DialogDescription>
              {zeroAlertFor?.menu_item_id
                ? "לכבות את הפריט הזה באתר ההזמנות?"
                : "אין פריט תפריט מקושר - אם תרצה לכבות, ערוך את הפריט."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => handleZeroConfirm(false)}>
              להשאיר פעיל
            </Button>
            {zeroAlertFor?.menu_item_id && (
              <Button variant="destructive" onClick={() => handleZeroConfirm(true)}>
                כבה באתר
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {wasteFor && (
        <WasteDialog
          item={wasteFor}
          onClose={() => setWasteFor(null)}
          onConfirm={async (amount, note) => {
            try {
              await call("adjust", {
                item_id: wasteFor.id,
                delta: -Math.abs(amount),
                reason: "waste",
                note: note || null,
              });
              toast.success(`נרשם פחת: ${formatQty(amount, wasteFor.unit)}`);
              setWasteFor(null);
            } catch (e) {
              toast.error(`שגיאה: ${String(e)}`);
            }
          }}
        />
      )}

      {purchaseFor && (
        <PurchaseDialog
          item={purchaseFor}
          onClose={() => setPurchaseFor(null)}
          onConfirm={async (qty, unit_cost, note) => {
            try {
              await call("record_purchase", {
                item_id: purchaseFor.id,
                qty,
                unit_cost: unit_cost || undefined,
                note: note || null,
              });
              toast.success(`נרשמה קנייה`);
              setPurchaseFor(null);
            } catch (e) {
              toast.error(`שגיאה: ${String(e)}`);
            }
          }}
        />
      )}
      {correctionFor && (
        <CorrectionDialog
          item={correctionFor}
          onClose={() => setCorrectionFor(null)}
          onConfirm={async (qty, note) => {
            try {
              await call("adjust", {
                item_id: correctionFor.id,
                delta: -qty,
                reason: "manual_remove",
                note: note || "תיקון ידני",
              });
              setItems((prev) =>
                prev.map((i) =>
                  i.id === correctionFor.id
                    ? { ...i, quantity: Number(i.quantity) - qty }
                    : i,
                ),
              );
              toast.success("עודכן");
              setCorrectionFor(null);
            } catch (e) {
              toast.error(`שגיאה: ${String(e)}`);
            }
          }}
        />
      )}


      {showStats && (
        <InventoryStats
          onClose={() => setShowStats(false)}
          loadStats={async (from, to) => {
            const data = await call("stats", { from, to });
            return data;
          }}
        />
      )}
    </div>
  );
}


// ============ Sub-components ============

function ItemCard({
  item,
  onAdjust,
  onEdit,
  onShowLog,
  onWaste,
  onPurchase,
  onCorrection,
  onMarkOut,
}: {
  item: InventoryItem;
  onAdjust: (delta: number) => void;
  onEdit: () => void;
  onShowLog: () => void;
  onWaste: () => void;
  onPurchase: () => void;
  onCorrection: () => void;
  onMarkOut: () => void;
}) {

  const isLow =
    Number(item.low_threshold) > 0 && Number(item.quantity) <= Number(item.low_threshold);
  const isZero = Number(item.quantity) <= 0;

  return (
    <div
      className={`rounded-lg border p-3 ${
        isZero
          ? "border-destructive bg-destructive/5"
          : isLow
          ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{item.name}</div>
          <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
            {item.low_threshold > 0 && (
              <span>סף: {formatQty(Number(item.low_threshold), item.unit)}</span>
            )}
            {Number(item.unit_cost) > 0 && (
              <span>₪{Number(item.unit_cost).toFixed(2)}/יח׳</span>
            )}
          </div>
        </div>
        <div
          className={`text-lg font-bold whitespace-nowrap ${
            isZero ? "text-destructive" : isLow ? "text-yellow-700 dark:text-yellow-400" : ""
          }`}
        >
          {formatQty(Number(item.quantity), item.unit)}
          {isZero && <Badge variant="destructive" className="mr-2">אזל</Badge>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {item.presets.map((p, i) => (
          <Button
            key={i}
            size="sm"
            variant={p.amount >= 0 ? "secondary" : "outline"}
            className="h-8 text-xs"
            onClick={() => onAdjust(p.amount)}
          >
            {p.amount > 0 && <Plus className="h-3 w-3 ml-0.5" />}
            {p.amount < 0 && <Minus className="h-3 w-3 ml-0.5" />}
            {p.label}
          </Button>
        ))}
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-blue-600 hover:bg-blue-600/10"
          onClick={onPurchase}
          title="רשום קנייה / הוסף למלאי"
        >
          <ShoppingCart className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-slate-600 hover:bg-slate-600/10"
          onClick={onCorrection}
          title="הורד כמות (תיקון — לא נספר כפחת)"
        >
          <Minus className="h-4 w-4" />
        </Button>
        {!isZero && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-orange-600 hover:bg-orange-600/10"
            onClick={onMarkOut}
            title="נגמר עכשיו (יירשם כפחת)"
          >
            <PackageX className="h-4 w-4" />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-destructive hover:bg-destructive/10"
          onClick={onWaste}
          title="פחת / נזרק לפח"
        >
          <Trash className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={onShowLog}>
          <History className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={onEdit}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}



function EditItemDialog({
  item,
  onClose,
  onSave,
  onDelete,
}: {
  item: InventoryItem;
  onClose: () => void;
  onSave: (patch: Partial<InventoryItem>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [unit, setUnit] = useState(item.unit);
  const [lowThreshold, setLowThreshold] = useState(String(item.low_threshold));
  const [menuItemId, setMenuItemId] = useState(item.menu_item_id ?? "");
  const [presetsJson, setPresetsJson] = useState(JSON.stringify(item.presets, null, 2));
  const [unitCost, setUnitCost] = useState(String(item.unit_cost ?? 0));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      let presets: Preset[];
      try {
        presets = JSON.parse(presetsJson);
        if (!Array.isArray(presets)) throw new Error("not array");
      } catch {
        toast.error("פורמט אריזות לא תקין");
        setSaving(false);
        return;
      }
      await onSave({
        name,
        category,
        unit,
        low_threshold: Number(lowThreshold) || 0,
        menu_item_id: menuItemId || null,
        presets,
        unit_cost: Number(unitCost) || 0,
      });
    } catch (e) {
      toast.error(`שגיאה: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>עריכת פריט</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>שם</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>קטגוריה</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div>
              <Label>יחידה</Label>
              <select
                className="w-full border rounded h-10 px-2 bg-background"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                <option value="unit">יחידות</option>
                <option value="g">גרמים</option>
                <option value="ml">מ״ל</option>
              </select>
            </div>
          </div>
          <div>
            <Label>מחיר ליחידה (₪) — לחישוב שווי בלאי וקניות</Label>
            <Input
              type="number"
              step="0.01"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <Label>סף התראה (low)</Label>
            <Input
              type="number"
              value={lowThreshold}
              onChange={(e) => setLowThreshold(e.target.value)}
            />
          </div>
          <div>
            <Label>פריט תפריט מקושר (item_id)</Label>
            <Input
              placeholder="למשל drink-cola"
              value={menuItemId}
              onChange={(e) => setMenuItemId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              כשהמלאי יגיע ל-0 - ניתן יהיה לכבות את הפריט באתר ההזמנות.
            </p>
          </div>
          <div>
            <Label>אריזות (JSON)</Label>
            <textarea
              className="w-full border rounded p-2 text-xs font-mono bg-background"
              rows={8}
              value={presetsJson}
              onChange={(e) => setPresetsJson(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              מערך של {`{label, amount}`}. amount שלילי = הורדה.
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="destructive" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4 ml-1" /> מחק
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>
            ביטול
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 ml-1 animate-spin" />}
            שמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateItemDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (item: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("אחר");
  const [unit, setUnit] = useState("unit");
  const [saving, setSaving] = useState(false);

  const defaultPresets: Record<string, Preset[]> = {
    unit: [
      { label: "ארגז 24", amount: 24 },
      { label: "+ יחידה", amount: 1 },
      { label: "- יחידה", amount: -1 },
    ],
    g: [
      { label: "ארגז 10 ק״ג", amount: 10000 },
      { label: "קילו", amount: 1000 },
      { label: "מנה 250g", amount: 250 },
      { label: "- מנה", amount: -250 },
    ],
    ml: [
      { label: "ליטר", amount: 1000 },
      { label: "+ 100 מ״ל", amount: 100 },
      { label: "- 100 מ״ל", amount: -100 },
    ],
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>פריט חדש</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>שם</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>קטגוריה</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div>
              <Label>יחידה</Label>
              <select
                className="w-full border rounded h-10 px-2 bg-background"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                <option value="unit">יחידות</option>
                <option value="g">גרמים</option>
                <option value="ml">מ״ל</option>
              </select>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            ביטול
          </Button>
          <Button
            disabled={saving || !name.trim()}
            onClick={async () => {
              setSaving(true);
              try {
                await onCreate({
                  name: name.trim(),
                  category,
                  unit,
                  presets: defaultPresets[unit] ?? [],
                });
              } catch (e) {
                toast.error(`שגיאה: ${String(e)}`);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving && <Loader2 className="h-4 w-4 ml-1 animate-spin" />}
            הוסף
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovementsDialog({
  item,
  movements,
  onClose,
}: {
  item: InventoryItem;
  movements: Movement[];
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>תנועות - {item.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {movements.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">אין תנועות</p>
          )}
          {movements.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between text-sm border-b border-border py-1.5"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium">{REASON_LABEL[m.reason] ?? m.reason}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {new Date(m.created_at).toLocaleString("he-IL")}
                  {m.note && ` · ${m.note}`}
                </div>
              </div>
              <div
                className={`font-bold whitespace-nowrap ${
                  m.delta > 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatDelta(Number(m.delta), item.unit)}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WasteDialog({
  item,
  onClose,
  onConfirm,
}: {
  item: InventoryItem;
  onClose: () => void;
  onConfirm: (amount: number, note: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const quickAmounts: number[] =
    item.unit === "g"
      ? [100, 250, 500, 1000]
      : item.unit === "ml"
      ? [100, 250, 500, 1000]
      : [1, 2, 5, 10];

  const submit = async () => {
    const n = Number(amount);
    if (!n || n <= 0) {
      toast.error("הכנס כמות חיובית");
      return;
    }
    setSaving(true);
    try {
      await onConfirm(n, note.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash className="h-5 w-5 text-destructive" />
            פחת — {item.name}
          </DialogTitle>
          <DialogDescription>
            מה הכמות שנזרקה / התקלקלה? תרד מהמלאי ותירשם בלוג.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>
              כמות ({item.unit === "g" ? "גרם" : item.unit === "ml" ? 'מ"ל' : "יחידות"})
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quickAmounts.map((q) => (
                <Button
                  key={q}
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => setAmount(String(q))}
                >
                  {formatQty(q, item.unit)}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label>סיבה (לא חובה)</Label>
            <Input
              placeholder="נפל, נשרף, פג תוקף..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            ביטול
          </Button>
          <Button variant="destructive" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 ml-1 animate-spin" />}
            רשום פחת
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseDialog({
  item,
  onClose,
  onConfirm,
}: {
  item: InventoryItem;
  onClose: () => void;
  onConfirm: (qty: number, unit_cost: number, note: string) => Promise<void>;
}) {
  const [qty, setQty] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const qtyNum = Number(qty) || 0;
  const totalNum = Number(totalCost) || 0;
  const unitCost = qtyNum > 0 && totalNum > 0 ? totalNum / qtyNum : 0;

  const quickAmounts: number[] =
    item.unit === "g"
      ? [1000, 5000, 10000]
      : item.unit === "ml"
      ? [1000, 5000, 10000]
      : [12, 24, 48];

  const submit = async () => {
    if (qtyNum <= 0) {
      toast.error("הכנס כמות");
      return;
    }
    setSaving(true);
    try {
      await onConfirm(qtyNum, unitCost, note.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            רישום קנייה — {item.name}
          </DialogTitle>
          <DialogDescription>
            הוספת מלאי + מחיר כדי שנדע לחשב שווי קניות וצריכה.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>
              כמות שנקנתה ({item.unit === "g" ? "גרם" : item.unit === "ml" ? 'מ"ל' : "יחידות"})
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quickAmounts.map((q) => (
                <Button
                  key={q}
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => setQty(String(q))}
                >
                  {formatQty(q, item.unit)}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label>מחיר כולל ששילמת (₪) — לא חובה</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={totalCost}
              onChange={(e) => setTotalCost(e.target.value)}
              placeholder="0"
            />
            {unitCost > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                מחיר ליחידה: ₪{unitCost.toFixed(2)}
              </p>
            )}
          </div>
          <div>
            <Label>הערה</Label>
            <Input
              placeholder="ספק / חשבונית..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            ביטול
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 ml-1 animate-spin" />}
            רשום קנייה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CorrectionDialog({
  item,
  onClose,
  onConfirm,
}: {
  item: InventoryItem;
  onClose: () => void;
  onConfirm: (amount: number, note: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const quickAmounts: number[] =
    item.unit === "g"
      ? [100, 250, 500, 1000]
      : item.unit === "ml"
      ? [100, 250, 500, 1000]
      : [1, 2, 5, 10];

  const submit = async () => {
    const n = Number(amount);
    if (!n || n <= 0) {
      toast.error("הכנס כמות חיובית");
      return;
    }
    setSaving(true);
    try {
      await onConfirm(n, note.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Minus className="h-5 w-5" />
            הורדת כמות — {item.name}
          </DialogTitle>
          <DialogDescription>
            תיקון של המלאי (לא ייספר כפחת ולא ישפיע על הסטטיסטיקות).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>
              כמות להורדה ({item.unit === "g" ? "גרם" : item.unit === "ml" ? 'מ"ל' : "יחידות"})
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quickAmounts.map((q) => (
                <Button
                  key={q}
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => setAmount(String(q))}
                >
                  {formatQty(q, item.unit)}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label>הערה (לא חובה)</Label>
            <Input
              placeholder="תיקון ספירה, טעות..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            ביטול
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 ml-1 animate-spin" />}
            הורד מהמלאי
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
