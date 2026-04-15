import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CartItem } from "@/components/CartDrawer";
import { toppings, removals, smashModifications, mealSideOptions, mealDrinkOptions } from "@/data/menu";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CheckoutFormProps {
  items: CartItem[];
  total: number;
  onClose: () => void;
  onSuccess: () => void;
}

const CheckoutForm = ({ items, total, onClose, onSuccess }: CheckoutFormProps) => {
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [step, setStep] = useState<"phone" | "otp" | "details">("phone");
  const [otpCode, setOtpCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      toast({ title: "אנא הכנס שם מלא", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      // Upsert customer
      await supabase.from("customers").upsert(
        { phone: form.phone, name: form.name },
        { onConflict: "phone" }
      );

      // Create the order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_name: form.name,
          customer_phone: form.phone,
          notes: form.notes || null,
          total,
          status: "new",
        })
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
      onSuccess();
    } catch (error) {
      console.error("Order error:", error);
      toast({ title: "שגיאה בשליחת ההזמנה, נסה שוב", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
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

            <form onSubmit={handleSubmit} className="space-y-4">
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
                  disabled={submitting}
                  className="flex-1 bg-primary text-primary-foreground font-bold py-3 rounded-full disabled:opacity-50"
                >
                  {submitting ? "שולח..." : "שלח הזמנה 🍔"}
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
      </motion.div>
    </motion.div>
  );
};

export default CheckoutForm;
