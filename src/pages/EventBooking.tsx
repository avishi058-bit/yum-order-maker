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
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CalendarSearch, CheckCircle2, ChevronLeft, ChevronRight, Download, PartyPopper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_ADDONS, EVENT_PACKAGES, EVENT_TYPES, EVENT_DRINK_OPTIONS, PACKAGES_WITH_DRINKS } from "@/data/eventPackages";
import { fillTemplate, generateContractPdf, downloadBlob, fetchClientIp, type ContractData } from "@/lib/eventContract";
import { cn } from "@/lib/utils";
import EventStoryGallery from "@/components/EventStoryGallery";
import { BUSINESS_SIGNATURE_SRC, getBusinessSignatureDataUrl } from "@/config/businessSignature";

const VENUE_ADDRESS = "המבורגר הבקתה — האירוע אצלנו במקום";
const supa = supabase as any;

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const STEP_LABELS: Record<Step, string> = {
  1: "מסלול",
  2: "תאריך",
  3: "פרטים",
  4: "חוזה",
  5: "חתימה",
  6: "סיום",
};

const EventBooking = () => {
  const [step, setStep] = useState<Step>(1);
  const [blockedDates, setBlockedDates] = useState<Date[]>([]);
  const [contractTemplate, setContractTemplate] = useState("");
  const [minimumAmount, setMinimumAmount] = useState(2000);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [availOpen, setAvailOpen] = useState(false);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [invoiceName, setInvoiceName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [eventDate, setEventDate] = useState<Date | undefined>();
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [eventType, setEventType] = useState("");
  const [atVenue, setAtVenue] = useState(false);
  const [eventAddress, setEventAddress] = useState("");
  const [guests, setGuests] = useState<number>(50);
  const [packageId, setPackageId] = useState<string>("premium");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>({});
  const [drinkSelections, setDrinkSelections] = useState<Record<string, number>>({});
  const [acceptTerms, setAcceptTerms] = useState(false);

  const customerSigRef = useRef<SignatureCanvas | null>(null);
  const businessSigRef = useRef<SignatureCanvas | null>(null);

  useEffect(() => {
    document.title = "הזמנת אירועים | המבורגר הבקתה";
    (async () => {
      const [{ data: blocked }, { data: settings }] = await Promise.all([
        supa.from("event_blocked_dates").select("blocked_date"),
        supa.from("event_settings").select("contract_template, minimum_amount").eq("id", 1).maybeSingle(),
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
  const addonQty = (a: typeof EVENT_ADDONS[number]) =>
    a.partial ? Math.min(guests, Math.max(0, addonQuantities[a.id] ?? 0)) : guests;

  const packageIncludesDrinks = PACKAGES_WITH_DRINKS.has(packageId);
  const needsDrinkSelection = packageIncludesDrinks && !atVenue;
  const drinksTotal = useMemo(
    () => Object.values(drinkSelections).reduce((s, n) => s + (Number(n) || 0), 0),
    [drinkSelections]
  );
  const setDrinkQty = (id: string, n: number) =>
    setDrinkSelections((cur) => ({ ...cur, [id]: Math.max(0, Math.floor(n || 0)) }));
  const subtotal = useMemo(() => {
    const pkg = selectedPackage.pricePerPerson * guests;
    const addonsSum = chosenAddons.reduce((s, a) => s + a.pricePerPerson * addonQty(a), 0);
    return pkg + addonsSum;
  }, [selectedPackage, chosenAddons, guests, addonQuantities]);
  const minApplied = subtotal < minimumAmount;
  const total = Math.max(subtotal, minimumAmount);

  const filledContract = useMemo<string>(() => {
    if (!contractTemplate) return "";
    const data: ContractData = {
      customer_name: invoiceName || customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      event_type: EVENT_TYPES.find((t) => t.value === eventType)?.label || eventType,
      event_date: eventDate ? format(eventDate, "dd/MM/yyyy") : "",
      start_time: startTime,
      end_time: endTime,
      event_address: atVenue ? VENUE_ADDRESS : eventAddress,
      guests_count: guests,
      package_name: selectedPackage.name,
      package_price: selectedPackage.pricePerPerson,
      addons_list: chosenAddons.map((a) => `${a.name}${a.partial ? ` (×${addonQty(a)})` : ""}`).join(", "),
      total_price: total,
    };
    return fillTemplate(contractTemplate, data);
  }, [contractTemplate, customerName, invoiceName, customerPhone, customerEmail, eventType, eventDate, startTime, endTime, atVenue, eventAddress, guests, selectedPackage, chosenAddons, total]);

  const isDateBlocked = (d: Date) => {
    const t = new Date(d).setHours(0, 0, 0, 0);
    return blockedDates.some((b) => new Date(b).setHours(0, 0, 0, 0) === t);
  };

  const validateStep = (s: Step): string | null => {
    if (s === 1) {
      if (!guests || guests < 10) return "מינימום 10 אורחים";
      if (!packageId) return "יש לבחור מסלול";
    }
    if (s === 2) {
      if (!eventDate) return "יש לבחור תאריך";
      if (!startTime || !endTime) return "יש להזין שעות התחלה וסיום";
    }
    if (s === 3) {
      if (!customerName.trim()) return "יש להזין שם מלא / שם החברה";
      if (!/^05\d{8}$/.test(customerPhone.replace(/[-\s]/g, ""))) return "טלפון לא תקין (05...)";
      if (!customerEmail.includes("@")) return "אימייל לא תקין";
      if (!eventType) return "יש לבחור סוג אירוע";
      if (!atVenue && !eventAddress.trim()) return "יש להזין כתובת או לסמן שהאירוע אצלנו";
      if (needsDrinkSelection && drinksTotal !== guests) {
        return `בחירת שתייה: נבחרו ${drinksTotal} מתוך ${guests} — יש להתאים לפי מספר האורחים`;
      }
    }
    if (s === 4 && !acceptTerms) return "יש לאשר את תנאי החוזה";
    return null;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) { toast.error(err); return; }
    setStep((s) => Math.min(6, s + 1) as Step);
  };
  const prev = () => setStep((s) => Math.max(1, s - 1) as Step);

  const submitBooking = async () => {
    if (!customerSigRef.current || customerSigRef.current.isEmpty()) {
      toast.error("חסרה חתימת לקוח"); return;
    }
    setSubmitting(true);
    try {
      const customerSig = customerSigRef.current.getCanvas().toDataURL("image/png");
      const businessSig = await getBusinessSignatureDataUrl();
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
        event_address: atVenue ? VENUE_ADDRESS : eventAddress,
        at_venue: atVenue,
        business_id: businessId || null,
        invoice_name: invoiceName || customerName,
        guests_count: guests,
        package_id: selectedPackage.id,
        package_name: selectedPackage.name,
        package_price_per_person: selectedPackage.pricePerPerson,
        addons: chosenAddons.map((a) => ({ ...a, quantity: addonQty(a), lineTotal: a.pricePerPerson * addonQty(a) })),
        subtotal,
        total_price: total,
        min_applied: minApplied,
        drink_selections: needsDrinkSelection
          ? EVENT_DRINK_OPTIONS
              .filter((d) => (drinkSelections[d.id] || 0) > 0)
              .reduce((acc, d) => ({ ...acc, [d.name]: drinkSelections[d.id] }), {} as Record<string, number>)
          : {},
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
      setStep(6);
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
        <header className="text-center mb-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">🚜🍔 הזמנת אירוע – הבקתה</h1>
          <p className="text-muted-foreground">שולחן שוק • המבורגר הבקתה</p>
        </header>

        {/* Kosher certification banner */}
        <div className="mb-6 rounded-xl border-2 border-primary/30 bg-primary/5 p-4 text-sm leading-relaxed">
          <div className="flex items-center gap-2 font-bold text-base mb-2">
            <span>✡️</span>
            <span>כשרות</span>
          </div>
          <p>
            כאשר בהשגחת <b>הרבנות המקומית שדות נגב</b>.
            ההמבורגר: <b>בשר חלק</b> ברבנות. הירק: <b>גוש קטיף</b> — תעודת כשרות רגילה.
            <span className="text-muted-foreground"> (תוספת רצועות רוסטביף — לא חלק)</span>.
          </p>
          <p className="text-xs text-muted-foreground mt-2">תעודת כשרות מעודכנת מוצגת במקום ותצורף לחוזה.</p>
        </div>


        {step === 1 && (
          <div className="mb-6 max-w-sm mx-auto">
            <EventStoryGallery />
            <p className="text-center text-sm text-muted-foreground mt-2">רגעים מאירועים שכבר עשינו 👆</p>
          </div>
        )}

        {/* Stepper */}
        <div className="flex items-center justify-between mb-6 gap-1">
          {([1, 2, 3, 4, 5, 6] as Step[]).map((s) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex items-center gap-1 w-full">
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                  step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>{s}</div>
                {s < 6 && <div className={cn("h-1 flex-1 rounded", step > s ? "bg-primary" : "bg-muted")} />}
              </div>
              <span className={cn("text-[10px] md:text-xs", step >= s ? "text-primary font-bold" : "text-muted-foreground")}>{STEP_LABELS[s]}</span>
            </div>
          ))}
        </div>

        {/* STEP 1 — Packages */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>🍔 בחירת מסלול ומחיר</CardTitle>
              <CardDescription>הצצה במסלולים והמחירים • כל המחירים כוללים מע״מ • מינימום הזמנה {minimumAmount.toLocaleString()} ₪</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>מספר אורחים משוער</Label>
                <Input type="number" min={10} value={guests} onChange={(e) => setGuests(Number(e.target.value))} />
              </div>

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
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
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
                  {EVENT_ADDONS.map((a) => {
                    const checked = selectedAddons.includes(a.id);
                    return (
                      <div key={a.id} className="p-3 rounded-md border">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              setSelectedAddons((cur) => v ? [...cur, a.id] : cur.filter((x) => x !== a.id));
                              if (v && a.partial && !addonQuantities[a.id]) {
                                setAddonQuantities((q) => ({ ...q, [a.id]: 1 }));
                              }
                            }}
                          />
                          <span className="flex-1">{a.emoji} {a.name}</span>
                          <Badge variant="outline">+{a.pricePerPerson} ₪ {a.partial ? "ליחידה" : "לאדם"}</Badge>
                        </label>
                        {checked && a.partial && (
                          <div className="mt-3 pr-8 flex items-center gap-2 flex-wrap">
                            <Label className="text-sm">כמה מנות כאלו מתוך {guests}?</Label>
                            <Input
                              type="number"
                              min={1}
                              max={guests}
                              value={addonQuantities[a.id] ?? 1}
                              onChange={(e) => setAddonQuantities((q) => ({ ...q, [a.id]: Number(e.target.value) }))}
                              className="w-24"
                            />
                            <span className="text-xs text-muted-foreground">
                              = {((addonQuantities[a.id] ?? 0) * a.pricePerPerson).toLocaleString()} ₪
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <Card className="bg-primary/5 border-primary">
                <CardContent className="p-4 space-y-1">
                  <div className="flex justify-between text-sm"><span>מסלול × {guests} אורחים</span><span>{(selectedPackage.pricePerPerson * guests).toLocaleString()} ₪</span></div>
                  {chosenAddons.map((a) => {
                    const q = addonQty(a);
                    return (
                      <div key={a.id} className="flex justify-between text-sm text-muted-foreground"><span>{a.name} × {q}</span><span>+{(a.pricePerPerson * q).toLocaleString()} ₪</span></div>
                    );
                  })}
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

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setAvailOpen(true)}
              >
                <CalendarSearch className="ml-2 w-4 h-4" />
                בדיקת תאריכים זמינים
              </Button>
            </CardContent>
          </Card>
        )}

        {/* STEP 2 — Date & Time */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>📅 בחירת תאריך ושעה</CardTitle>
              <CardDescription>תאריכים אדומים תפוסים ולא ניתנים לבחירה</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              {eventDate && (
                <p className="text-center text-sm">
                  נבחר: <b>{format(eventDate, "EEEE, d בMMMM yyyy", { locale: he })}</b>
                </p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div><Label>שעת התחלה</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
                <div><Label>שעת סיום</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setAvailOpen(true)}>
                <CalendarSearch className="ml-2 w-4 h-4" /> תצוגת כל התאריכים הזמינים
              </Button>
            </CardContent>
          </Card>
        )}

        {/* STEP 3 — Details */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>📝 פרטי הלקוח</CardTitle>
              <CardDescription>פרטים אישיים לחוזה ולחשבונית</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>שם מלא / שם החברה</Label><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="שם פרטי ומשפחה או שם עסק" /></div>
                <div><Label>טלפון</Label><Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="05XXXXXXXX" /></div>
                <div className="md:col-span-2"><Label>אימייל</Label><Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} /></div>
                <div><Label>מס׳ ח.פ / עוסק <span className="text-muted-foreground text-xs">(אופציונלי)</span></Label><Input value={businessId} onChange={(e) => setBusinessId(e.target.value)} placeholder="9 ספרות" /></div>
                <div><Label>שם על החשבונית <span className="text-muted-foreground text-xs">(אופציונלי)</span></Label><Input value={invoiceName} onChange={(e) => setInvoiceName(e.target.value)} placeholder="אם ריק — יופיע השם מלמעלה" /></div>
                <div className="md:col-span-2">
                  <Label>סוג אירוע</Label>
                  <Select value={eventType} onValueChange={setEventType}>
                    <SelectTrigger><SelectValue placeholder="בחרו..." /></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="flex items-center gap-2 p-3 rounded-lg border-2 border-primary/40 bg-primary/5 cursor-pointer hover:bg-primary/10">
                    <Checkbox checked={atVenue} onCheckedChange={(v) => setAtVenue(!!v)} />
                    <span className="font-medium">🏠 האירוע אצלכם — במבורגר הבקתה</span>
                  </label>
                  {!atVenue && (
                    <div><Label>כתובת האירוע</Label><Input value={eventAddress} onChange={(e) => setEventAddress(e.target.value)} placeholder="עיר, רחוב ומספר" /></div>
                  )}
                </div>
              </div>

              {/* Drinks — outside-venue events only. אצלנו במקום השתייה מסופקת ישירות ואין צורך שהלקוח יבחר. */}
              {needsDrinkSelection && (
                <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div>
                    <h3 className="font-bold text-base">🥤 בחירת שתייה לאירוע</h3>
                    <p className="text-xs text-muted-foreground">
                      חלקו את השתייה בין הסוגים לפי טעמכם.
                      סה״כ יחידות צריכות להיות זהות למספר האורחים ({guests}).
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {EVENT_DRINK_OPTIONS.map((d) => (
                      <div key={d.id} className="flex items-center gap-2 p-2 rounded-md border bg-background">
                        <span className="flex-1 text-sm">{d.emoji} {d.name}</span>
                        <Input
                          type="number"
                          min={0}
                          value={drinkSelections[d.id] ?? ""}
                          onChange={(e) => setDrinkQty(d.id, Number(e.target.value))}
                          className="w-20 text-center"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                  <div className={cn(
                    "flex justify-between items-center px-3 py-2 rounded-md text-sm font-bold",
                    drinksTotal === guests ? "bg-green-500/15 text-green-700 dark:text-green-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                  )}>
                    <span>סה״כ יחידות שנבחרו</span>
                    <span>{drinksTotal} / {guests}</span>
                  </div>
                </div>
              )}
              {packageIncludesDrinks && atVenue && (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                  🏠 האירוע מתקיים אצלנו במקום — השתייה תסופק ישירות ואין צורך לבחור מראש.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 4 — Contract */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>📃 חוזה האירוע</CardTitle>
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

        {/* STEP 5 — Signatures */}
        {step === 5 && (
          <Card>
            <CardHeader>
              <CardTitle>✍️ חתימות דיגיטליות</CardTitle>
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
                <Label className="mb-2 block">חתימת בעל העסק (חתומה מראש)</Label>
                <div className="border rounded-lg bg-white flex items-center justify-center h-40">
                  <img
                    src={BUSINESS_SIGNATURE_SRC}
                    alt="חתימת בעל העסק"
                    loading="lazy"
                    className="max-h-32 object-contain"
                  />
                </div>
              </div>
              <Button onClick={submitBooking} disabled={submitting} className="w-full" size="lg">
                {submitting ? "שומר..." : "חתום וסיים"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* STEP 6 — Success */}
        {step === 6 && (
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

        {/* Navigation */}
        {step < 6 && (
          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={prev} disabled={step === 1}>
              <ChevronRight className="ml-1 w-4 h-4" /> חזרה
            </Button>
            {step < 5 && (
              <Button onClick={next}>
                המשך <ChevronLeft className="mr-1 w-4 h-4" />
              </Button>
            )}
          </div>
        )}

        {/* Available dates dialog */}
        <Dialog open={availOpen} onOpenChange={setAvailOpen}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle>🗓️ תאריכים זמינים</DialogTitle>
              <DialogDescription>
                תאריכים <span className="text-destructive font-bold">אדומים</span> תפוסים.
                שאר התאריכים זמינים להזמנה.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={eventDate}
                onSelect={(d) => { if (d && !isDateBlocked(d) && d >= new Date(new Date().setHours(0,0,0,0))) { setEventDate(d); setAvailOpen(false); toast.success("התאריך נשמר, ניתן להמשיך"); } }}
                locale={he}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0)) || isDateBlocked(new Date(d))}
                modifiers={{ blocked: blockedDates }}
                modifiersClassNames={{ blocked: "bg-destructive/20 text-destructive line-through" }}
                className="pointer-events-auto rounded-md border"
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">לחיצה על תאריך זמין תבחר אותו לאירוע שלך</p>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default EventBooking;
