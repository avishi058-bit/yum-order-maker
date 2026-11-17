// Waste this month: totals per product, and the latest reports with who and why.
import { useEffect, useMemo, useState } from "react";
import { dateIL, staffDb, timeIL } from "@/lib/staff";

interface Log { id: string; item_name: string; quantity: number; reason: string; staff_id: string | null; created_at: string }

const WasteReport = ({ names }: { names: Record<string, string> }) => {
  const [logs, setLogs] = useState<Log[]>([]);
  useEffect(() => {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 3 * 3600_000).toISOString();
    staffDb.from("staff_waste_logs").select("id, item_name, quantity, reason, staff_id, created_at")
      .gte("created_at", from).order("created_at", { ascending: false }).limit(300)
      .then(({ data }: { data: Log[] | null }) => setLogs(data ?? []));
  }, []);
  const totals = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of logs) m.set(l.item_name, (m.get(l.item_name) ?? 0) + l.quantity);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [logs]);

  return (
    <section className="rounded-2xl bg-card border border-border p-4 space-y-3">
      <h2 className="text-lg font-black">פחת החודש</h2>
      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">עוד לא דווח פחת החודש.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {totals.map(([name, n]) => (
              <span key={name} className="rounded-full bg-muted px-3 py-1.5 text-sm"><b>{n}</b> {name}</span>
            ))}
          </div>
          <details>
            <summary className="font-bold cursor-pointer text-sm">כל הדיווחים ({logs.length})</summary>
            <ul className="divide-y divide-border text-sm mt-1">
              {logs.map((l) => (
                <li key={l.id} className="py-2 flex justify-between gap-2">
                  <span><b>{l.quantity > 1 ? `${l.quantity} × ` : ""}{l.item_name}</b> · {l.reason}</span>
                  <span className="text-muted-foreground shrink-0">{l.staff_id ? names[l.staff_id] ?? "" : ""} · {dateIL(l.created_at)} {timeIL(l.created_at)}</span>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
};

export default WasteReport;
