// Group order: the organizer opens a group and shares the link. Everyone picks
// their own meal on the regular menu and pays for it by card. The page shows
// everyone who paid and who did not. When the organizer closes the group and
// every dish is paid, the kitchen gets it as one order (see groupOrders.ts and
// the group_* database functions).
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Check, Copy, Loader2, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  canManage, createGroup, fetchGroup, groupKeys, isMine, lockGroup, payGroupOrder,
  rememberMyName, removeFromGroup, setActiveGroup, type GroupInfo,
} from "@/lib/groupSession";

const RETURN_KEY = "habikta_group_return";
const POLL_MS = 4000;

const shekel = (n: number) => `₪${Number(n).toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;

const Shell = ({ children }: { children: ReactNode }) => (
  <main dir="rtl" className="min-h-screen bg-background text-foreground px-4 py-8">
    <div className="mx-auto w-full max-w-md space-y-5">
      <a href="/" className="block text-center text-sm font-bold text-muted-foreground">המבורגר הבקתה</a>
      {children}
    </div>
  </main>
);

const inputCls = "w-full rounded-xl border border-border bg-secondary px-4 py-3 text-base text-foreground outline-none focus:ring-2 focus:ring-primary/50";
const primaryBtn = "w-full rounded-full bg-primary py-4 text-lg font-black text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-50";

// ─── Open a new group ─────────────────────────────────────────────────────────
const CreateGroup = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [dineIn, setDineIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (name.trim().length < 2) return setError("מה השם שלך?");
    if (dineIn === null) return setError("לשבת אצלנו או לקחת?");
    setBusy(true);
    setError("");
    try {
      const code = await createGroup(name.trim(), dineIn);
      navigate(`/group/${code}`, { replace: true });
    } catch {
      setError("לא הצלחנו לפתוח קבוצה, נסו שוב");
      setBusy(false);
    }
  };

  return (
    <Shell>
      <h1 className="text-3xl font-black">הזמנה קבוצתית</h1>
      <p className="text-muted-foreground leading-relaxed">
        פותחים קבוצה ושולחים קישור לחברים. כל אחד בוחר לעצמו ומשלם על עצמו באשראי.
        כשכולם שילמו, ההזמנה יוצאת למטבח ביחד.
      </p>
      <label className="block space-y-2">
        <span className="text-sm font-bold">השם שלך</span>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="given-name" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        {[{ v: true, l: "לשבת אצלנו" }, { v: false, l: "לקחת" }].map((o) => (
          <button
            key={o.l}
            type="button"
            onClick={() => setDineIn(o.v)}
            className={`rounded-2xl border-2 py-4 font-black ${dineIn === o.v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
          >
            {o.l}
          </button>
        ))}
      </div>
      {error && <p className="text-center text-sm font-bold text-destructive">{error}</p>}
      <button className={primaryBtn} onClick={submit} disabled={busy}>
        {busy ? "פותחים..." : "פותחים קבוצה"}
      </button>
    </Shell>
  );
};

// ─── The group page everyone shares ───────────────────────────────────────────
const GroupView = ({ code }: { code: string }) => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [group, setGroup] = useState<GroupInfo | null | undefined>(undefined);
  const [myName, setMyName] = useState(() => groupKeys(code).myName ?? "");
  const [askName, setAskName] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const manager = canManage(code);
  const link = `${window.location.origin}/group/${code}`;

  const load = useCallback(async () => {
    try { setGroup(await fetchGroup(code)); } catch { /* keep the last view; next poll retries */ }
  }, [code]);

  useEffect(() => {
    void load();
    const t = setInterval(() => { if (document.visibilityState === "visible") void load(); }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // Back from the card page: make sure the payment is picked up right away.
  useEffect(() => {
    const paid = params.get("paid");
    if (!paid) return;
    let stop = false;
    (async () => {
      for (let i = 0; i < 20 && !stop; i++) {
        const { data } = await supabase.functions.invoke("get-payment-status", { body: { orderId: paid } });
        if (data?.paid || data?.cancelled) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!stop) { void load(); setParams({}, { replace: true }); }
    })();
    return () => { stop = true; };
  }, [params, setParams, load]);

  const startOrdering = () => {
    if (myName.trim().length < 2) { setAskName(true); return; }
    rememberMyName(code, myName.trim());
    setActiveGroup({ code, name: myName.trim(), organizer: group!.organizer, dineIn: group!.dine_in });
    navigate("/");
  };

  const share = async () => {
    const text = `מזמינים ביחד מהמבורגר הבקתה. כל אחד בוחר ומשלם על עצמו:\n${link}`;
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch { /* closed - fall back to WhatsApp */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  const run = async (key: string, fn: () => Promise<unknown>, failMsg: string) => {
    setBusy(key);
    setError("");
    try { await fn(); await load(); } catch (e) {
      const m = (e as Error).message;
      setError(m === "group_empty" ? "עוד אף אחד לא הזמין" : failMsg);
    } finally { setBusy(null); }
  };

  const pay = (orderId: string) => run(`pay-${orderId}`, async () => {
    try { sessionStorage.setItem(RETURN_KEY, JSON.stringify({ orderId, code })); } catch { /* ignore */ }
    await payGroupOrder(code, orderId);
  }, "לא הצלחנו לפתוח את דף התשלום");

  const remove = (orderId: string, name: string) => {
    if (!window.confirm(`להוריד את המנה של ${name} מהקבוצה?`)) return;
    void run(`rm-${orderId}`, () => removeFromGroup(code, orderId), "לא הצלחנו להוריד את המנה");
  };

  const close = () => {
    if (!window.confirm("לסגור את הקבוצה? אחרי זה אי אפשר להוסיף מנות. ההזמנה תצא למטבח כשכולם ישלמו.")) return;
    void run("lock", () => lockGroup(code), "לא הצלחנו לסגור את הקבוצה");
  };

  if (group === undefined) {
    return <Shell><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></Shell>;
  }
  if (group === null) {
    return (
      <Shell>
        <h1 className="text-2xl font-black">הקבוצה לא נמצאה</h1>
        <p className="text-muted-foreground">כדאי לבדוק את הקישור מול מי ששלח אותו.</p>
      </Shell>
    );
  }

  const members = group.members;
  const unpaid = members.filter((m) => m.state === "unpaid");
  const paidCount = members.length - unpaid.length;
  const sum = members.reduce((s, m) => s + Number(m.total), 0);
  const open = group.status === "open";

  return (
    <Shell>
      <header className="space-y-1">
        <h1 className="text-3xl font-black">הקבוצה של {group.organizer}</h1>
        <p className="text-muted-foreground">{group.dine_in ? "יושבים אצלנו" : "לוקחים"}</p>
      </header>

      {group.status === "sent" ? (
        <div className="rounded-3xl border-2 border-green-500 bg-green-500/10 p-6 text-center">
          <Check className="mx-auto h-12 w-12 text-green-500" strokeWidth={3} />
          <p className="mt-2 text-2xl font-black text-green-500">ההזמנה נשלחה למטבח</p>
          <p className="mt-1 text-muted-foreground">כולם שילמו. בתאבון!</p>
        </div>
      ) : group.status === "cancelled" ? (
        <div className="rounded-3xl border border-border bg-card p-5 text-center font-bold">הקבוצה בוטלה</div>
      ) : group.status === "locked" ? (
        <div className="rounded-3xl border-2 border-amber-500/70 bg-amber-500/10 p-5 text-center">
          <p className="text-lg font-black">הקבוצה סגורה</p>
          <p className="mt-1 text-sm text-muted-foreground">
            ההזמנה תצא למטבח ברגע ש{unpaid.length === 1 ? `${unpaid[0].name} ישלם/תשלם` : `${unpaid.length} אנשים ישלמו`}.
            אפשר לשלם על מישהו אחר, או להוריד מנה.
          </p>
        </div>
      ) : (
        <p className="rounded-2xl bg-card p-4 text-sm leading-relaxed text-muted-foreground">
          כל אחד בוחר ומשלם על עצמו. כש{manager ? "סוגרים" : `${group.organizer} סוגר/ת`} את הקבוצה וכולם שילמו, ההזמנה יוצאת למטבח ביחד.
        </p>
      )}

      {open && (
        <div className="space-y-3">
          {askName ? (
            <div className="space-y-2">
              <input
                className={inputCls}
                placeholder="השם שלך"
                value={myName}
                onChange={(e) => setMyName(e.target.value)}
                maxLength={40}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && startOrdering()}
              />
              <button className={primaryBtn} onClick={startOrdering}>לבחור מנה</button>
            </div>
          ) : (
            <button className={primaryBtn} onClick={startOrdering}>
              {members.some((m) => isMine(code, m.order_id)) ? "להזמין עוד מנה" : "לבחור מנה"}
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={share} className="flex items-center justify-center gap-2 rounded-full bg-[hsl(142_76%_36%)] py-3 font-bold text-white">
              <Share2 size={18} /> לשלוח לחברים
            </button>
            <button onClick={copy} className="flex items-center justify-center gap-2 rounded-full border border-border bg-card py-3 font-bold">
              {copied ? <Check size={18} /> : <Copy size={18} />} {copied ? "הועתק" : "להעתיק קישור"}
            </button>
          </div>
        </div>
      )}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-black">מי בפנים</h2>
          {members.length > 0 && (
            <span className="text-sm text-muted-foreground">שילמו {paidCount} מתוך {members.length} · {shekel(sum)}</span>
          )}
        </div>
        {members.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-5 text-center text-muted-foreground">
            עוד אף אחד לא הזמין. אפשר להתחיל.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {members.map((m) => {
              const mine = isMine(code, m.order_id);
              const paid = m.state === "paid";
              return (
                <li key={m.order_id} className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black">{m.name}{mine && <span className="font-normal text-muted-foreground"> (את/ה)</span>}</p>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${paid ? "bg-green-500/15 text-green-500" : "bg-amber-500/15 text-amber-500"}`}>
                      {paid ? "שילם" : "עוד לא שילם"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {(m.items ?? []).map((it) => (it.qty > 1 ? `${it.name} ×${it.qty}` : it.name)).join(", ")} · {shekel(m.total)}
                  </p>
                  {!paid && group.status !== "sent" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => pay(m.order_id)}
                        disabled={!!busy}
                        className="rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground disabled:opacity-50"
                      >
                        {busy === `pay-${m.order_id}` ? "פותח תשלום..." : mine ? "לשלם" : `לשלם על ${m.name}`}
                      </button>
                      {(mine || manager) && (
                        <button
                          onClick={() => remove(m.order_id, m.name)}
                          disabled={!!busy}
                          className="rounded-full border border-border px-4 py-2 text-sm font-bold disabled:opacity-50"
                        >
                          להוריד
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {error && <p className="text-center text-sm font-bold text-destructive">{error}</p>}

      {manager && open && members.length > 0 && (
        <button
          onClick={close}
          disabled={!!busy}
          className="w-full rounded-full border-2 border-primary py-4 text-lg font-black text-primary disabled:opacity-50"
        >
          {busy === "lock" ? "סוגרים..." : "כולם הזמינו - לסגור את הקבוצה"}
        </button>
      )}
    </Shell>
  );
};

const GroupOrder = () => {
  const { code } = useParams();
  return code ? <GroupView code={code.toUpperCase()} /> : <CreateGroup />;
};

export default GroupOrder;
