import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateContractPdf, downloadBlob } from "@/lib/eventContract";
import { DEFAULT_PREP_SETTINGS, type KitchenPrepSettings } from "@/lib/eventKitchenPrep";

const supa = supabase as any;

const EventsAdmin = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [blocked, setBlocked] = useState<any[]>([]);
  const [pickDate, setPickDate] = useState<Date | undefined>();
  const [reason, setReason] = useState("");
  const [contractTemplate, setContractTemplate] = useState("");
  const [minAmount, setMinAmount] = useState(2000);
  const [prep, setPrep] = useState<KitchenPrepSettings>(DEFAULT_PREP_SETTINGS);
  const [savedSignature, setSavedSignature] = useState<string>("");
  const sigRef = useRef<SignatureCanvas | null>(null);

  const saveSignature = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error("צייר קודם חתימה");
      return;
    }
    const dataUrl = sigRef.current.getCanvas().toDataURL("image/png");
    const { error } = await supa.from("event_settings").update({
      business_signature: dataUrl,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) { toast.error(error.message); return; }
    setSavedSignature(dataUrl);
    sigRef.current.clear();
    toast.success("החתימה נשמרה");
  };

  const load = async () => {
    const [b, bd, s] = await Promise.all([
      supa.from("event_bookings").select("*").order("created_at", { ascending: false }),
      supa.from("event_blocked_dates").select("*").order("blocked_date"),
      supa.from("event_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    setBookings(b.data || []);
    setBlocked(bd.data || []);
    if (s.data) {
      setContractTemplate(s.data.contract_template || "");
      setMinAmount(Number(s.data.minimum_amount) || 2000);
      setSavedSignature(s.data.business_signature || "");
      if (s.data.kitchen_prep) setPrep({ ...DEFAULT_PREP_SETTINGS, ...s.data.kitchen_prep });
    }
  };
  useEffect(() => { load(); }, []);

  const blockDate = async () => {
    if (!pickDate) return;
    const { error } = await supa.from("event_blocked_dates").insert({
      blocked_date: format(pickDate, "yyyy-MM-dd"),
      reason,
    });
    if (error) toast.error(error.message);
    else { toast.success("התאריך נחסם"); setReason(""); setPickDate(undefined); load(); }
  };
  const unblock = async (id: string) => {
    const { error } = await supa.from("event_blocked_dates").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };
  const saveSettings = async () => {
    const { error } = await supa.from("event_settings").update({
      contract_template: contractTemplate,
      minimum_amount: minAmount,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) toast.error(error.message); else toast.success("נשמר");
  };
  const savePrep = async () => {
    const { error } = await supa.from("event_settings").update({
      kitchen_prep: prep,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) toast.error(error.message); else toast.success("הגדרות מטבח נשמרו");
  };

  const downloadPdf = async (b: any) => {
    if (!b.customer_signature || !b.business_signature) {
      toast.error("הזמנה זו לא נחתמה");
      return;
    }
    const blob = await generateContractPdf({
      contractText: b.contract_text || "",
      customerSignature: b.customer_signature,
      businessSignature: b.business_signature,
      signedAt: b.signed_at ? format(new Date(b.signed_at), "dd/MM/yyyy HH:mm") : "",
      clientIp: b.client_ip || "",
      bookingId: b.id,
    });
    downloadBlob(blob, `contract-${b.id}.pdf`);
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supa.from("event_bookings").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">ניהול אירועים</h1>

        <Tabs defaultValue="bookings">
          <TabsList>
            <TabsTrigger value="bookings">הזמנות ({bookings.length})</TabsTrigger>
            <TabsTrigger value="calendar">יומן זמינות</TabsTrigger>
            <TabsTrigger value="settings">הגדרות חוזה</TabsTrigger>
            <TabsTrigger value="prep">כמויות מטבח</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="space-y-3">
            {bookings.length === 0 && <p className="text-muted-foreground">אין הזמנות עדיין</p>}
            {bookings.map((b) => (
              <Card key={b.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-bold text-lg">{b.customer_name} • {b.event_type}</h3>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(b.event_date), "EEEE, d בMMMM yyyy", { locale: he })} • {b.start_time}-{b.end_time}
                      </p>
                    </div>
                    <Badge variant={b.status === "signed" ? "default" : b.status === "cancelled" ? "destructive" : "secondary"}>
                      {b.status === "signed" ? "נחתם" : b.status === "cancelled" ? "בוטל" : "ממתין"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div>📞 {b.customer_phone}</div>
                    <div>✉️ {b.customer_email}</div>
                    <div>👥 {b.guests_count} אורחים</div>
                    <div>💰 {Number(b.total_price).toLocaleString()} ₪</div>
                    <div className="col-span-2">📍 {b.at_venue ? "🏠 אצלנו במקום" : b.event_address}</div>
                    <div className="col-span-2">🍔 {b.package_name}</div>
                    {b.invoice_name && b.invoice_name !== b.customer_name && (
                      <div className="col-span-2">🧾 חשבונית ע״ש: <b>{b.invoice_name}</b></div>
                    )}
                    {b.business_id && <div className="col-span-2">🏢 ח.פ / ע.מ: <b>{b.business_id}</b></div>}
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <Button size="sm" onClick={() => downloadPdf(b)}><Download className="ml-1 w-4 h-4" /> הורד PDF</Button>
                    {b.status !== "cancelled" && <Button size="sm" variant="destructive" onClick={() => setStatus(b.id, "cancelled")}>בטל</Button>}
                    {b.status === "cancelled" && <Button size="sm" variant="outline" onClick={() => setStatus(b.id, "signed")}>שחזר</Button>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="calendar">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>חסום תאריך</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Calendar mode="single" selected={pickDate} onSelect={setPickDate} locale={he} className="rounded-md border pointer-events-auto" />
                  <Input placeholder="סיבה (אופציונלי)" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <Button onClick={blockDate} disabled={!pickDate} className="w-full">חסום</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>תאריכים חסומים</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {blocked.length === 0 && <p className="text-muted-foreground text-sm">אין תאריכים חסומים</p>}
                  {blocked.map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-2 rounded border">
                      <div>
                        <div>{format(new Date(b.blocked_date + "T00:00:00"), "d בMMMM yyyy", { locale: he })}</div>
                        {b.reason && <div className="text-xs text-muted-foreground">{b.reason}</div>}
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => unblock(b.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>נוסח החוזה</CardTitle>
                <CardDescription>
                  משתני החלפה זמינים: <code>{"{{customer_name}}"}</code>, <code>{"{{customer_phone}}"}</code>, <code>{"{{customer_email}}"}</code>, <code>{"{{event_type}}"}</code>, <code>{"{{event_date}}"}</code>, <code>{"{{start_time}}"}</code>, <code>{"{{end_time}}"}</code>, <code>{"{{event_address}}"}</code>, <code>{"{{guests_count}}"}</code>, <code>{"{{package_name}}"}</code>, <code>{"{{package_price}}"}</code>, <code>{"{{addons_list}}"}</code>, <code>{"{{total_price}}"}</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium">סכום מינימום להזמנה (₪)</label>
                  <Input type="number" value={minAmount} onChange={(e) => setMinAmount(Number(e.target.value))} />
                </div>
                <Textarea rows={20} value={contractTemplate} onChange={(e) => setContractTemplate(e.target.value)} className="font-mono text-sm" />
                <Button onClick={saveSettings}>שמור</Button>

                <div className="border-t pt-4 space-y-2">
                  <label className="text-sm font-medium block">חתימת בעל העסק (נחתמת אוטומטית בכל חוזה)</label>
                  {savedSignature && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">החתימה השמורה:</span>
                      <img src={savedSignature} alt="חתימת בעל העסק השמורה" className="h-16 bg-white rounded border" />
                    </div>
                  )}
                  <div className="border-2 border-dashed rounded-lg bg-white">
                    <SignatureCanvas ref={sigRef} canvasProps={{ className: "w-full h-40" }} penColor="black" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => sigRef.current?.clear()}>נקה</Button>
                    <Button onClick={saveSignature}>שמור חתימה</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prep">
            <Card>
              <CardHeader>
                <CardTitle>כמויות מטבח לאירוע</CardTitle>
                <CardDescription>גרם למנה / ברירות מחדל. כל ערך שיישונה יעדכן את החישוב האוטומטי בכל הזמנת אירוע.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {([
                    ["tomato_g", "עגבנייה למנה (גרם)"],
                    ["onion_g", "בצל למנה (גרם)"],
                    ["lettuce_g", "חסה למנה (גרם)"],
                    ["pickles_g", "חמוצים למנה (גרם)"],
                    ["chips_g", "צ׳יפס למנה (גרם)"],
                    ["potatoes_g", "פוטטוס למנה (גרם)"],
                    ["onion_rings_g", "טבעות בצל למנה (גרם)"],
                    ["waffle_g", "וופל למנה (גרם)"],
                    ["default_eggs_per_guest", "ביצי עין — ברירת מחדל לסועד"],
                    ["default_dessert_per_guest", "קינוח — ברירת מחדל לסועד"],
                  ] as [keyof KitchenPrepSettings, string][]).map(([k, label]) => (
                    <div key={k}>
                      <label className="text-sm font-medium block mb-1">{label}</label>
                      <Input
                        type="number" step="0.01" min={0}
                        value={prep[k]}
                        onChange={(e) => setPrep({ ...prep, [k]: Number(e.target.value) })}
                      />
                    </div>
                  ))}
                </div>
                <Button onClick={savePrep}>שמור הגדרות מטבח</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default EventsAdmin;
