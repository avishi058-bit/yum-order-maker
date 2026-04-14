import { useState } from "react";
import { motion } from "framer-motion";
import { CartItem } from "@/components/CartDrawer";
import { toppings, removals, smashModifications, mealSideOptions, mealDrinkOptions } from "@/data/menu";
import { toast } from "@/hooks/use-toast";

interface CheckoutFormProps {
  items: CartItem[];
  total: number;
  onClose: () => void;
  onSuccess: () => void;
}

const CheckoutForm = ({ items, total, onClose, onSuccess }: CheckoutFormProps) => {
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.address) {
      toast({ title: "אנא מלא את כל השדות", variant: "destructive" });
      return;
    }

    const orderText = items
      .map((item) => {
        if (item.dealBurgers) {
          let line = `דיל חברים x${item.quantity}`;
          item.dealBurgers.forEach((burger, i) => {
            const rNames = burger.removals
              .map((rId) => removals.find((r) => r.id === rId)?.name || smashModifications.find((r) => r.id === rId)?.name)
              .filter(Boolean);
            line += `\n  המבורגר ${i + 1}${rNames.length ? ` (${rNames.join(", ")})` : ""}`;
          });
          line += `\n  צ׳יפס ענק`;
          item.dealDrinks?.forEach((drink, i) => {
            line += `\n  שתייה ${i + 1}: ${drink.name}${drink.extraCost > 0 ? ` (+₪${drink.extraCost})` : ""}`;
          });
          return line;
        }
        const toppingNames = item.toppings
          .map((tId) => toppings.find((t) => t.id === tId)?.name)
          .filter(Boolean);
        const removalNames = item.removals
          .map((rId) => removals.find((r) => r.id === rId)?.name || smashModifications.find((r) => r.id === rId)?.name)
          .filter(Boolean);
        let line = `${item.name} x${item.quantity}`;
        if (item.withMeal) {
          const sideName = item.mealSideId ? mealSideOptions.find(s => s.id === item.mealSideId)?.name : "צ׳יפס רגיל";
          const drinkName = item.mealDrinkId ? mealDrinkOptions.find(d => d.id === item.mealDrinkId)?.name : "קולה";
          line += ` (ארוחה עסקית - ${sideName}, ${drinkName})`;
        }
        if (removalNames.length) line += ` (${removalNames.join(", ")})`;
        if (toppingNames.length) line += ` + ${toppingNames.join(", ")}`;
        return line;
      })
      .join("\n");

    const message = `🍔 הזמנה חדשה מהבקתה!\n\nשם: ${form.name}\nטלפון: ${form.phone}\nכתובת: ${form.address}\n${form.notes ? `הערות: ${form.notes}\n` : ""}\nפריטים:\n${orderText}\n\nסה״כ: ₪${total}`;

    const whatsappUrl = `https://wa.me/9720584633555?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");

    toast({ title: "ההזמנה נשלחת בוואטסאפ! 🎉" });
    onSuccess();
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
          <p className="text-xs text-muted-foreground text-center">
            📱 ההזמנה תישלח בוואטסאפ למספר 058-4633-555
          </p>
          <div className="flex gap-3 pt-2">
            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 bg-primary text-primary-foreground font-bold py-3 rounded-full"
            >
              שלח הזמנה בוואטסאפ
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
