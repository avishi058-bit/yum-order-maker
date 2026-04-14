import { useState } from "react";
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
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.address) {
      toast({ title: "אנא מלא את כל השדות", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      // Create the order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_name: form.name,
          customer_phone: form.phone,
          customer_address: form.address,
          notes: form.notes || null,
          total,
          status: "new",
        })
        .select("id")
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

      toast({ title: "ההזמנה נשלחה בהצלחה! 🎉" });
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
        <h2 className="text-2xl font-black mb-6">סיום הזמנה</h2>

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
            <label className="block text-sm font-medium mb-1">שם מלא</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="ישראל ישראלי"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">טלפון</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="050-1234567"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">כתובת למשלוח</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="הכתובת שלך"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">הערות</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              rows={2}
              placeholder="ללא בצל, תודה"
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
      </motion.div>
    </motion.div>
  );
};

export default CheckoutForm;
