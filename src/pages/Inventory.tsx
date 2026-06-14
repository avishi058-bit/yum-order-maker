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
import { Loader2, Plus, Minus, Settings, History, AlertTriangle, Trash2, Trash } from "lucide-react";
import { toast } from "sonner";


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
    const map = new Map<string, InventoryItem[]>();
    for (const item of items) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return Array.from(map.entries());
  }, [items]);

  const handleAdjust = async (item: InventoryItem, delta: number) => {
    try {
      await call("adjust", { item_id: item.id, delta });
    } catch (e) {
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
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 ml-1" /> פריט
        </Button>
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
    </div>
  );
}

// ============ Sub-components ============

function ItemCard({
  item,
  onAdjust,
  onEdit,
  onShowLog,
}: {
  item: InventoryItem;
  onAdjust: (delta: number) => void;
  onEdit: () => void;
  onShowLog: () => void;
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
          {item.low_threshold > 0 && (
            <div className="text-xs text-muted-foreground">
              סף: {formatQty(Number(item.low_threshold), item.unit)}
            </div>
          )}
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
