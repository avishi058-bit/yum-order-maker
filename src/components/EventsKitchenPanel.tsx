import { useEffect, useMemo, useState } from "react";
import { format, isAfter, isSameDay, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Printer, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  computePrep,
  buildPrepHtml,
  tierOf,
  DEFAULT_PREP_SETTINGS,
  type KitchenPrepSettings,
  type EventBookingLike,
} from "@/lib/eventKitchenPrep";
import { isPrinterConnected, printBluetoothEventPrep } from "@/lib/bluetoothPrinter";
import { getPrintMode, printRawBTEventPrep } from "@/lib/rawbtPrinter";
import { printAgentEventPrep } from "@/lib/localPrintAgent";

const supa = supabase as any;

const numField = (v: any): number | null => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const EventsKitchenPanel = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [settings, setSettings] = useState<KitchenPrepSettings>(DEFAULT_PREP_SETTINGS);
  const [edits, setEdits] = useState<Record<string, Partial<EventBookingLike>>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    const [b, s] = await Promise.all([
      supa.from("event_bookings").select("*").eq("status", "signed").order("event_date", { ascending: true }),
      supa.from("event_settings").select("kitchen_prep").eq("id", 1).maybeSingle(),
    ]);
    setBookings(b.data || []);
    if (s.data?.kitchen_prep) setSettings({ ...DEFAULT_PREP_SETTINGS, ...s.data.kitchen_prep });
  };
  useEffect(() => { load(); }, []);

  const upcoming = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return bookings.filter((b) => {
      const d = parseISO(b.event_date);
      return isSameDay(d, today) || isAfter(d, today);
    });
  }, [bookings]);

  const setEdit = (id: string, patch: Partial<EventBookingLike>) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const merged = (b: any): EventBookingLike => ({ ...b, ...(edits[b.id] || {}) });

  const saveEdits = async (b: any) => {
    const patch = edits[b.id];
    if (!patch) return;
    setSaving(b.id);
    const { error } = await supa.from("event_bookings").update(patch).eq("id", b.id);
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    toast.success("נשמר");
    setEdits((prev) => { const { [b.id]: _, ...rest } = prev; return rest; });
    load();
  };

  const printPrep = async (b: any) => {
    const m = merged(b);
    if (edits[b.id]) await saveEdits(b);
    openPrepWindow(m, settings);
  };

  return (
    <div dir="rtl" className="space-y-4">
      {upcoming.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">אין אירועים עתידיים</CardContent></Card>
      )}

      {upcoming.map((b) => {
        const m = merged(b);
        const prep = computePrep(m, settings);
        const isPremium = tierOf(b.package_id) === "premium";
        const dt = parseISO(b.event_date);
        return (
          <Card key={b.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold">{b.customer_name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {format(dt, "EEEE, d בMMMM yyyy", { locale: he })}
                    {b.start_time ? ` • ${b.start_time}-${b.end_time || ""}` : ""}
                  </p>
                  <p className="text-sm">📍 {b.at_venue ? "אצלנו במקום" : b.event_address}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge>{b.package_name}</Badge>
                  <Badge variant="secondary">{b.guests_count} סועדים</Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 border-t pt-3">
                {[
                  { key: "veg_count", label: "צמחוני" },
                  { key: "vegan_count", label: "טבעוני" },
                  { key: "gf_count", label: "ללא גלוטן" },
                  { key: "no_bun_count", label: "בלי לחמנייה" },
                  { key: "kids_count", label: "ילדים" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <Label className="text-xs">{label}</Label>
                    <Input
                      type="number" min={0}
                      value={(m as any)[key] ?? 0}
                      onChange={(e) => setEdit(b.id, { [key]: Number(e.target.value) || 0 } as any)}
                    />
                  </div>
                ))}
              </div>

              {isPremium && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {[
                    { key: "eggs_count", label: "ביצי עין" },
                    { key: "onion_jam_count", label: "ריבת בצל" },
                    { key: "fried_onion_count", label: "בצל מטוגן" },
                    { key: "chili_count", label: "פלפל חריף" },
                    { key: "dessert_count", label: "קינוח" },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <Label className="text-xs">{label}</Label>
                      <Input
                        type="number" min={0}
                        placeholder={String((m as any)[key] ?? "")}
                        value={(m as any)[key] ?? ""}
                        onChange={(e) => setEdit(b.id, { [key]: numField(e.target.value) } as any)}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div>
                <Label className="text-xs">הערות למטבח</Label>
                <Textarea
                  rows={2}
                  placeholder="לדוגמה: 3 ללא בצל, 2 מדיום, ילד בלי ירקות"
                  value={m.kitchen_notes ?? ""}
                  onChange={(e) => setEdit(b.id, { kitchen_notes: e.target.value })}
                />
              </div>

              <div className="rounded-lg bg-muted/40 p-3 text-sm grid grid-cols-2 md:grid-cols-4 gap-y-1 gap-x-3">
                <div>קציצה רגילה: <b>{prep.regularPatties}</b></div>
                {prep.vegPatties > 0 && <div>צמחוני: <b>{prep.vegPatties}</b></div>}
                {prep.veganPatties > 0 && <div>טבעוני: <b>{prep.veganPatties}</b></div>}
                <div>לחמניות: <b>{prep.regularBuns}</b></div>
                {prep.gfBuns > 0 && <div>ללא גלוטן: <b>{prep.gfBuns}</b></div>}
                <div>עגבנייה: <b>{prep.tomatoKg.toFixed(2)} ק״ג</b></div>
                <div>בצל: <b>{prep.onionKg.toFixed(2)} ק״ג</b></div>
                <div>חסה: <b>{prep.lettuceKg.toFixed(2)} ק״ג</b></div>
                <div>חמוצים: <b>{prep.picklesKg.toFixed(2)} ק״ג</b></div>
                {prep.chipsKg > 0 && <div>צ׳יפס: <b>{prep.chipsKg.toFixed(2)} ק״ג</b></div>}
                {prep.potatoesKg > 0 && <div>פוטטוס: <b>{prep.potatoesKg.toFixed(2)} ק״ג</b></div>}
                {prep.onionRingsKg > 0 && <div>טבעות: <b>{prep.onionRingsKg.toFixed(2)} ק״ג</b></div>}
                {prep.waffleKg > 0 && <div>וופל: <b>{prep.waffleKg.toFixed(2)} ק״ג</b></div>}
                {isPremium && <div>ביצים: <b>{prep.eggs}</b></div>}
                {isPremium && <div>קינוח: <b>{prep.desserts}</b></div>}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={() => printPrep(b)}>
                  <Printer className="w-4 h-4 ml-1" /> הדפס בון הכנות
                </Button>
                {edits[b.id] && (
                  <Button variant="outline" disabled={saving === b.id} onClick={() => saveEdits(b)}>
                    <Save className="w-4 h-4 ml-1" /> שמור שינויים
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default EventsKitchenPanel;
