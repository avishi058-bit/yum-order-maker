import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import SignatureCanvas from "react-signature-canvas";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, ChevronLeft, ChevronRight, Download, PartyPopper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_ADDONS, EVENT_PACKAGES, EVENT_TYPES } from "@/data/eventPackages";
import { fillTemplate, generateContractPdf, downloadBlob, fetchClientIp, type ContractData } from "@/lib/eventContract";
import { cn } from "@/lib/utils";

const supa = supabase as any;

type Step = 1 | 2 | 3 | 4 | 5;

const EventBooking = () => {
  const [step, setStep] = useState<Step>(1);
  const [blockedDates, setBlockedDates] = useState<Date[]>([]);
  const [contractTemplate, setContractTemplate] = useState("");
  const [minimumAmount, setMinimumAmount] = useState(2000);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [eventDate, setEventDate] = useState<Date | undefined>();
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventAddress, setEventAddress] = useState("");
  const [guests, setGuests] = useState<number>(50);
  const [packageId, setPackageId] = useState<string>("premium");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const customerSigRef = useRef<SignatureCanvas | null>(null);
  const businessSigRef = useRef<SignatureCanvas | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: blocked }, { data: settings }] = await Promise.all([
        supa.from("event_blocked_dates").select("blocked_date"),
        supa.from("event_settings").select("*").eq("id", 1).maybeSingle(),
      ]);
      if (blocked) setBlockedDates(blocked.map((r: any) => new Date(r.blocked_date + "T00:00:00")));
      if (settings) {
        setContractTemplate(settings.contract_template || "");
        setMinimumAmount(Number(settings.minimum_amount) || 2000);
      }
    })();
  }, []);

  const selectedPackage = useMemo(
    () => EVENT_PACKAGES.find((p) => p.id === packageId) ?? EVENT_PACKAGES[0],
    [packageId]
  );
  const chosenAddons = useMemo(
    () => EVENT_ADDONS.filter((a) => selectedAddons.includes(a.id)),
    [selectedAddons]
  );
  const subtotal = useMemo(() => {
    const addonPerPerson = chosenAddons.reduce((s, a) => s + a.pricePerPerson, 0);
    return (selectedPackage.pricePerPerson + addonPerPerson) * guests;
  }, [selectedPackage, chosenAddons, guests]);
  const minApplied = subtotal < minimumAmount;
  const total = Math.max(subtotal, minimumAmount);

  const filledContract = useMemo<string>(() => {
    if (!contractTemplate) return "";
    const data: ContractData = {
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      event_type: EVENT_TYPES.find((t) => t.value === eventType)?.label || eventType,
      event_date: eventDate ? format(eventDate, "dd/MM/yyyy") : "",
      start_time: startTime,
      end_time: endTime,
      event_address: eventAddress,
      guests_count: guests,
      package_name: selectedPackage.name,
      package_price: selectedPackage.pricePerPerson,
      addons_list: chosenAddons.map((a) => a.name).join(", "),
      total_price: total,
    };
    return fillTemplate(contractTemplate, data);
  }, [contractTemplate, customerName, customerPhone, customerEmail, eventType, eventDate, startTime, endTime, eventAddress, guests, selectedPackage, chosenAddons, total]);

  const isDateBlocked = (d: Date) => {
    const t = d.setHours(0, 0, 0, 0);
    return blockedDates.some((b) => b.setHours(0, 0, 0, 0) === t);
  };

  const validateStep1 = () => {
    if (!customerName.trim()) return "יש להזין שם מלא";
    if (!/^05\d{8}$/.test(customerPhone.replace(/[-\s]/g, ""))) return "טלפון לא תקין (05...)";
    if (!customerEmail.includes("@")) return "אימייל לא תקין";
    if (!eventDate) return "יש לבחור תאריך";
    if (!startTime || !endTime) return "יש להזין שעות";
    if (!eventType) return "יש לבחור סוג אירוע";
    if (!eventAddress.trim()) return "יש להזין כתובת";
    if (!guests || guests < 10) return "מינימום 10 אורחים";
    return null;
  };

  const next = () => {
    if (step === 1) {
      const err = validateStep1();
      if (err) { toast.error(err); return; }
    }
    if (step === 3 && !acceptTerms) {
      toast.error("יש לאשר את תנאי החוזה");
      return;
    }
    setStep((s) => Math.min(5, (s + 1) as Step));
  };
  const prev = () => setStep((s) => Math.max(1, (s - 1) as Step));

  const submitBooking = async () => {
    if (!customerSigRef.current || customerSigRef.current.isEmpty()) {
      toast.error("חסרה חתימת לקוח");
      return;
    }
    if (!businessSigRef.current || businessSigRef.current.isEmpty()) {
      toast.error("חסרה חתימת בעל העסק");
      return;
    }
    setSubmitting(true);
    try {
      const customerSig = customerSigRef.current.getCanvas().toDataURL("image/png");
      const businessSig = businessSigRef.current.getCanvas().toDataURL("image/png");
      const ip = await fetchClientIp();
      const signedAt = new Date().toISOString();

      const payload = {
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        event_date: format(eventDate!, "yyyy-MM-dd"),
        start_time: startTime,
        end_time: endTime,
        event_type: EVENT_TYPES.find((t) => t.value === eventType)?.label || eventType,
        event_address: eventAddress,
        guests_count: guests,
        package_id: selectedPackage.id,
        package_name: selectedPackage.name,
        package_price_per_person: selectedPackage.pricePerPerson,
        addons: chosenAddons,
        subtotal,
        total_price: total,
        min_applied: minApplied,
        contract_text: filledContract,
        customer_signature: customerSig,
        business_signature: businessSig,
        signed_at: signedAt,
        client_ip: ip,
        status: "signed",
      };

      const { data, error } = await supa.from("event_bookings").insert(payload).select("id").single();
      if (error) throw error;

      const blob = await generateContractPdf({
        contractText: filledContract,
        customerSignature: customerSig,
        businessSignature: businessSig,
        signedAt: format(new Date(signedAt), "dd/MM/yyyy HH:mm"),
        clientIp: ip,
        bookingId: data.id,
      });
      setPdfBlob(blob);
      setBookingId(data.id);
      setStep(5);
      toast.success("החוזה נחתם בהצלחה!");
    } catch (e: any) {
      toast.error(e.message || "שגיאה בשמירת ההזמנה");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 py-6 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">🚜🍔 הזמנת אירוע – הבקתה</h1>
          <p className="text-muted-foreground">שולחן שוק • המבורגר הבקתה</p>
        </header>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-6 gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>{s}</div>
              {s < 5 && <div className={cn("h-1 flex-1 rounded", step > s ? "bg-primary" : "bg-muted")} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>פרטי האירוע</CardTitle>
              <CardDescription>מלאו את הפרטים הבסיסיים לאירוע שלכם</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>שם מלא</Label><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
                <div><Label>טלפון</Label><Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="05XXXXXXXX" /></div>
                <div className="md:col-span-2"><Label>אימייל</Label><Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} /></div>
                <div>
                  <Label>סוג אירוע</Label>
                  <Select value={eventType} onValueChange={setEventType}>
                    <SelectTrigger><SelectValue placeholder="בחרו..." /></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>מספר אורחים משוער</Label><Input type="number" min={10} value={guests} onChange={(e) => setGuests(Number(e.target.value))} /></div>
                <div><Label>שעת התחלה</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
                <div><Label>שעת סיום</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
                <div className="md:col-span-2"><Label>כתובת האירוע</Label><Input value={eventAddress} onChange={(e) => setEventAddress(e.target.value)} placeholder="עיר, רחוב ומספר" /></div>
              </div>

              <div>
                <Label className="mb-2 block">תאריך האירוע (תאריכים אדומים תפוסים)</Label>
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={eventDate}
                    onSelect={setEventDate}
                    locale={he}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0)) || isDateBlocked(new Date(d))}
                    modifiers={{ blocked: blockedDates }}
                    modifiersClassNames={{ blocked: "bg-destructive/20 text-destructive line-through" }}
                    className="pointer-events-auto rounded-md border"
                  />
                </div>
                {eventDate && <p className="text-center mt-2 text-sm">נבחר: <b>{format(eventDate, "EEEE, d בMMMM yyyy", { locale: he })}</b></p>}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>בחירת מסלול ותוספות</CardTitle>
              <CardDescription>כל המחירים כוללים מע״מ • מינימום הזמנה {minimumAmount.toLocaleString()} ₪</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                {EVENT_PACKAGES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPackageId(p.id)}
                    className={cn(
                      "text-right p-4 rounded-lg border-2 transition-all",
                      packageId === p.id ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/40"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xl font-bold">{p.emoji} {p.name}</span>
                      <Badge variant={packageId === p.id ? "default" : "secondary"}>{p.pricePerPerson} ₪ לאדם</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{p.description}</p>
                    <ul className="text-sm space-y-1">
                      {p.items.map((it, i) => <li key={i}>• {it}</li>)}
                    </ul>
                  </button>
                ))}
              </div>

              <div>
                <h3 className="font-bold mb-2 mt-4">✨ תוספות ושדרוגים</h3>
                <div className="space-y-2">
                  {EVENT_ADDONS.map((a) => (
                    <label key={a.id} className="flex items-center gap-3 p-3 rounded-md border cursor-pointer hover:bg-muted/40">
                      <Checkbox
                        checked={selectedAddons.includes(a.id)}
                        onCheckedChange={(v) => setSelectedAddons((cur) => v ? [...cur, a.id] : cur.filter((x) => x !== a.id))}
                      />
                      <span className="flex-1">{a.emoji} {a.name}</span>
                      <Badge variant="outline">+{a.pricePerPerson} ₪ לאדם</Badge>
                    </label>
                  ))}
                </div>
              </div>

              <Card className="bg-primary/5 border-primary">
                <CardContent className="p-4 space-y-1">
                  <div className="flex justify-between text-sm"><span>מסלול × {guests} אורחים</span><span>{(selectedPackage.pricePerPerson * guests).toLocaleString()} ₪</span></div>
                  {chosenAddons.map((a) => (
                    <div key={a.id} className="flex justify-between text-sm text-muted-foreground"><span>{a.name} × {guests}</span><span>+{(a.pricePerPerson * guests).toLocaleString()} ₪</span></div>
                  ))}
                  <div className="border-t pt-2 flex justify-between font-bold"><span>סה״כ</span><span>{subtotal.toLocaleString()} ₪</span></div>
                  {minApplied && (
                    <div className="text-xs text-destructive bg-destructive/10 rounded p-2 mt-2">
                      ⚠️ הסכום נמוך ממינימום ההזמנה. הסכום עודכן ל-{minimumAmount.toLocaleString()} ₪.
                    </div>
                  )}
                  <div className="text-lg font-bold text-primary flex justify-between pt-2 border-t">
                    <span>לתשלום</span><span>{total.toLocaleString()} ₪</span>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>חוזה האירוע</CardTitle>
              <CardDescription>קראו בעיון לפני החתימה</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/40 rounded-lg p-4 max-h-96 overflow-y-auto whitespace-pre-wrap text-sm leading-7">
                {filledContract}
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={acceptTerms} onCheckedChange={(v) => setAcceptTerms(!!v)} />
                <span className="text-sm">קראתי את החוזה, הבנתי את תנאיו ואני מאשר/ת אותם</span>
              </label>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>חתימות דיגיטליות</CardTitle>
              <CardDescription>שני הצדדים חותמים כדי להשלים את החוזה</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-2 block">חתימת לקוח ({customerName})</Label>
                <div className="border-2 border-dashed rounded-lg bg-white">
                  <SignatureCanvas ref={customerSigRef} canvasProps={{ className: "w-full h-40" }} penColor="black" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => customerSigRef.current?.clear()} className="mt-1">נקה</Button>
              </div>
              <div>
                <Label className="mb-2 block">חתימת בעל העסק</Label>
                <div className="border-2 border-dashed rounded-lg bg-white">
                  <SignatureCanvas ref={businessSigRef} canvasProps={{ className: "w-full h-40" }} penColor="black" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => businessSigRef.current?.clear()} className="mt-1">נקה</Button>
              </div>
              <Button onClick={submitBooking} disabled={submitting} className="w-full" size="lg">
                {submitting ? "שומר..." : "חתום וסיים"}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <PartyPopper className="w-16 h-16 mx-auto text-primary" />
              <h2 className="text-2xl font-bold">האירוע נקבע! 🎉</h2>
              <p className="text-muted-foreground">מספר הזמנה: <code className="bg-muted px-2 py-1 rounded">{bookingId}</code></p>
              <p>החוזה החתום נשמר במערכת. ניתן להוריד עותק PDF.</p>
              {pdfBlob && (
                <Button onClick={() => downloadBlob(pdfBlob, `contract-${bookingId}.pdf`)} size="lg">
                  <Download className="ml-2" /> הורדת החוזה
                </Button>
              )}
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>נציג יצור איתך קשר בקרוב לתיאום פרטי תשלום</span>
              </div>
            </CardContent>
          </Card>
        )}

        {step < 5 && (
          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={prev} disabled={step === 1}>
              <ChevronRight className="ml-1 w-4 h-4" /> חזרה
            </Button>
            {step < 4 && (
              <Button onClick={next}>
                המשך <ChevronLeft className="mr-1 w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EventBooking;
