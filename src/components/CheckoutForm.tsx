import { useState, useEffect, forwardRef } from "react";
import { motion } from "framer-motion";
import { CartItem } from "@/components/CartDrawer";
import { toppings, removals, smashModifications, mealSideOptions, mealDrinkOptions } from "@/data/menu";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantStatus } from "@/hooks/useRestaurantStatus";
import { Banknote, CreditCard } from "lucide-react";

interface CheckoutFormProps {
  items: CartItem[];
  total: number;
  onClose: () => void;
  onSuccess: (orderNumber?: number) => void;
}

const CheckoutForm = forwardRef<HTMLDivElement, CheckoutFormProps>(({ items, total, onClose, onSuccess }, ref) => {
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [step, setStep] = useState<"phone" | "otp" | "details" | "payment">("phone");
  const [otpCode, setOtpCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit" | null>(null);
  const { status: restaurantStatus } = useRestaurantStatus();

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
    if (!form.name) {
      toast({ title: "אנא הכנס שם מלא", variant: "destructive" });
      return;
    }
    setStep("payment");
  };

  const handlePaymentSelect = async (method: "cash" | "credit") => {
    setPaymentMethod(method);

    if (method === "credit") {
      await handleCreditPayment();
      return;
    }

    // Cash - submit order
    await submitOrder(method);
  };

  const handleCreditPayment = async () => {
    setSubmitting(true);
    try {
      // First create the order in DB
      await supabase.from("customers").upsert(
        { phone: form.phone, name: form.name },
        { onConflict: "phone" }
      );

      const isStation = localStorage.getItem("habakta_station") === "true";
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_name: form.name,
          customer_phone: form.phone,
          notes: form.notes || null,
          total,
          status: "pending_payment",
          payment_method: "credit",
          order_source: isStation ? "station" : "website",
        } as any)
        .select("id, order_number")
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map((item) => {
        const toppingNames = item.toppings
          .map((tId) => toppings.find((t) => t.id === tId)?.name)
          .filter(Boolean) as string[];
        const removalNames = item.removals
          .map((rId) => removals.find((r) => r.id === rId)?.name || smashModifications.find((r) => r.id === rId)?.name)
          .filter(Boolean) as string[];

        return {
          order_id: order.id,
          item_name: item.name,
          price: item.price,
          quantity: item.quantity,
          toppings: toppingNames,
          removals: removalNames,
          with_meal: item.withMeal,
          meal_side: item.mealSideId ? (mealSideOptions.find(s => s.id === item.mealSideId)?.name || null) : null,
          meal_drink: item.mealDrinkId ? (mealDrinkOptions.find(d => d.id === item.mealDrinkId)?.name || null) : null,
          deal_burgers: item.dealBurgers ? JSON.parse(JSON.stringify(item.dealBurgers)) : null,
          deal_drinks: item.dealDrinks ? JSON.parse(JSON.stringify(item.dealDrinks)) : null,
        };
      });

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

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
            const toppingNames = item.toppings
              .map(tId => toppings.find(t => t.id === tId)?.name)
              .filter(Boolean);
            descParts.push(`תוספות: ${toppingNames.join(", ")}`);
          }
          unitPrice += toppingsCost;

          // Meal upgrade cost
          if (item.withMeal) {
            unitPrice += 23;
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
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            total,
            items: zcreditItems,
            customerName: form.name,
            customerPhone: form.phone,
            orderId: order.id,
            successUrl: `${baseUrl}/track?order=${order.order_number}&paid=true`,
            cancelUrl: `${baseUrl}/?payment=cancelled`,
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

  const submitOrder = async (method: "cash" | "credit") => {
    setSubmitting(true);

    try {
      // Upsert customer
      await supabase.from("customers").upsert(
        { phone: form.phone, name: form.name },
        { onConflict: "phone" }
      );

      // Create the order
      const isStation = localStorage.getItem("habakta_station") === "true";
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_name: form.name,
          customer_phone: form.phone,
          notes: form.notes || null,
          total,
          status: "new",
          payment_method: method,
          order_source: isStation ? "station" : "website",
        } as any)
        .select("id, order_number")
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map((item) => {
        const toppingNames = item.toppings
          .map((tId) => toppings.find((t) => t.id === tId)?.name)
          .filter(Boolean) as string[];
        const removalNames = item.removals
          .map((rId) => removals.find((r) => r.id === rId)?.name || smashModifications.find((r) => r.id === rId)?.name)
          .filter(Boolean) as string[];

        return {
          order_id: order.id,
          item_name: item.name,
          price: item.price,
          quantity: item.quantity,
          toppings: toppingNames,
          removals: removalNames,
          with_meal: item.withMeal,
          meal_side: item.mealSideId ? (mealSideOptions.find(s => s.id === item.mealSideId)?.name || null) : null,
          meal_drink: item.mealDrinkId ? (mealDrinkOptions.find(d => d.id === item.mealDrinkId)?.name || null) : null,
          deal_burgers: item.dealBurgers ? JSON.parse(JSON.stringify(item.dealBurgers)) : null,
          deal_drinks: item.dealDrinks ? JSON.parse(JSON.stringify(item.dealDrinks)) : null,
        };
      });

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      toast({
        title: "ההזמנה נשלחה בהצלחה! 🎉",
        description: `מספר הזמנה: #${order.order_number}`,
      });
      window.open(`/track?order=${order.order_number}`, "_blank");
      onSuccess(order.order_number);
    } catch (error) {
      console.error("Order error:", error);
      toast({ title: "שגיאה בשליחת ההזמנה, נסה שוב", variant: "destructive" });
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
                const toppingNames = item.toppings
                  .map((tId) => toppings.find((t) => t.id === tId)?.name)
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

            <div className="grid grid-cols-1 gap-3">
              {availablePaymentMethods.cash && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handlePaymentSelect("cash")}
                  disabled={submitting}
                  className="flex items-center gap-4 p-5 rounded-xl border-2 border-border bg-secondary hover:border-primary transition-colors disabled:opacity-50"
                >
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Banknote size={24} className="text-green-400" />
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg text-foreground">מזומן 💵</div>
                    <div className="text-sm text-muted-foreground">תשלום במזומן בעת המסירה</div>
                  </div>
                </motion.button>
              )}

              {availablePaymentMethods.credit && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handlePaymentSelect("credit")}
                  disabled={submitting}
                  className="flex items-center gap-4 p-5 rounded-xl border-2 border-border bg-secondary hover:border-primary transition-colors disabled:opacity-50"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <CreditCard size={24} className="text-blue-400" />
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg text-foreground">אשראי 💳</div>
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
    </motion.div>
  );
});

CheckoutForm.displayName = "CheckoutForm";

export default CheckoutForm;
