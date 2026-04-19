import { useState, useEffect, forwardRef } from "react";
import { motion } from "framer-motion";
import { CartItem } from "@/components/CartDrawer";
import { toppings, removals, smashModifications, mealSideOptions, mealDrinkOptions } from "@/data/menu";
import { shouldChargeMealUpgrade, MEAL_UPGRADE_PRICE } from "@/lib/cartPricing";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantStatus } from "@/hooks/useRestaurantStatus";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { Banknote, CreditCard, Store } from "lucide-react";
import TermsModal from "@/components/TermsModal";
import PrivacyModal from "@/components/PrivacyModal";
import { RUNTIME_FLAGS } from "@/config/runtimeFlags";

export interface CheckoutSauce {
  id: string;
  name: string;
  quantity: number;
}

interface CheckoutFormProps {
  items: CartItem[];
  total: number;
  sauces?: CheckoutSauce[];
  freeSauces?: number;
  onClose: () => void;
  onSuccess: (orderNumber?: number, phone?: string) => void;
}

const CheckoutForm = forwardRef<HTMLDivElement, CheckoutFormProps>(({ items, total, sauces = [], freeSauces = 0, onClose, onSuccess }, ref) => {
  // Lock background scroll while the checkout modal is mounted (iOS-safe).
  useBodyScrollLock(true);
  const { customer, isLoggedIn } = useCustomerAuth();
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [step, setStep] = useState<"phone" | "otp" | "details" | "payment">("phone");
  const [otpCode, setOtpCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit" | "counter" | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const { status: restaurantStatus } = useRestaurantStatus();
  // Kiosk context → larger touch-friendly checkbox + modal
  const isKiosk = typeof window !== "undefined" && window.location.pathname === "/kiosk";

  // ─── Temporary soft-launch flow ───────────────────────────────────────────
  // Kiosk: never collect a phone number → start at the details step.
  // Website: skip OTP entirely → start at details (still collect phone there).
  // Logged-in customers always skip straight to details (existing behavior).
  useEffect(() => {
    if (isLoggedIn && customer) {
      setForm(prev => ({ ...prev, name: customer.name, phone: customer.phone }));
      setCustomerName(customer.name);
      setStep("details");
      return;
    }
    if (isKiosk && RUNTIME_FLAGS.KIOSK_SKIP_PHONE) {
      setStep("details");
      return;
    }
    if (!isKiosk && RUNTIME_FLAGS.WEBSITE_SKIP_OTP) {
      setStep("details");
    }
  }, [isLoggedIn, customer, isKiosk]);

  const handleSendOtp = async () => {
    if (!form.phone || form.phone.replace(/[-\s]/g, '').length < 9) {
      toast({ title: "אנא הכנס מספר טלפון תקין", variant: "destructive" });
      return;
    }

    setSendingOtp(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp-otp?action=send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ phone: form.phone }),
        }
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "שגיאה בשליחת הקוד");
      }

      if (result.customerName) {
        setCustomerName(result.customerName);
        setForm(prev => ({ ...prev, name: result.customerName }));
      }

      toast({ title: "הקוד נשלח לוואטסאפ! 📱" });
      setStep("otp");
    } catch (error: any) {
      console.error("OTP error:", error);
      toast({ title: error.message || "שגיאה בשליחת הקוד", variant: "destructive" });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 4) {
      toast({ title: "אנא הכנס קוד בן 4 ספרות", variant: "destructive" });
      return;
    }

    setVerifying(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp-otp?action=verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ phone: form.phone, code: otpCode }),
        }
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "קוד שגוי");
      }

      toast({ title: "אומת בהצלחה! ✅" });
      setStep("details");
    } catch (error: any) {
      console.error("Verify error:", error);
      toast({ title: error.message || "קוד שגוי", variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "אנא הכנס שם מלא", variant: "destructive" });
      return;
    }
    // Website (no logged-in user, OTP skipped) → phone is required.
    // Kiosk → phone field is hidden, no validation.
    if (!isKiosk && RUNTIME_FLAGS.WEBSITE_SKIP_OTP && !isLoggedIn) {
      const cleaned = form.phone.replace(/[-\s]/g, "");
      if (cleaned.length < 9) {
        toast({ title: "אנא הכנס מספר טלפון תקין", variant: "destructive" });
        return;
      }
    }
    setStep("payment");
  };

  const handlePaymentSelect = async (method: "cash" | "credit" | "counter") => {
    // Guard against double-clicks while a previous submission is in flight
    if (submitting) return;
    // Hard gate: terms + privacy must be accepted before any payment can proceed
    if (!termsAccepted) {
      toast({
        title: "יש לאשר תנאי שימוש ומדיניות פרטיות לפני המשך",
        variant: "destructive",
      });
      return;
    }
    setPaymentMethod(method);

    if (method === "credit") {
      await handleCreditPayment();
      return;
    }

    // Cash or counter — submit order immediately (no online payment).
    await submitOrder(method);
  };

  // Map a cart item to the create-order Edge Function payload.
  // Includes Hebrew names for removals/dealBurger removals so they're stored as-is.
  const buildServerItem = (item: CartItem) => {
    const removalNames = item.removals
      .map((rId) => removals.find((r) => r.id === rId)?.name || smashModifications.find((r) => r.id === rId)?.name)
      .filter(Boolean) as string[];
    // `id` may be a unique cart key like `classic-1776430479457`. Use `menuItemId` as the
    // canonical pricing id; fall back to `id` for legacy carts that don't have it.
    const menuItemId = (item as CartItem & { menuItemId?: string }).menuItemId ?? item.id;
    // Owner name is shown on the printed receipt only — we encode it as a
    // sentinel-prefixed entry inside removalNames (which the receipt builder
    // already iterates over). The receipt extracts and removes it before
    // rendering. Stored as text only — no DB schema change required.
    const ownerName = (item as CartItem & { ownerName?: string }).ownerName?.trim();
    const removalNamesWithOwner = ownerName
      ? [`__OWNER__:${ownerName}`, ...removalNames]
      : removalNames;
    return {
      itemId: menuItemId,
      quantity: item.quantity,
      toppings: item.toppings,
      removals: item.removals,
      removalNames: removalNamesWithOwner,
      withMeal: item.withMeal,
      mealSideId: item.mealSideId ?? null,
      mealDrinkId: item.mealDrinkId ?? null,
      dealBurgers: item.dealBurgers
        ? item.dealBurgers.map((b) => ({
            name: b.name,
            removals: b.removals ?? [],
            removalNames: (b.removals ?? [])
              .map((rId) => removals.find((r) => r.id === rId)?.name || smashModifications.find((r) => r.id === rId)?.name)
              .filter(Boolean) as string[],
          }))
        : null,
      dealDrinks: item.dealDrinks
        ? item.dealDrinks.map((d) => ({ optionId: d.id }))
        : null,
    };
  };

  const callCreateOrder = async (paymentMethod: "cash" | "credit" | "counter", status: "new" | "pending_payment") => {
    const isStation = localStorage.getItem("habakta_station") === "true";
    const isKioskPath = typeof window !== "undefined" && window.location.pathname === "/kiosk";
    const orderSource: "website" | "kiosk" | "station" = isKioskPath
      ? "kiosk"
      : isStation
      ? "station"
      : "website";

    const { data, error } = await supabase.functions.invoke("create-order", {
      body: {
        customerName: form.name,
        // Kiosk skip-phone flow: send empty string; server normalizes to placeholder.
        customerPhone: (isKioskPath && RUNTIME_FLAGS.KIOSK_SKIP_PHONE) ? "" : form.phone,
        notes: form.notes || null,
        paymentMethod,
        orderSource,
        status,
        // Server-recorded proof that the customer accepted the terms at order time
        termsAcceptedAt: new Date().toISOString(),
        items: items.map(buildServerItem),
        // Sauces (chef-summary only): qty per sauce + how many were free.
        // Server adds extra-sauce charge to the total and stores them as a
        // synthetic "רטבים" line so the kitchen receipt shows them.
        sauces: sauces
          .filter((s) => s.quantity > 0)
          .map((s) => ({ id: s.id, name: s.name, quantity: s.quantity })),
        freeSauces,
      },
    });

    if (error) {
      // Try to surface server-side error message
      let serverMsg = error.message || "שגיאה ביצירת ההזמנה";
      try {
        const ctx: any = (error as any).context;
        if (ctx && typeof ctx.json === "function") {
          const parsed = await ctx.json();
          if (parsed?.error) serverMsg = parsed.error;
        }
      } catch { /* ignore */ }
      throw new Error(serverMsg);
    }
    if (data?.error) throw new Error(data.error);
    if (!data?.orderId) throw new Error("שגיאה ביצירת ההזמנה");
    return data as { orderId: string; orderNumber: number; total: number };
  };

  const handleCreditPayment = async () => {
    setSubmitting(true);
    try {
      const order = await callCreateOrder("credit", "pending_payment");

      // Build item descriptions for Z-Credit invoice with FULL prices including all add-ons
      const zcreditItems = items.map((item) => {
        let unitPrice = item.price;
        const descParts: string[] = [];

        if (item.dealBurgers) {
          // Deals: price already includes drink extras baked in
          descParts.push("דיל");
        } else {
          // Toppings cost
          const toppingsCost = item.toppings.reduce((s, tId) => {
            const t = toppings.find((tp) => tp.id === tId);
            return s + (t?.price || 0);
          }, 0);
          if (toppingsCost > 0) {
            const counts = new Map<string, number>();
            item.toppings.forEach((tId) => counts.set(tId, (counts.get(tId) || 0) + 1));
            const toppingNames = Array.from(counts.entries())
              .map(([tId, count]) => {
                const name = toppings.find((t) => t.id === tId)?.name;
                if (!name) return null;
                return count > 1 ? `${name} × ${count}` : name;
              })
              .filter(Boolean);
            descParts.push(`תוספות: ${toppingNames.join(", ")}`);
          }
          unitPrice += toppingsCost;

          // Meal upgrade cost — only when upgrading a burger to a meal.
          // Items already in the "meal" category include the upgrade in their base price.
          if (item.withMeal) {
            if (shouldChargeMealUpgrade(item)) {
              unitPrice += MEAL_UPGRADE_PRICE;
            }
            descParts.push("ארוחה");
          }

          // Side upgrade cost
          if (item.mealSideId) {
            const sideOption = mealSideOptions.find(s => s.id === item.mealSideId);
            if (sideOption && sideOption.price > 0) {
              unitPrice += sideOption.price;
              descParts.push(`תוספת צד: ${sideOption.name}`);
            }
          }

          // Drink upgrade cost
          if (item.mealDrinkId) {
            const drinkOption = mealDrinkOptions.find(d => d.id === item.mealDrinkId);
            if (drinkOption && drinkOption.price > 0) {
              unitPrice += drinkOption.price;
              descParts.push(`שתייה: ${drinkOption.name}`);
            }
          }
        }

        return {
          name: item.name,
          price: unitPrice,
          quantity: item.quantity,
          description: descParts.length > 0 ? descParts.join(" | ") : item.name,
        };
      });

      // If total includes extras (like sauces) not in cart items, add a reconciliation line
      const itemsSum = zcreditItems.reduce((s, i) => s + i.price * i.quantity, 0);
      if (total > itemsSum) {
        zcreditItems.push({
          name: "תוספות נוספות",
          price: total - itemsSum,
          quantity: 1,
          description: "רטבים ותוספות",
        });
      }

      const baseUrl = window.location.origin;
      const isKiosk = window.location.pathname === "/kiosk";
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            total: order.total,
            items: zcreditItems,
            customerName: form.name,
            customerPhone: form.phone,
            orderId: order.orderId,
             successUrl: isKiosk
               ? `${baseUrl}/kiosk?paid=true&order=${order.orderNumber}`
               : `${baseUrl}/track?order=${order.orderNumber}&paid=true`,
             cancelUrl: isKiosk ? `${baseUrl}/kiosk?payment=cancelled` : `${baseUrl}/?payment=cancelled`,
            callbackUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payment-callback`,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "שגיאה ביצירת עמוד תשלום");
      }

      // Redirect to Z-Credit payment page
      window.location.href = result.sessionUrl;
    } catch (error: any) {
      console.error("Credit payment error:", error);
      toast({ title: error.message || "שגיאה בתשלום באשראי", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const submitOrder = async (method: "cash" | "credit" | "counter") => {
    setSubmitting(true);
    try {
      const order = await callCreateOrder(method, "new");
      toast({
        title: "ההזמנה נשלחה בהצלחה! 🎉",
        description: `מספר הזמנה: #${order.orderNumber}`,
      });
      onSuccess(order.orderNumber, form.phone);
    } catch (error: any) {
      console.error("Order error:", error);
      toast({ title: error.message || "שגיאה בשליחת ההזמנה, נסה שוב", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const availablePaymentMethods = {
    cash: restaurantStatus.cash_enabled,
    credit: restaurantStatus.credit_enabled,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative bg-card rounded-2xl p-6 w-full max-w-lg border border-border max-h-[90vh] overflow-y-auto"
        dir="rtl"
      >
        <h2 className="text-2xl font-black mb-6">
          {step === "phone" && "הכנס מספר טלפון"}
          {step === "otp" && "הכנס קוד אימות"}
          {step === "details" && "סיום הזמנה"}
          {step === "payment" && "בחר אמצעי תשלום"}
        </h2>

        {/* Step 1: Phone */}
        {step === "phone" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                מספר טלפון <span className="text-destructive">*</span>
              </label>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="050-1234567"
                dir="ltr"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={sendingOtp}
                onClick={handleSendOtp}
                className="flex-1 bg-primary text-primary-foreground font-bold py-3 rounded-full disabled:opacity-50"
              >
                {sendingOtp ? "שולח..." : "שלח קוד אימות 📱"}
              </motion.button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                ביטול
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setForm({ name: "טסט", phone: "0501234567", notes: "" });
                setStep("details");
              }}
              className="w-full text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors underline"
            >
              דלג (מצב בדיקה)
            </button>
          </div>
        )}

        {/* Step 2: OTP */}
        {step === "otp" && (
          <div className="space-y-4">
            {customerName && (
              <p className="text-primary font-bold text-lg">ברוך הבא בחזרה, {customerName}! 👋</p>
            )}
            <p className="text-muted-foreground text-sm">שלחנו קוד בן 4 ספרות לוואטסאפ למספר {form.phone}</p>
            <div>
              <label className="block text-sm font-medium mb-1">קוד אימות</label>
              <input
                type="text"
                maxLength={4}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground text-center text-2xl tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
                dir="ltr"
                placeholder="____"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={verifying}
                onClick={handleVerifyOtp}
                className="flex-1 bg-primary text-primary-foreground font-bold py-3 rounded-full disabled:opacity-50"
              >
                {verifying ? "מאמת..." : "אמת קוד ✅"}
              </motion.button>
              <button
                type="button"
                onClick={() => { setStep("phone"); setOtpCode(""); }}
                className="px-6 py-3 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                חזור
              </button>
            </div>
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={sendingOtp}
              className="text-sm text-muted-foreground hover:text-primary transition-colors underline"
            >
              {sendingOtp ? "שולח..." : "שלח קוד חדש"}
            </button>
          </div>
        )}

        {/* Step 3: Details + Order Summary */}
        {step === "details" && (
          <>
            {customerName && (
              <p className="text-primary font-bold text-lg mb-4">ברוך הבא בחזרה, {customerName}! 👋</p>
            )}

            <div className="mb-6 bg-secondary/50 rounded-lg p-4 space-y-1">
              {items.map((item) => {
                const tCounts = new Map<string, number>();
                item.toppings.forEach((tId) => tCounts.set(tId, (tCounts.get(tId) || 0) + 1));
                const toppingNames = Array.from(tCounts.entries())
                  .map(([tId, count]) => {
                    const name = toppings.find((t) => t.id === tId)?.name;
                    if (!name) return null;
                    return count > 1 ? `${name} × ${count}` : name;
                  })
                  .filter(Boolean);
                return (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>
                      {item.name} x{item.quantity}
                      {toppingNames.length > 0 && (
                        <span className="text-muted-foreground"> ({toppingNames.join(", ")})</span>
                      )}
                    </span>
                  </div>
                );
              })}
              <div className="border-t border-border pt-2 mt-2 flex justify-between font-bold">
                <span>סה״כ</span>
                <span className="text-primary">₪{total}</span>
              </div>
            </div>

            <form onSubmit={handleDetailsSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  שם מלא <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">הערות</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  rows={2}
                  placeholder="הערות להזמנה"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 bg-primary text-primary-foreground font-bold py-3 rounded-full"
                >
                  המשך לתשלום 💳
                </motion.button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  ביטול
                </button>
              </div>
            </form>
          </>
        )}

        {/* Step 4: Payment Method */}
        {step === "payment" && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm mb-2">סה״כ לתשלום: <span className="text-primary font-bold text-lg">₪{total}</span></p>

            {/* Required terms acceptance — gates both payment buttons */}
            <label
              className={`flex items-start gap-3 rounded-xl border-2 transition-colors cursor-pointer select-none ${
                isKiosk ? "p-5" : "p-4"
              } ${
                termsAccepted
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-secondary/40 hover:border-primary/30"
              }`}
            >
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                aria-label="אישור תנאי שימוש"
                className={`mt-0.5 shrink-0 rounded border-border accent-primary cursor-pointer ${
                  isKiosk ? "w-7 h-7" : "w-5 h-5"
                }`}
              />
              <span className={`text-foreground ${isKiosk ? "text-lg leading-relaxed" : "text-sm leading-relaxed"}`}>
                {isKiosk ? "מאשר/ת " : "קראתי ואני מסכים/ה ל"}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setTermsModalOpen(true);
                  }}
                  className="text-primary hover:opacity-80 underline font-semibold mx-1"
                >
                  תנאי השימוש
                </button>
                ול
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setPrivacyModalOpen(true);
                  }}
                  className="text-primary hover:opacity-80 underline font-semibold mx-1"
                >
                  מדיניות הפרטיות
                </button>
                <span className="text-destructive">*</span>
              </span>
            </label>

            <div className="grid grid-cols-1 gap-3">
              {availablePaymentMethods.cash && (
                <motion.button
                  whileHover={!submitting && termsAccepted ? { scale: 1.02 } : undefined}
                  whileTap={!submitting && termsAccepted ? { scale: 0.98 } : undefined}
                  onClick={() => handlePaymentSelect("cash")}
                  disabled={submitting || !termsAccepted}
                  aria-busy={submitting && paymentMethod === "cash"}
                  aria-disabled={!termsAccepted}
                  title={!termsAccepted ? "יש לאשר את תנאי השימוש כדי להמשיך" : undefined}
                  className="flex items-center gap-4 p-5 rounded-xl border-2 border-border bg-secondary hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border"
                >
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Banknote size={24} className="text-green-400" />
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg text-foreground">
                      {submitting && paymentMethod === "cash" ? "שולח הזמנה..." : "מזומן 💵"}
                    </div>
                    <div className="text-sm text-muted-foreground">תשלום במזומן בעת המסירה</div>
                  </div>
                </motion.button>
              )}

              {availablePaymentMethods.credit && (
                <motion.button
                  whileHover={!submitting && termsAccepted ? { scale: 1.02 } : undefined}
                  whileTap={!submitting && termsAccepted ? { scale: 0.98 } : undefined}
                  onClick={() => handlePaymentSelect("credit")}
                  disabled={submitting || !termsAccepted}
                  aria-busy={submitting && paymentMethod === "credit"}
                  aria-disabled={!termsAccepted}
                  title={!termsAccepted ? "יש לאשר את תנאי השימוש כדי להמשיך" : undefined}
                  className="flex items-center gap-4 p-5 rounded-xl border-2 border-border bg-secondary hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <CreditCard size={24} className="text-blue-400" />
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg text-foreground">
                      {submitting && paymentMethod === "credit" ? "מעביר לתשלום..." : "אשראי 💳"}
                    </div>
                    <div className="text-sm text-muted-foreground">תשלום מאובטח בכרטיס אשראי</div>
                  </div>
                </motion.button>
              )}

              {!availablePaymentMethods.cash && !availablePaymentMethods.credit && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-lg font-bold">אין אמצעי תשלום זמינים כרגע</p>
                  <p className="text-sm mt-1">אנא נסה שוב מאוחר יותר</p>
                </div>
              )}
            </div>

            {submitting && (
              <div className="text-center text-primary font-bold py-2">שולח הזמנה...</div>
            )}

            <button
              type="button"
              onClick={() => setStep("details")}
              className="w-full px-6 py-3 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors text-center"
            >
              חזור
            </button>
          </div>
        )}
      </motion.div>

      {/* Terms + Privacy modals — rendered inside the checkout overlay so they stack above it */}
      <TermsModal open={termsModalOpen} onClose={() => setTermsModalOpen(false)} isKiosk={isKiosk} />
      <PrivacyModal open={privacyModalOpen} onClose={() => setPrivacyModalOpen(false)} isKiosk={isKiosk} />
    </motion.div>
  );
});

CheckoutForm.displayName = "CheckoutForm";

export default CheckoutForm;
