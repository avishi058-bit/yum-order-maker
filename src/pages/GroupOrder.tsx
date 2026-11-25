// Group order: the organizer opens a group and shares the link. Everyone picks
// their own meal on the regular menu and pays for it by card. The page shows
// everyone who paid and who did not. When the organizer closes the group and
// every dish is paid, the kitchen gets it as one order (see groupOrders.ts and
// the group_* database functions). Styled like the home page hero.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, CheckCircle2, Clock, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantStatus } from "@/hooks/useRestaurantStatus";
import { useGroupPresence, type GroupPresence } from "@/hooks/useGroupPresence";
import { isPhoneVerified, sendPhoneCode, verifyPhoneCode } from "@/lib/sms";
import { validateIsraeliPhone } from "@/lib/utils";
import { SignInSheet, SheetTitle, SheetSub, CodeBoxes, ResendLine, SheetFine } from "@/components/auth/SignInSheet";
import heroBurger from "@/assets/hero-burger.webp";
import logo from "@/assets/logo.webp";
import {
  canManage, createGroup, fetchGroup, groupKeys, isMine, lockGroup, payGroupOrder,
  rememberMyName, removeFromGroup, sendWithoutUnpaid, setActiveGroup, takeManageToken, type GroupInfo,
} from "@/lib/groupSession";
import UnpaidManager from "@/components/group/UnpaidManager";

const RETURN_KEY = "habikta_group_return";
const POLL_MS = 4000;

const shekel = (n: number) => `₪${Number(n).toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;

const bigBtn = "w-full h-16 rounded-[2rem] font-black text-xl transition-all active:scale-[0.98] disabled:opacity-50";
const primaryBtn = `${bigBtn} bg-primary text-primary-foreground shadow-2xl hover:brightness-110`;
const inputCls = "w-full bg-secondary border border-border rounded-lg px-4 py-3 text-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50";

// Same top as the home page: burger photo fading into the dark background, logo, big title.
const Shell = ({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) => (
  <main dir="rtl" className="min-h-screen bg-background text-foreground">
    <header className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img src={heroBurger} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-background/30" />
      </div>
      <div className="relative z-10 px-4 pb-6 pt-8 text-center">
        <a href="/" aria-label="לעמוד הראשי" className="mx-auto mb-3 block h-20 w-20">
          <img src={logo} alt="הבקתה - לוגו" className="h-full w-full object-contain drop-shadow-2xl" />
        </a>
        <h1 className="text-4xl font-black tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-lg font-bold text-primary">{subtitle}</p>}
      </div>
    </header>
    <div className="mx-auto w-full max-w-md space-y-5 px-4 pb-12">{children}</div>
  </main>
);

// WhatsApp-style "typing" dots.
const TypingDots = () => (
  <span className="inline-flex items-end gap-0.5 align-middle" aria-hidden>
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        className="h-1.5 w-1.5 rounded-full bg-current"
        animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
      />
    ))}
  </span>
);
const activityText = (p: GroupPresence) => (p.state === "paying" ? "בתשלום" : "בונה הזמנה");

// Group orders go straight to the kitchen, so only while the site takes orders.
const ClosedNote = () => (
  <div className="rounded-2xl border-2 border-destructive/40 bg-destructive/10 p-4 text-center font-bold text-destructive">
    המטבח סגור כרגע. הזמנה קבוצתית אפשר לעשות רק כשאנחנו פתוחים.
  </div>
);

// The name of a customer signed in on this device, if any.
const savedName = (): string => {
  try { return JSON.parse(localStorage.getItem("habakta_customer") || "null")?.name ?? ""; } catch { return ""; }
};

const savedPhone = (): string => {
  try { return JSON.parse(localStorage.getItem("habakta_customer") || "null")?.phone ?? ""; } catch { return ""; }
};

// The home page's לשבת / לקחת switch.
const DineSwitch = ({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) => (
  <div className="relative flex w-full select-none rounded-2xl bg-muted p-1.5 shadow-2xl">
    {[{ v: true, l: "לשבת" }, { v: false, l: "לקחת" }].map((o) => (
      <button
        key={o.l}
        type="button"
        onClick={() => onChange(o.v)}
        className={`relative z-10 flex-1 py-4 text-center text-2xl font-black transition-colors ${value === o.v ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
      >
        {value === o.v && (
          <motion.div
            layoutId="group-dine-active"
            className="absolute inset-1.5 -z-10 rounded-xl border border-border/50 bg-card shadow-sm"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}
        {o.l}
      </button>
    ))}
  </div>
);

// A tap that needs a second tap within a few seconds (no browser pop-ups).
const useConfirmTap = () => {
  const [armed, setArmed] = useState<string | null>(null);
  const timer = useRef<number>();
  const tap = (key: string, action: () => void) => {
    if (armed === key) { setArmed(null); window.clearTimeout(timer.current); action(); return; }
    setArmed(key);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setArmed(null), 4000);
  };
  return { armed, tap };
};

// ─── Open a new group ─────────────────────────────────────────────────────────
const CreateGroup = () => {
  const navigate = useNavigate();
  const [name, setName] = useState(savedName);
  const [phone, setPhone] = useState(savedPhone);
  // Organizer only: one SMS code (skipped if this phone was verified on this device).
  const [codeSentAt, setCodeSentAt] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [dineIn, setDineIn] = useState<boolean | null>(null);
  const { status: shop, resolved } = useRestaurantStatus();
  const closed = resolved && !shop.website_open;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const open = async () => {
    try {
      const groupCode = await createGroup(name.trim(), dineIn!, phone);
      navigate(`/group/${groupCode}`, { replace: true });
    } catch (e) {
      if ((e as Error).message === "phone_not_verified") { await sendCode(); return; }
      setError("לא הצלחנו לפתוח קבוצה, נסו שוב");
      setBusy(false);
    }
  };

  const sendCode = async () => {
    setBusy(true);
    setCodeError("");
    const r = await sendPhoneCode(phone);
    if (r.result === "sent") { setCode(""); setCodeSentAt(Date.now()); return; }
    setBusy(false);
    setCodeSentAt(null);
    setError(r.result === "error" ? (r.error || "מספר הטלפון לא תקין") : "לא הצלחנו לשלוח קוד כרגע, נסו שוב בעוד דקה");
  };

  const checkCode = async (v: string) => {
    const r = await verifyPhoneCode(phone, v);
    if (!r.ok) { setCodeError(r.error || "קוד שגוי"); setCode(""); return; }
    setCodeSentAt(null);
    await open();
  };

  const submit = async () => {
    if (name.trim().length < 2) return setError("מה השם שלך?");
    if (!validateIsraeliPhone(phone).valid) return setError("מה מספר הטלפון שלך?");
    if (dineIn === null) return setError("לשבת או לקחת?");
    setBusy(true);
    setError("");
    if (isPhoneVerified(phone)) await open();
    else await sendCode();
  };

  return (
    <Shell title="הזמנה קבוצתית" subtitle="כל אחד בוחר, כל אחד משלם">
      <ol className="space-y-3 rounded-2xl border border-border bg-card p-4">
        {[
          ["👥", "פותחים קבוצה ושולחים קישור לחברים"],
          ["🍔", "כל אחד בוחר לעצמו ומשלם באשראי"],
          ["🔥", "כשכולם שילמו - ההזמנה יוצאת למטבח ביחד"],
        ].map(([icon, text]) => (
          <li key={text} className="flex items-center gap-3 font-bold">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xl">{icon}</span>
            {text}
          </li>
        ))}
      </ol>

      <label className="block space-y-2">
        <span className="font-bold">השם שלך</span>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="given-name" />
      </label>

      <label className="block space-y-2">
        <span className="font-bold">הטלפון שלך</span>
        <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" dir="ltr" />
        <span className="block text-sm text-muted-foreground">נשלח לך SMS כשההזמנה של כל הקבוצה מוכנה</span>
      </label>

      <DineSwitch value={dineIn} onChange={setDineIn} />

      {codeSentAt && (
        <SignInSheet labelledBy="group-code-title" onClose={() => { setCodeSentAt(null); setBusy(false); }}>
          <SheetTitle id="group-code-title">קוד אימות</SheetTitle>
          <SheetSub>שלחנו קוד ב-SMS ל-{phone}</SheetSub>
          <CodeBoxes value={code} onChange={(v) => { setCode(v); setCodeError(""); }} onComplete={(v) => void checkCode(v)} />
          {codeError && <p className="mt-3 text-center text-sm font-bold text-red-600">{codeError}</p>}
          <ResendLine sentAt={codeSentAt} onResend={() => void sendCode()} />
          <SheetFine>הטלפון ישמש רק כדי לשלוח לך SMS כשההזמנה מוכנה. <a href="/privacy" className="underline">מדיניות הפרטיות</a></SheetFine>
        </SignInSheet>
      )}

      {error && <p className="text-center font-bold text-destructive">{error}</p>}
      {closed && <ClosedNote />}
      <button className={primaryBtn} onClick={submit} disabled={busy || closed}>
        {busy ? "פותחים..." : "פותחים קבוצה"}
      </button>
    </Shell>
  );
};

// ─── The group page everyone shares ───────────────────────────────────────────
const GroupView = ({ code }: { code: string }) => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // Arrived from the organizer's "stuck group" SMS link: this device becomes the organizer's.
  const [fromSms] = useState(() => takeManageToken(code));
  const [group, setGroup] = useState<GroupInfo | null | undefined>(undefined);
  const [myName, setMyName] = useState(() => groupKeys(code).myName ?? savedName());
  const [askName, setAskName] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const { armed, tap } = useConfirmTap();
  const manager = canManage(code);
  const { status: shop, resolved } = useRestaurantStatus();
  const closed = resolved && !shop.website_open;
  const presence = useGroupPresence(code);
  const link = `${window.location.origin}/group/${code}`;

  // What changed since the last look: joined, paid, removed. Shown to everyone.
  const seen = useRef<Map<string, { name: string; state: string; count: number }> | null>(null);
  const announce = useCallback((g: GroupInfo) => {
    const prev = seen.current;
    const next = new Map(g.members.map((m) => [m.order_id, { name: m.name, state: m.state, count: (m.items ?? []).reduce((s, it) => s + it.qty, 0) }]));
    seen.current = next;
    if (!prev) return;
    for (const [id, m] of next) {
      const before = prev.get(id);
      if (!before) toast(`${m.name} בפנים עם ${m.count === 1 ? "מנה אחת" : `${m.count} מנות`}`);
      if (before?.state === "unpaid" && m.state === "paid") toast.success(`התשלום של ${m.name} התקבל ✓`);
    }
    for (const [id, m] of prev) if (!next.has(id)) toast(`המנה של ${m.name} הורדה`);
  }, []);

  const load = useCallback(async () => {
    try {
      const g = await fetchGroup(code);
      setGroup(g);
      if (g) announce(g);
    } catch { /* keep the last view; next poll retries */ }
  }, [code, announce]);

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

  const shareWhatsApp = () => {
    const text = `עושים הזמנה קבוצתית מהמבורגר הבקתה 🍔\nפתחתי הזמנה משותפת - כל אחד מזמין דרך הקישור, משלם על עצמו, וזה מצטרף להזמנה הקבוצתית.\nכשכולם משלמים, ההזמנה יוצאת למטבח ביחד.\n${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  const run = async (key: string, fn: () => Promise<unknown>, failMsg: string) => {
    setBusy(key);
    setError("");
    try { await fn(); await load(); } catch (e) {
      const msg = (e as Error).message;
      setError(msg === "group_empty" ? "עוד אף אחד לא הזמין" : msg === "nobody_paid" ? "עוד אף אחד לא שילם" : failMsg);
    } finally { setBusy(null); }
  };

  const pay = (orderId: string) => run(`pay-${orderId}`, async () => {
    try { sessionStorage.setItem(RETURN_KEY, JSON.stringify({ orderId, code })); } catch { /* ignore */ }
    await payGroupOrder(code, orderId);
  }, "לא הצלחנו לפתוח את דף התשלום");

  if (group === undefined) {
    return <Shell title="הזמנה קבוצתית"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></Shell>;
  }
  if (group === null) {
    return (
      <Shell title="הקבוצה לא נמצאה">
        <p className="text-center text-muted-foreground">כדאי לבדוק את הקישור מול מי ששלח אותו.</p>
        <a href="/" className={`${primaryBtn} flex items-center justify-center`}>לתפריט</a>
      </Shell>
    );
  }

  const members = group.members;
  const unpaid = members.filter((m) => m.state === "unpaid");
  const paidCount = members.length - unpaid.length;
  const sum = members.reduce((s, m) => s + Number(m.total), 0);
  const open = group.status === "open";
  const iOrdered = members.some((m) => isMine(code, m.order_id));
  const memberNames = new Set(members.map((m) => m.name));
  const liveOf = (name: string) => presence.find((p) => p.name === name);
  // On the menu right now but nothing in the group yet: shown like "typing...".
  const ghosts = open ? presence.filter((p) => !memberNames.has(p.name)) : [];
  const stillBuilding = open ? presence.map((p) => p.name) : [];

  return (
    <Shell title={`הקבוצה של ${group.organizer}`} subtitle={group.dine_in ? "יושבים בבקתה" : "לוקחים מהבקתה"}>
      {/* Where the group stands */}
      {group.status === "sent" ? (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-3xl border-2 border-green-500 bg-card p-6 text-center shadow-2xl"
        >
          <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" strokeWidth={2.5} />
          <p className="mt-3 text-3xl font-black text-green-500">ההזמנה נשלחה למטבח!</p>
          <p className="mt-1 text-lg">כולם שילמו. בתאבון!</p>
        </motion.div>
      ) : group.status === "cancelled" ? (
        <div className="rounded-3xl border border-border bg-card p-6 text-center text-xl font-black">הקבוצה בוטלה</div>
      ) : members.length > 0 ? (
        <div className={`rounded-3xl border-2 bg-card p-5 ${group.status === "locked" ? "border-amber-500/70" : "border-border"}`}>
          <div className="flex items-baseline justify-between">
            <p className="text-xl font-black">שילמו {paidCount} מתוך {members.length}</p>
            <p className="font-bold text-muted-foreground">{shekel(sum)}</p>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-green-500 transition-all duration-500" style={{ width: `${(paidCount / members.length) * 100}%` }} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {group.status === "locked"
              ? `${group.organizer} שלח/ה את ההזמנה. היא יוצאת למטבח ברגע ש${unpaid.length === 1 ? `${unpaid[0].name} משלם/ת` : "כולם משלמים"}.`
              : `ההזמנה יוצאת למטבח כש${manager ? "שולחים אותה" : `${group.organizer} שולח/ת אותה`} וכולם שילמו.`}
          </p>
        </div>
      ) : null}

      {/* Organizer: who has not paid, and what to do about it */}
      {manager && (open || group.status === "locked") && unpaid.length > 0 && !closed && (
        <UnpaidManager
          unpaid={unpaid}
          paidCount={paidCount}
          busy={busy}
          initiallyOpen={fromSms}
          onPay={pay}
          onRemove={(id) => void run(`rm-${id}`, () => removeFromGroup(code, id), "לא הצלחנו להוציא מההזמנה")}
          onSendWithout={() => void run("send-without", () => sendWithoutUnpaid(code), "לא הצלחנו לשלוח את ההזמנה")}
        />
      )}

      {/* The organizer's job, said plainly */}
      {manager && open && (
        <div className="rounded-2xl border-2 border-primary/50 bg-primary/10 p-4">
          <p className="text-lg font-black">👑 את/ה המארגן/ת של הקבוצה</p>
          <p className="mt-1 leading-relaxed">
            כל אחד מזמין ומשלם בעצמו. כשכולם סיימו להזמין, לוחצים למטה על <b>"לשלוח את ההזמנה למטבח"</b>.
            עד שלוחצים - ההזמנה לא יוצאת.
          </p>
        </div>
      )}

      {open && closed && <ClosedNote />}

      {/* Order + invite */}
      {open && !closed && (
        <div className="space-y-3">
          {askName ? (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <label className="block space-y-2">
                <span className="font-bold">השם שלך (יופיע על המנה)</span>
                <input
                  className={inputCls}
                  value={myName}
                  onChange={(e) => setMyName(e.target.value)}
                  maxLength={40}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && startOrdering()}
                />
              </label>
              <button className={primaryBtn} onClick={startOrdering}>לתפריט</button>
            </div>
          ) : (
            <button className={primaryBtn} onClick={startOrdering}>
              {iOrdered ? "להוסיף עוד מנה" : "לבחור את המנה שלי 🍔"}
            </button>
          )}
          <button onClick={shareWhatsApp} className={`${bigBtn} bg-green text-white shadow-xl hover:brightness-110`}>
            לשלוח לחברים בוואטסאפ
          </button>
          <button onClick={copy} className="mx-auto flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "הקישור הועתק" : "להעתיק את הקישור"}
          </button>
        </div>
      )}

      {/* Who is in */}
      <section className="space-y-3">
        <h2 className="text-2xl font-black">מי בפנים</h2>
        {ghosts.map((p) => (
          <div key={`live-${p.name}`} className="flex items-center gap-3 rounded-2xl border border-dashed border-primary/50 bg-card/60 p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-lg font-black text-primary">
              {p.name.trim().charAt(0)}
            </span>
            <p className="text-lg font-black">{p.name}</p>
            <p className="mr-auto flex items-center gap-1.5 text-sm font-bold text-primary">{activityText(p)} <TypingDots /></p>
          </div>
        ))}
        {members.length === 0 && ghosts.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">
            עוד אף אחד לא הזמין. שלחו את הקישור והתחילו לבחור.
          </p>
        ) : (
          members.map((m) => {
            const mine = isMine(code, m.order_id);
            const paid = m.state === "paid";
            const canRemove = !paid && group.status !== "sent" && (mine || manager);
            return (
              <div key={m.order_id} className={`rounded-2xl border bg-card p-4 ${paid ? "border-green-500/40" : "border-border"}`}>
                <div className="flex items-center gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-black ${paid ? "bg-green-500/15 text-green-500" : "bg-primary/15 text-primary"}`}>
                    {paid ? <Check size={22} strokeWidth={3} /> : m.name.trim().charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-black">{m.name}{mine && <span className="text-sm font-bold text-muted-foreground"> · את/ה</span>}</p>
                    {open && liveOf(m.name) ? (
                      <p className="flex items-center gap-1.5 text-sm font-bold text-primary">
                        {liveOf(m.name)!.state === "paying" ? "בתשלום" : "מוסיף/ה עוד מנה"} <TypingDots />
                      </p>
                    ) : (
                      <p className="truncate text-sm text-muted-foreground">
                        {(m.items ?? []).map((it) => (it.qty > 1 ? `${it.name} ×${it.qty}` : it.name)).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-left">
                    <p className="font-black">{shekel(m.total)}</p>
                    <p className={`flex items-center justify-end gap-1 text-xs font-bold ${paid ? "text-green-500" : "text-amber-500"}`}>
                      {paid ? "שילם" : <><Clock size={12} /> לא שילם</>}
                    </p>
                  </div>
                </div>
                {!paid && group.status !== "sent" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => pay(m.order_id)}
                      disabled={!!busy || closed}
                      className="h-12 flex-1 rounded-[2rem] bg-primary font-black text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      {busy === `pay-${m.order_id}` ? "פותח תשלום..." : mine ? "לשלם" : `לשלם על ${m.name}`}
                    </button>
                    {canRemove && (
                      <button
                        onClick={() => tap(`rm-${m.order_id}`, () => void run(`rm-${m.order_id}`, () => removeFromGroup(code, m.order_id), "לא הצלחנו להוריד את המנה"))}
                        disabled={!!busy}
                        className={`h-12 rounded-[2rem] border-2 px-5 font-bold transition-colors disabled:opacity-50 ${armed === `rm-${m.order_id}` ? "border-destructive bg-destructive/15 text-destructive" : "border-border"}`}
                      >
                        {armed === `rm-${m.order_id}` ? "בטוח? להוריד" : "להוריד"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      {error && <p className="text-center font-bold text-destructive">{error}</p>}

      {/* Organizer: everyone's in - send it */}
      {manager && open && members.length > 0 && !closed && (
        <div className="space-y-2 pt-2">
          {stillBuilding.length > 0 && (
            <p className="flex items-center justify-center gap-1.5 text-center text-sm font-bold text-primary">
              {stillBuilding.join(", ")} {stillBuilding.length === 1 ? "עוד בונה הזמנה" : "עוד בונים הזמנה"} <TypingDots />
            </p>
          )}
          <button
            onClick={() => tap("lock", () => void run("lock", () => lockGroup(code), "לא הצלחנו לשלוח את ההזמנה"))}
            disabled={!!busy}
            className={`${bigBtn} ${armed === "lock" ? "bg-primary text-primary-foreground" : "bg-green text-white"} shadow-2xl`}
          >
            {busy === "lock"
              ? "שולחים..."
              : armed === "lock"
                ? stillBuilding.length > 0 ? "לשלוח בלי לחכות להם?" : "בטוח? לחיצה נוספת שולחת"
                : "כולם הזמינו - לשלוח את ההזמנה למטבח"}
          </button>
          <p className="text-center text-sm text-muted-foreground">
            אחרי השליחה אי אפשר להוסיף מנות. מי שעוד לא שילם - ההזמנה תצא ברגע שישלם.
          </p>
        </div>
      )}
    </Shell>
  );
};

const GroupOrder = () => {
  const { code } = useParams();
  return code ? <GroupView code={code.toUpperCase()} /> : <CreateGroup />;
};

export default GroupOrder;
