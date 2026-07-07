import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Plus, Trash2 } from "lucide-react";

interface Zone {
  id: string;
  name: string;
  price: number;
  keywords: string[];
  active: boolean;
}

/** Dialog to manage delivery zones (name, price, keywords) */
export const DeliveryZonesDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newKeywords, setNewKeywords] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("delivery_zones").select("*").order("created_at", { ascending: true });
    setZones((data as Zone[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open]);

  const addZone = async () => {
    if (!newName.trim() || !newPrice) return;
    const kws = newKeywords.split(",").map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.from("delivery_zones").insert({
      name: newName.trim(),
      price: Number(newPrice),
      keywords: kws,
      active: true,
    });
    if (error) { toast.error(error.message); return; }
    setNewName(""); setNewPrice(""); setNewKeywords("");
    load();
  };

  const updateZone = async (id: string, patch: Partial<Zone>) => {
    const { error } = await supabase.from("delivery_zones").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    load();
  };

  const removeZone = async (id: string) => {
    if (!confirm("למחוק אזור?")) return;
    await supabase.from("delivery_zones").delete().eq("id", id);
    load();
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 relative">
        <button onClick={onClose} className="absolute top-3 left-3 p-2 rounded-full hover:bg-secondary">
          <X size={20} />
        </button>
        <h2 className="text-2xl font-black mb-4 text-foreground">🛵 ניהול אזורי משלוח</h2>

        <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-3 mb-4 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="שם אזור" className="bg-secondary border border-border rounded px-3 py-2 text-sm" />
            <input value={newPrice} onChange={(e) => setNewPrice(e.target.value)} type="number" placeholder="מחיר ₪" className="bg-secondary border border-border rounded px-3 py-2 text-sm" />
            <input value={newKeywords} onChange={(e) => setNewKeywords(e.target.value)} placeholder="מילים מזהות (מופרד בפסיק)" className="bg-secondary border border-border rounded px-3 py-2 text-sm" />
          </div>
          <button onClick={addZone} className="w-full bg-primary text-primary-foreground font-bold py-2 rounded-lg flex items-center justify-center gap-2">
            <Plus size={16} /> הוסף אזור
          </button>
        </div>

        {loading ? <p className="text-muted-foreground">טוען…</p> : (
          <div className="space-y-2">
            {zones.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">אין אזורים עדיין. הוסף אזור ראשון למעלה 👆</p>}
            {zones.map((z) => (
              <div key={z.id} className={`rounded-xl border-2 p-3 space-y-2 ${z.active ? "border-border bg-secondary/40" : "border-destructive/30 bg-destructive/5 opacity-60"}`}>
                <div className="flex items-center gap-2">
                  <input value={z.name} onChange={(e) => setZones((p) => p.map((x) => x.id === z.id ? { ...x, name: e.target.value } : x))} onBlur={(e) => updateZone(z.id, { name: e.target.value })} className="flex-1 bg-secondary border border-border rounded px-2 py-1 text-sm font-bold" />
                  <input type="number" value={z.price} onChange={(e) => setZones((p) => p.map((x) => x.id === z.id ? { ...x, price: Number(e.target.value) } : x))} onBlur={(e) => updateZone(z.id, { price: Number(e.target.value) })} className="w-24 bg-secondary border border-border rounded px-2 py-1 text-sm" />
                  <span className="text-xs text-muted-foreground">₪</span>
                  <button onClick={() => updateZone(z.id, { active: !z.active })} className={`text-xs px-2 py-1 rounded ${z.active ? "bg-green-600/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                    {z.active ? "פעיל" : "כבוי"}
                  </button>
                  <button onClick={() => removeZone(z.id)} className="text-destructive hover:bg-destructive/10 p-1 rounded"><Trash2 size={16} /></button>
                </div>
                <input
                  value={z.keywords.join(", ")}
                  onChange={(e) => setZones((p) => p.map((x) => x.id === z.id ? { ...x, keywords: e.target.value.split(",").map((s) => s.trim()) } : x))}
                  onBlur={(e) => updateZone(z.id, { keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  placeholder="מילות זיהוי (למשל: תושיה, ערבי הנחל)"
                  className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs text-muted-foreground"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface DeliveryRequest {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  address: string;
  zone_name: string | null;
  price: number;
  status: string;
  created_at: string;
}

/** Panel showing pending delivery requests at top of kitchen */
export const DeliveryRequestsPanel = () => {
  const [requests, setRequests] = useState<DeliveryRequest[]>([]);
  const [qrFor, setQrFor] = useState<DeliveryRequest | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("delivery_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      setRequests((data as DeliveryRequest[]) ?? []);
    };
    load();
    const channel = supabase
      .channel("kitchen-delivery-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_requests" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!qrFor) { setQrDataUrl(""); return; }
    const url = `https://waze.com/ul?q=${encodeURIComponent(qrFor.address)}&navigate=yes`;
    QRCode.toDataURL(url, { width: 380, margin: 1 }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [qrFor]);

  const approve = async (id: string) => {
    const { error } = await supabase.from("delivery_requests").update({ status: "approved" }).eq("id", id);
    if (error) toast.error(error.message); else toast.success("אושר — הלקוח יקבל עדכון");
  };
  const reject = async (id: string) => {
    const { error } = await supabase.from("delivery_requests").update({ status: "rejected" }).eq("id", id);
    if (error) toast.error(error.message); else toast.success("נדחה");
  };

  if (requests.length === 0) return null;

  return (
    <>
      <div className="mb-4 rounded-2xl border-2 border-orange-500/50 bg-orange-500/5 p-4" dir="rtl">
        <h3 className="text-lg font-black text-orange-400 mb-3">🛵 בקשות משלוח ממתינות ({requests.length})</h3>
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-xl bg-card border border-border p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-bold text-foreground">{r.customer_name || "—"}</span>
                <a href={`tel:${r.customer_phone}`} className="text-primary underline text-xs">{r.customer_phone}</a>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">{r.zone_name}</span>
                <span className="text-xs font-bold text-orange-400">{r.price}₪</span>
              </div>
              <div className="text-sm text-foreground">📍 {r.address}</div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setQrFor(r)} className="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/70 text-foreground font-bold">
                  📱 הצג QR ניווט
                </button>
                <button onClick={() => approve(r.id)} className="text-xs px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold">
                  ✓ אשר משלוח
                </button>
                <button onClick={() => reject(r.id)} className="text-xs px-3 py-1.5 rounded-lg bg-destructive/80 hover:bg-destructive text-destructive-foreground font-bold">
                  ✕ דחה
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {qrFor && (
        <div className="fixed inset-0 z-[90] bg-black/80 flex items-center justify-center p-4" onClick={() => setQrFor(null)} dir="rtl">
          <div className="bg-card rounded-2xl p-6 max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black text-lg mb-2">ניווט לכתובת</h3>
            <p className="text-sm text-muted-foreground mb-4">{qrFor.address}</p>
            {qrDataUrl ? <img src={qrDataUrl} alt="QR ניווט" className="mx-auto rounded-lg" /> : <p className="text-muted-foreground">טוען…</p>}
            <p className="text-xs text-muted-foreground mt-3">סרוק עם המצלמה של הטלפון כדי לפתוח ב-Waze</p>
            <button onClick={() => setQrFor(null)} className="mt-4 bg-primary text-primary-foreground font-bold px-6 py-2 rounded-lg">סגור</button>
          </div>
        </div>
      )}
    </>
  );
};
