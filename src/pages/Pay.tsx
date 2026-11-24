// A payment request from the owner (/pay/:token): the customer enters a name
// for the receipt and an email, and pays through the site's usual Z-Credit
// checkout (create-payment). Coming back from the payment page (?done=1) it
// waits for the confirmation.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { zcreditSafeText } from "@/lib/zcreditText";

export const PAYREQ_KEY = "habikta_payreq";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Req { amount: number; description: string | null; paid: boolean; failed: boolean }

const ERRORS: Record<string, string> = {
  invalid_name: "צריך שם מלא לקבלה",
  invalid_email: "כתובת המייל לא תקינה",
  already_paid: "הדרישה הזו כבר שולמה",
  not_found: "הקישור לא נמצא",
};

const Pay = () => {
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  const done = params.get("done") === "1";
  const [req, setReq] = useState<Req | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "תשלום - המבורגר הבקתה";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  const load = useCallback(async () => {
    const { data } = await db.rpc("payreq_get", { p_token: token });
    setReq((data as Req) ?? null);
    return data as Req | null;
  }, [token]);

  useEffect(() => {
    let stopped = false;
    let tries = 0;
    const tick = async () => {
      const r = await load();
      if (stopped || !done || !r || r.paid || r.failed || tries++ > 40) return;
      // Ask the payment service directly too, in case its confirmation is late.
      try {
        const saved = JSON.parse(sessionStorage.getItem(PAYREQ_KEY) ?? "{}");
        if (saved.orderId) await supabase.functions.invoke("get-payment-status", { body: { orderId: saved.orderId } });
      } catch { /* keep waiting */ }
      window.setTimeout(tick, 3000);
    };
    tick();
    return () => { stopped = true; };
  }, [done, load]);

  const pay = async () => {
    setError("");
    setBusy(true);
    try {
      const { data, error: e } = await db.rpc("payreq_start", { p_token: token, p_name: name, p_email: email });
      if (e) throw new Error(Object.keys(ERRORS).find((k) => String(e.message).includes(k)) ?? "error");
      try { sessionStorage.setItem(PAYREQ_KEY, JSON.stringify({ orderId: data.order_id, token })); } catch { /* ignore */ }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({
          total: Number(data.total),
          items: [{ name: req?.description ? `תשלום - ${req.description}` : "תשלום להמבורגר הבקתה", price: Number(data.total), quantity: 1 }],
          customerName: zcreditSafeText(data.name),
          customerPhone: "",
          orderId: data.order_id,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.sessionUrl) throw new Error(result.error || "error");
      window.location.href = result.sessionUrl;
    } catch (e) {
      const msg = (e as Error).message;
      setError(ERRORS[msg] ?? (msg && msg !== "error" ? msg : "משהו השתבש, נסו שוב"));
      setBusy(false);
    }
  };

  const shell = (children: ReactNode) => (
    <main dir="rtl" className="min-h-screen bg-white text-[#2b1a12] flex items-center justify-center p-5">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <p className="text-sm font-bold text-[#b0705a]">המבורגר הבקתה</p>
        </div>
        {children}
      </div>
    </main>
  );

  if (req === undefined) return shell(<p className="text-center text-[#9a8478]"><Loader2 className="inline animate-spin" /> טוען…</p>);
  if (req === null) return shell(<p className="text-center text-lg font-bold">הקישור לא נמצא</p>);

  if (req.paid) {
    return shell(
      <section className="rounded-[28px] p-6 bg-[#f0fdf4] border border-[#bbf7d0] text-center space-y-2">
        <CheckCircle2 className="mx-auto text-green-600" size={56} />
        <h1 className="text-2xl font-black">התשלום התקבל, תודה!</h1>
        <p className="text-[#7a5e50]">{Number(req.amount).toLocaleString("he-IL")} ₪{req.description ? ` · ${req.description}` : ""}</p>
        <p className="text-sm text-[#9a8478]">חשבונית מס נשלחת אליך מחברת הסליקה.</p>
      </section>,
    );
  }

  if (done && !req.failed) {
    return shell(
      <section className="rounded-[28px] p-6 bg-[#fff7f0] border border-[#ffe0cc] text-center space-y-2">
        <Loader2 className="mx-auto animate-spin text-[#e8502f]" size={40} />
        <p className="text-lg font-bold">מאשרים את התשלום…</p>
      </section>,
    );
  }

  return shell(
    <>
      <section className="rounded-[28px] p-6 bg-[#fff7f0] border border-[#ffe0cc] text-center">
        <p className="text-sm font-semibold text-[#b0705a]">דרישת תשלום</p>
        <h1 className="text-5xl font-black mt-1">{Number(req.amount).toLocaleString("he-IL")} ₪</h1>
        {req.description && <p className="text-[#7a5e50] mt-1">{req.description}</p>}
      </section>
      {req.failed && <p className="text-center text-red-600 font-bold">התשלום הקודם לא עבר. אפשר לנסות שוב.</p>}
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); pay(); }}>
        <label className="block">
          <span className="text-sm font-bold">שם לקבלה</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} autoComplete="name"
            className="mt-1 w-full h-12 rounded-2xl border-2 border-[#f0e6df] px-4 text-lg focus:border-[#e8502f] outline-none" />
        </label>
        <label className="block">
          <span className="text-sm font-bold">מייל - לשם תישלח חשבונית המס</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} autoComplete="email" dir="ltr"
            className="mt-1 w-full h-12 rounded-2xl border-2 border-[#f0e6df] px-4 text-lg focus:border-[#e8502f] outline-none" />
        </label>
        {error && <p className="text-red-600 font-bold text-center">{error}</p>}
        <button type="submit" disabled={busy}
          className="w-full h-14 rounded-full bg-[#e8502f] text-white text-lg font-black flex items-center justify-center gap-2 disabled:opacity-60">
          {busy ? <Loader2 className="animate-spin" /> : <Lock size={18} />} {busy ? "מעבירים לתשלום…" : "לתשלום מאובטח"}
        </button>
        <p className="text-xs text-center text-[#9a8478]">התשלום מתבצע בעמוד המאובטח של חברת הסליקה (Z-Credit). אפשר אשראי, ביט, Apple Pay ו-Google Pay.</p>
      </form>
    </>,
  );
};

export default Pay;
