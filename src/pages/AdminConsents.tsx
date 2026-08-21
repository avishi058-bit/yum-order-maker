import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Download, Search, ShieldCheck } from "lucide-react";

interface ConsentRow {
  id: string;
  created_at: string;
  consent_type: string;
  action: string;
  method: string | null;
  consent_text_version: string | null;
  consent_text: string | null;
  phone: string | null;
  customer_name: string | null;
  order_id: string | null;
  item_ref: string | null;
  source: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  terms: "תנאי שימוש ופרטיות",
  gluten_free: "הצהרת גלוטן",
  marketing: "דיוור שיווקי",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });

const AdminConsents = () => {
  const [rows, setRows] = useState<ConsentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("consent_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000);
      setRows((data as unknown as ConsentRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (type !== "all" && r.consent_type !== type) return false;
      if (!q) return true;
      return [r.phone, r.customer_name, r.item_ref, r.ip_address, r.order_id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, query, type]);

  const exportCsv = () => {
    const headers = [
      "תאריך ושעה",
      "סוג אישור",
      "פעולה",
      "שם לקוח",
      "טלפון",
      "פריט",
      "מזהה הזמנה",
      "מקור",
      "כתובת IP",
      "דפדפן",
      "גרסת נוסח",
      "נוסח האישור",
    ];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = filtered.map((r) =>
      [
        formatDate(r.created_at),
        TYPE_LABELS[r.consent_type] ?? r.consent_type,
        r.action,
        r.customer_name,
        r.phone,
        r.item_ref,
        r.order_id,
        r.source,
        r.ip_address,
        r.user_agent,
        r.consent_text_version,
        r.consent_text,
      ]
        .map(esc)
        .join(",")
    );
    // BOM so Excel opens Hebrew correctly
    const csv = "\uFEFF" + [headers.map(esc).join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `consents-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-black text-foreground flex items-center gap-2">
            <ShieldCheck className="text-primary" /> אישורי לקוחות (הוכחה משפטית)
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            כל אישור נשמר עם הנוסח המדויק שהוצג ללקוח, תאריך, שעה, כתובת IP ודפדפן.
          </p>
        </header>

        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש לפי שם, טלפון, פריט או IP"
              className="w-full rounded-xl border border-border bg-card py-2.5 pr-9 pl-3 text-sm text-foreground"
            />
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground"
          >
            <option value="all">כל הסוגים</option>
            <option value="terms">תנאי שימוש ופרטיות</option>
            <option value="gluten_free">הצהרת גלוטן</option>
            <option value="marketing">דיוור שיווקי</option>
          </select>
          <button
            onClick={exportCsv}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground flex items-center gap-2 hover:opacity-90 transition"
          >
            <Download size={16} /> ייצוא CSV
          </button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">טוען…</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground">לא נמצאו אישורים.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{filtered.length} רשומות</p>
            {filtered.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-card p-3">
                <button
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  className="w-full text-right"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-bold text-foreground">
                      {TYPE_LABELS[r.consent_type] ?? r.consent_type}
                    </span>
                    <span
                      className={`text-xs rounded-full px-2 py-0.5 ${
                        r.action === "granted"
                          ? "bg-primary/10 text-primary"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {r.action === "granted" ? "אושר" : r.action}
                    </span>
                    <span className="text-muted-foreground">{r.customer_name || "—"}</span>
                    <span className="text-muted-foreground">{r.phone || "—"}</span>
                    {r.item_ref && <span className="text-muted-foreground">🍔 {r.item_ref}</span>}
                    <span className="text-muted-foreground mr-auto">{formatDate(r.created_at)}</span>
                  </div>
                </button>
                {expanded === r.id && (
                  <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground space-y-1">
                    <p>מקור: {r.source || "—"} | שיטה: {r.method || "—"} | גרסה: {r.consent_text_version || "—"}</p>
                    <p>IP: {r.ip_address || "—"}</p>
                    <p className="break-all">דפדפן: {r.user_agent || "—"}</p>
                    <p>מזהה הזמנה: {r.order_id || "—"}</p>
                    {r.consent_text && (
                      <p className="rounded-lg bg-secondary p-2 leading-relaxed text-foreground">
                        {r.consent_text}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminConsents;
