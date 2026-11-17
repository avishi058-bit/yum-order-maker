// Owner: create a payment request (amount + what for), copy or WhatsApp the
// link, and see which requests were paid.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import { dateIL, staffDb, timeIL } from "@/lib/staff";

interface PayReq { token: string; amount: number; description: string | null; created_at: string; name: string | null; paid_at: string | null; status: string }

const linkFor = (token: string) => `https://habikta-burger.com/pay/${token}`;

const PaymentRequests = ({ token }: { token: string }) => {
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [list, setList] = useState<PayReq[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await staffDb.rpc("staff_owner_payreqs", { p_token: token });
    setList((data ?? []) as PayReq[]);
  }, [token]);
  useEffect(() => { if (open) load(); }, [open, load]);

  const copy = async (link: string) => {
    try { await navigator.clipboard.writeText(link); toast.success("הקישור הועתק"); }
    catch { toast.error("לא הועתק - אפשר לסמן ולהעתיק ידנית"); }
  };

  const create = async () => {
    const n = Number(amount.replace(",", "."));
    if (!(n >= 1 && n <= 50000)) { toast.error("סכום בין 1 ל-50,000 ₪"); return; }
    setBusy(true);
    const { data, error } = await staffDb.rpc("staff_owner_payreq_create", { p_token: token, p_amount: n, p_description: desc.trim() || null });
    setBusy(false);
    if (error || !data?.token) { toast.error("לא נוצר, נסו שוב"); return; }
    const link = linkFor(data.token);
    setCreated(link);
    setAmount(""); setDesc("");
    copy(link);
    load();
  };

  const whatsapp = (link: string) => `https://wa.me/?text=${encodeURIComponent(`לתשלום להמבורגר הבקתה: ${link}`)}`;

  return (
    <section className="rounded-[28px] p-4 border border-[#f0e6df]">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between">
        <span className="font-black text-lg">💳 דרישת תשלום</span>
        <span className="text-sm text-[#9a8478]">{open ? "סגירה" : "יצירת קישור"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="sr-only">סכום</span>
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} inputMode="decimal" placeholder="סכום ₪"
                className="w-full h-12 rounded-2xl border-2 border-[#f0e6df] px-4 text-xl font-black" />
            </label>
            <label className="flex-[1.4]">
              <span className="sr-only">על מה (לא חובה)</span>
              <input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={120} placeholder="על מה (לא חובה)"
                className="w-full h-12 rounded-2xl border-2 border-[#f0e6df] px-4" />
            </label>
          </div>
          <button type="button" onClick={create} disabled={busy || !amount}
            className="w-full h-12 rounded-full bg-[#e8502f] text-white font-black disabled:opacity-50 flex items-center justify-center gap-2">
            {busy && <Loader2 className="animate-spin" size={18} />} יצירת קישור והעתקה
          </button>
          {created && (
            <div className="rounded-2xl bg-[#f7f3f0] p-3 space-y-2">
              <p className="text-sm font-bold break-all" dir="ltr">{created}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => copy(created)} className="flex-1 h-10 rounded-full border-2 border-[#e2d4cb] font-bold flex items-center justify-center gap-1"><Copy size={16} /> העתקה</button>
                <a href={whatsapp(created)} target="_blank" rel="noopener noreferrer" className="flex-1 h-10 rounded-full bg-green-600 text-white font-bold flex items-center justify-center">וואטסאפ</a>
              </div>
            </div>
          )}
          {list.length > 0 && (
            <ul className="divide-y divide-[#f3ece7]">
              {list.map((r) => {
                const paid = !!r.paid_at || r.status === "completed";
                return (
                  <li key={r.token} className="py-2.5 flex items-center gap-2">
                    <span className="flex-1">
                      <b>{Number(r.amount).toLocaleString("he-IL")} ₪</b>{r.description ? ` · ${r.description}` : ""}
                      <span className="block text-xs text-[#9a8478]">
                        {paid ? `שולם${r.name ? ` · ${r.name}` : ""} · ${dateIL(r.paid_at ?? r.created_at)} ${timeIL(r.paid_at ?? r.created_at)}` : `נוצר ${dateIL(r.created_at)} ${timeIL(r.created_at)}`}
                      </span>
                    </span>
                    {paid ? <span className="text-green-700 font-black text-sm">✓ שולם</span>
                      : <button type="button" onClick={() => copy(linkFor(r.token))} className="text-sm font-bold text-[#e8502f] underline">העתקה</button>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};

export default PaymentRequests;
