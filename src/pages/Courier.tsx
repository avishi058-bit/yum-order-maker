import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Bell, Bike, Check, Loader2, LogOut, MapPin, Phone, Smartphone, Wallet } from "lucide-react";
import { subscribeCourierPush } from "@/lib/courierPush";
import { ensureServiceWorker, iosNeedsInstall, isPushSupported } from "@/lib/push";

type Courier = {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  status: "pending" | "approved" | "suspended";
};

type DeliveryReq = {
  id: string;
  address: string;
  customer_name: string | null;
  customer_phone: string | null;
  zone_name: string | null;
  price: number;
  payout: number | null;
  status: string;
  courier_id: string | null;
  lat: number | null;
  lng: number | null;
  claimed_at: string | null;
  created_at: string;
};

const isStandalone = () => {
  if (typeof window === "undefined") return true;
  // @ts-ignore iOS Safari
  const iosStandalone = (window.navigator as any).standalone === true;
  const displayStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches;
  return Boolean(iosStandalone || displayStandalone);
};

const CourierApp = () => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [courier, setCourier] = useState<Courier | null>(null);
  const [openReqs, setOpenReqs] = useState<DeliveryReq[]>([]);
  const [myReqs, setMyReqs] = useState<DeliveryReq[]>([]);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [gpsOn, setGpsOn] = useState(true);
  const [installed, setInstalled] = useState<boolean>(() => isStandalone());
  const [geoState, setGeoState] = useState<PermissionState | "unknown">("unknown");

  // ─── Watch for install / display mode changes ───
  useEffect(() => {
    const mq = window.matchMedia?.("(display-mode: standalone)");
    const onChange = () => setInstalled(isStandalone());
    mq?.addEventListener?.("change", onChange);
    window.addEventListener("visibilitychange", onChange);
    return () => {
      mq?.removeEventListener?.("change", onChange);
      window.removeEventListener("visibilitychange", onChange);
    };
  }, []);

  // ─── Watch geolocation permission ───
  useEffect(() => {
    if (!installed) return;
    let cancelled = false;
    const check = async () => {
      try {
        // @ts-ignore
        const p = await navigator.permissions?.query?.({ name: "geolocation" as PermissionName });
        if (cancelled || !p) return;
        setGeoState(p.state);
        p.onchange = () => setGeoState(p.state);
      } catch { /* older browsers */ }
    };
    check();
    return () => { cancelled = true; };
  }, [installed]);

  // ─── Auth session tracking ───
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (!installed) return <InstallGate />;
  if (geoState !== "granted") return <LocationGate state={geoState} onGranted={() => setGeoState("granted")} />;




  // ─── Load courier row when session exists ───
  const loadCourier = async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from("couriers")
      .select("id, user_id, name, phone, status")
      .eq("user_id", session.user.id)
      .maybeSingle();
    setCourier(data as Courier | null);
  };

  useEffect(() => {
    if (session) loadCourier();
    else setCourier(null);
  }, [session]);

  // ─── Poll courier row for approval status changes ───
  useEffect(() => {
    if (!courier || courier.status === "approved") return;
    const t = setInterval(loadCourier, 5000);
    return () => clearInterval(t);
  }, [courier]);

  // ─── Load deliveries when approved ───
  const loadDeliveries = async () => {
    if (!courier || courier.status !== "approved") return;
    const [openRes, mineRes] = await Promise.all([
      supabase.from("delivery_requests").select("*").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("delivery_requests").select("*").eq("courier_id", courier.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setOpenReqs((openRes.data as DeliveryReq[]) ?? []);
    setMyReqs((mineRes.data as DeliveryReq[]) ?? []);
  };

  useEffect(() => {
    if (courier?.status === "approved") {
      loadDeliveries();
      const ch = supabase
        .channel("courier-deliveries")
        .on("postgres_changes", { event: "*", schema: "public", table: "delivery_requests" }, () => loadDeliveries())
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    }
  }, [courier?.id, courier?.status]);

  // ─── GPS tracking ───
  useEffect(() => {
    if (!gpsOn || !courier || courier.status !== "approved") return;
    if (!("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        await supabase.from("courier_locations").upsert({
          courier_id: courier.id,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          updated_at: new Date().toISOString(),
        });
      },
      (e) => console.warn("gps", e),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [gpsOn, courier?.id]);

  // ─── Auto request push permission for approved couriers ───
  useEffect(() => {
    if (courier?.status !== "approved") return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") setPushEnabled(true);
  }, [courier?.status]);

  const enablePush = async () => {
    if (!courier) return;
    const res = await subscribeCourierPush(courier.id);
    if (res.ok) {
      setPushEnabled(true);
      toast({ title: "התראות הופעלו ✅" });
    } else if (res.reason === "ios_needs_install") {
      toast({
        title: "צריך להוסיף למסך הבית",
        description: "פתח באייפון: שתף ← 'הוסף למסך הבית', ואז פתח את האפליקציה מסמל הבית.",
        variant: "destructive",
      });
    } else {
      toast({ title: "לא ניתן להפעיל התראות", description: res.reason, variant: "destructive" });
    }
  };

  const claim = async (id: string) => {
    if (!courier) return;
    const { data, error } = await supabase
      .from("delivery_requests")
      .update({ status: "approved", courier_id: courier.id, claimed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending")
      .select("id");
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      return;
    }
    if (!data || data.length === 0) {
      toast({ title: "מישהו אחר לקח את זה 😔", variant: "destructive" });
    } else {
      toast({ title: "לקחת את המשלוח 🛵" });
      loadDeliveries();
    }
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!session) return <CourierAuth />;
  if (!courier) return <CourierRegister onDone={loadCourier} userId={session.user.id} />;

  if (courier.status === "pending") {
    return (
      <Screen>
        <Card>
          <CardHeader><CardTitle>ממתין לאישור המנהל</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>ההרשמה שלך התקבלה. המנהל יאשר את החשבון ואחרי זה תוכל לקבל משלוחים.</p>
            <p className="text-sm">שם: {courier.name} · טלפון: {courier.phone}</p>
            <Button variant="outline" onClick={signOut} className="w-full">
              <LogOut className="ml-2 h-4 w-4" />התנתק
            </Button>
          </CardContent>
        </Card>
      </Screen>
    );
  }

  if (courier.status === "suspended") {
    return (
      <Screen>
        <Card><CardHeader><CardTitle>החשבון מושבת</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">פנה למנהל.</p>
        <Button variant="outline" onClick={signOut} className="w-full mt-3">התנתק</Button>
        </CardContent></Card>
      </Screen>
    );
  }

  // Approved
  const now = new Date();
  const monthDeliveries = myReqs.filter(r =>
    r.status === "completed" &&
    r.claimed_at &&
    new Date(r.claimed_at).getMonth() === now.getMonth() &&
    new Date(r.claimed_at).getFullYear() === now.getFullYear()
  );
  const monthEarnings = monthDeliveries.reduce((s, r) => s + Number(r.payout ?? r.price ?? 0), 0);

  return (
    <div className="min-h-screen bg-background pb-8" dir="rtl">
      <header className="sticky top-0 z-10 bg-card border-b p-4 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg flex items-center gap-2"><Bike className="h-5 w-5" /> {courier.name}</h1>
          <p className="text-xs text-muted-foreground">אפליקציית שליחים · הבקתה</p>
        </div>
        <Button size="sm" variant="ghost" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
      </header>

      <div className="p-4 space-y-4">
        {/* Earnings card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">החודש</p>
                <p className="text-3xl font-bold">₪{monthEarnings.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground mt-1">{monthDeliveries.length} משלוחים</p>
              </div>
              <Wallet className="h-10 w-10 text-primary opacity-40" />
            </div>
          </CardContent>
        </Card>

        {/* Push + GPS toggles */}
        <div className="grid grid-cols-2 gap-2">
          <Button variant={pushEnabled ? "default" : "outline"} onClick={enablePush} disabled={pushEnabled}>
            <Bell className="ml-2 h-4 w-4" />{pushEnabled ? "התראות פעילות" : "הפעל התראות"}
          </Button>
          <Button variant={gpsOn ? "default" : "outline"} onClick={() => setGpsOn(v => !v)}>
            <MapPin className="ml-2 h-4 w-4" />{gpsOn ? "מיקום פעיל" : "שתף מיקום"}
          </Button>
        </div>

        {/* Open deliveries */}
        <section>
          <h2 className="font-bold text-lg mb-2">משלוחים פתוחים</h2>
          {openReqs.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">אין משלוחים כרגע 🙂</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {openReqs.map(r => (
                <Card key={r.id} className="border-primary/40">
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-semibold flex items-center gap-1"><MapPin className="h-4 w-4" />{r.address}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {r.customer_name} · <a href={`tel:${r.customer_phone}`} className="underline">{r.customer_phone}</a>
                        </p>
                        <p className="text-xs text-muted-foreground">{r.zone_name}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-2xl font-bold text-primary">₪{Number(r.payout ?? r.price)}</p>
                      </div>
                    </div>
                    <Button
                      className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold text-base"
                      onClick={() => claim(r.id)}
                    >
                      <Check className="ml-2 h-5 w-5" /> אני לוקח את המשלוח
                    </Button>
                    {r.lat && r.lng ? (
                      <a
                        href={`https://waze.com/ul?ll=${r.lat},${r.lng}&navigate=yes`}
                        target="_blank" rel="noreferrer"
                        className="block text-center text-sm text-primary underline"
                      >נווט בוויז</a>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* My deliveries */}
        <section>
          <h2 className="font-bold text-lg mb-2">המשלוחים שלי</h2>
          {myReqs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">עוד לא לקחת משלוחים</p>
          ) : (
            <div className="space-y-2">
              {myReqs.map(r => (
                <Card key={r.id}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.address}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.claimed_at ? new Date(r.claimed_at).toLocaleDateString("he-IL") : ""} · {r.status === "completed" ? "הושלם" : r.status === "approved" ? "בביצוע" : r.status}
                      </p>
                    </div>
                    <p className="font-bold">₪{Number(r.payout ?? r.price)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const Screen = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
    <div className="w-full max-w-md">{children}</div>
  </div>
);

// ─── Install gate: forces PWA install before use ───
// ─── Location gate: forces GPS permission before use ───
const LocationGate = ({ state, onGranted }: { state: PermissionState | "unknown"; onGranted: () => void }) => {
  const [busy, setBusy] = useState(false);
  const request = () => {
    if (!("geolocation" in navigator)) {
      toast({ title: "המכשיר לא תומך במיקום", variant: "destructive" });
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      () => { setBusy(false); onGranted(); },
      (err) => {
        setBusy(false);
        toast({
          title: "צריך לאשר גישה למיקום",
          description: err.message || "פתח את הגדרות הטלפון ואפשר מיקום לאפליקציה.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <Screen>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> אשר גישה למיקום</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            אפליקציית השליחים חייבת גישה למיקום כדי לשלוח לך משלוחים קרובים ולעדכן את המנהל איפה אתה. ללא אישור מיקום לא ניתן להשתמש באפליקציה.
          </p>
          {state === "denied" ? (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-2">
              <p className="font-semibold text-destructive">המיקום חסום</p>
              <p className="text-muted-foreground">
                פתח את הגדרות הטלפון ← הרשאות ← אפשר "מיקום" לאפליקציית הבקתה, ואז חזור לאפליקציה.
              </p>
            </div>
          ) : (
            <Button className="w-full h-12" onClick={request} disabled={busy}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><MapPin className="ml-2 h-5 w-5" /> אפשר מיקום</>}
            </Button>
          )}
          <p className="text-xs text-muted-foreground text-center">
            המיקום משמש רק לשליחת משלוחים ולניווט. אין שיתוף עם צד שלישי.
          </p>
        </CardContent>
      </Card>
    </Screen>
  );
};

const InstallGate = () => {

  const [deferred, setDeferred] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);
    const onPrompt = (e: any) => { e.preventDefault(); setDeferred(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return (
    <Screen>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" /> התקן את האפליקציה
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            כדי לקבל התראות על משלוחים חדשים חובה להתקין את אפליקציית השליחים על המסך הראשי של הטלפון. אחרי ההתקנה תפתח אותה מהאייקון בלבד.
          </p>

          {isIOS ? (
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 space-y-2">
              <p className="font-semibold">איך מתקינים באייפון:</p>
              <ol className="list-decimal pr-5 space-y-1 text-muted-foreground">
                <li>לחץ על כפתור השיתוף בתחתית ספארי (ריבוע עם חץ למעלה).</li>
                <li>גלול ובחר <b>"הוסף למסך הבית"</b>.</li>
                <li>לחץ <b>"הוסף"</b>.</li>
                <li>סגור את הדפדפן ופתח את האפליקציה מהאייקון החדש.</li>
              </ol>
            </div>
          ) : deferred ? (
            <Button className="w-full h-12" onClick={install}>
              <Smartphone className="ml-2 h-5 w-5" /> התקן עכשיו
            </Button>
          ) : (
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 space-y-2">
              <p className="font-semibold">איך מתקינים באנדרואיד:</p>
              <ol className="list-decimal pr-5 space-y-1 text-muted-foreground">
                <li>פתח את תפריט הדפדפן (שלוש נקודות ⋮).</li>
                <li>בחר <b>"התקן אפליקציה"</b> או <b>"הוסף למסך הבית"</b>.</li>
                <li>אשר, וסגור את הדפדפן.</li>
                <li>פתח את האפליקציה מהאייקון החדש במסך הבית.</li>
              </ol>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            הכניסה לחשבון והתראות משלוחים יעבדו רק מתוך האפליקציה המותקנת.
          </p>
        </CardContent>
      </Card>
    </Screen>
  );
};

// ─── Auth (login + signup) ───

const CourierAuth = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || password.length < 6) {
      toast({ title: "אימייל וסיסמה (6+) נדרשים", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/courier` },
        });
        if (error) throw error;
        toast({ title: "נרשמת ✅", description: "אם המערכת מבקשת אימות מייל — בדוק בתיבה" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const iosInstall = iosNeedsInstall();

  return (
    <Screen>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bike className="h-5 w-5" /> אפליקציית שליחים · הבקתה</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {iosInstall && (
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-sm">
              <p className="font-semibold flex items-center gap-1"><Smartphone className="h-4 w-4" /> חשוב באייפון</p>
              <p className="text-muted-foreground mt-1">
                כדי לקבל התראות: לחץ על כפתור השיתוף בדפדפן ← "הוסף למסך הבית", ואז פתח את האפליקציה דרך הסמל שהופיע.
              </p>
            </div>
          )}
          <Input type="email" placeholder="אימייל" value={email} onChange={e => setEmail(e.target.value)} dir="ltr" />
          <Input type="password" placeholder="סיסמה" value={password} onChange={e => setPassword(e.target.value)} dir="ltr" />
          <Button className="w-full" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signup" ? "הרשמה" : "כניסה"}
          </Button>
          <button
            className="w-full text-sm text-muted-foreground underline"
            onClick={() => setMode(m => m === "signup" ? "login" : "signup")}
          >
            {mode === "signup" ? "יש לי כבר חשבון · כניסה" : "אני חדש · הרשמה"}
          </button>
        </CardContent>
      </Card>
    </Screen>
  );
};

// ─── Register as courier (after auth) ───
const CourierRegister = ({ onDone, userId }: { onDone: () => void; userId: string }) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (name.trim().length < 2 || !/^05\d{8}$/.test(phone.trim())) {
      toast({ title: "מלא שם וטלפון (05XXXXXXXX)", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("couriers").insert({
      user_id: userId,
      name: name.trim(),
      phone: phone.trim(),
      status: "pending",
    });
    setBusy(false);
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "נרשמת! המנהל יאשר בקרוב" });
    onDone();
  };

  return (
    <Screen>
      <Card>
        <CardHeader><CardTitle>פרטי שליח</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="שם מלא" value={name} onChange={e => setName(e.target.value)} />
          <Input placeholder="טלפון (05XXXXXXXX)" value={phone} onChange={e => setPhone(e.target.value)} dir="ltr" />
          <Button className="w-full" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "שלח בקשה"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            המנהל יאשר את החשבון ידנית. אחרי אישור תקבל התראות על כל משלוח.
          </p>
        </CardContent>
      </Card>
    </Screen>
  );
};

export default CourierApp;
