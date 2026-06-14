import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MENU_ITEMS_PRICING, type MenuItemPricing } from "../../supabase/functions/_shared/menu-pricing";

export interface EditableOrderItem {
  id?: string;
  item_id: string | null;
  item_name: string;
  price: number;
  quantity: number;
  toppings?: string[] | null;
  removals?: string[] | null;
  with_meal?: boolean | null;
  meal_side?: string | null;
  meal_drink?: string | null;
  deal_burgers?: any;
  deal_drinks?: any;
}

interface EditOrderModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: number;
  items: EditableOrderItem[];
  onSaved: (result: { requires_reprint: boolean }) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  burger: "המבורגרים",
  meal: "ארוחות",
  side: "תוספות",
  drink: "שתיות",
  deal: "דילים",
};

export default function EditOrderModal({
  open,
  onClose,
  orderId,
  orderNumber,
  items,
  onSaved,
}: EditOrderModalProps) {
  const [working, setWorking] = useState<EditableOrderItem[]>(items);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setWorking(items.map((it) => ({ ...it })));
  }, [open, items]);

  const grouped = useMemo(() => {
    const map: Record<string, MenuItemPricing[]> = {};
    for (const m of MENU_ITEMS_PRICING) {
      (map[m.category] ||= []).push(m);
    }
    return map;
  }, []);

  const updateItem = (idx: number, patch: Partial<EditableOrderItem>) => {
    setWorking((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const handleSwap = (idx: number, newId: string) => {
    const m = MENU_ITEMS_PRICING.find((x) => x.id === newId);
    if (!m) return;
    updateItem(idx, { item_id: m.id, item_name: m.name, price: m.price });
  };

  const removeRow = (idx: number) => {
    setWorking((prev) => prev.filter((_, i) => i !== idx));
  };

  const addRow = () => {
    const first = MENU_ITEMS_PRICING[0];
    setWorking((prev) => [
      ...prev,
      {
        item_id: first.id,
        item_name: first.name,
        price: first.price,
        quantity: 1,
        toppings: [],
        removals: [],
        with_meal: false,
        meal_side: null,
        meal_drink: null,
        deal_burgers: null,
        deal_drinks: null,
      },
    ]);
  };

  const newTotal = working.reduce((s, it) => s + Number(it.price) * Number(it.quantity), 0);

  const handleSave = async () => {
    if (working.length === 0) {
      toast.error("חייב להישאר לפחות פריט אחד");
      return;
    }
    if (working.some((it) => !it.item_id || it.quantity < 1)) {
      toast.error("יש פריט לא תקין");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("edit-order", {
        body: {
          order_id: orderId,
          items: working.map((it) => ({
            item_id: it.item_id,
            item_name: it.item_name,
            price: Number(it.price),
            quantity: Number(it.quantity),
            toppings: it.toppings ?? [],
            removals: it.removals ?? [],
            with_meal: !!it.with_meal,
            meal_side: it.meal_side ?? null,
            meal_drink: it.meal_drink ?? null,
            deal_burgers: it.deal_burgers ?? null,
            deal_drinks: it.deal_drinks ?? null,
          })),
        },
      });
      if (error || (data && (data as any).error)) {
        throw new Error((data as any)?.error ?? error?.message ?? "שגיאה");
      }
      toast.success("ההזמנה עודכנה");
      onSaved({ requires_reprint: !!(data as any)?.requires_reprint });
      onClose();
    } catch (e: any) {
      toast.error(`עדכון נכשל: ${e?.message ?? e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>עריכת הזמנה #{orderNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {working.map((it, idx) => (
            <div
              key={idx}
              className="border rounded-lg p-3 bg-secondary/30 space-y-2"
            >
              <div className="flex items-center gap-2">
                <select
                  className="flex-1 bg-background border rounded-md px-2 py-1.5 text-sm"
                  value={it.item_id ?? ""}
                  onChange={(e) => handleSwap(idx, e.target.value)}
                >
                  {Object.entries(grouped).map(([cat, list]) => (
                    <optgroup key={cat} label={CATEGORY_LABELS[cat] ?? cat}>
                      {list.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} — ₪{m.price}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <Input
                  type="number"
                  min={1}
                  className="w-20"
                  value={it.quantity}
                  onChange={(e) =>
                    updateItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })
                  }
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeRow(idx)}
                  title="הסר"
                >
                  <Trash2 size={16} className="text-destructive" />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                סה״כ פריט: ₪{(Number(it.price) * Number(it.quantity)).toFixed(0)}
                {it.toppings && it.toppings.length > 0 && (
                  <span className="mr-2">· תוספות נשמרות</span>
                )}
                {it.with_meal && <span className="mr-2">· כולל ארוחה</span>}
              </div>
            </div>
          ))}

          <Button variant="outline" onClick={addRow} className="w-full">
            <Plus size={16} className="ml-1" /> הוסף פריט
          </Button>

          <div className="flex justify-between text-lg font-bold border-t pt-2">
            <span>סה״כ חדש:</span>
            <span>₪{newTotal.toFixed(0)}</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            <X size={16} className="ml-1" /> ביטול
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "שומר..." : "שמור שינויים"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
