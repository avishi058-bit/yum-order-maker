import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { MENU_DEPENDENCIES, getDependentDishes } from "@/lib/menuDependencies";

interface AvailabilityItem {
  id: string;
  item_id: string;
  item_name: string;
  category: string;
  available: boolean;
  manually_disabled?: boolean;
}

const categoryLabels: Record<string, string> = {
  burger: "🍔 המבורגרים",
  meal: "🍽️ ארוחות עסקיות",
  side: "🍟 צ׳יפס ותוספות",
  drink: "🍺 שתייה",
  deal: "🤝 דילים",
  topping: "🧀 תוספות על ההמבורגר",
  sauce: "🥫 רטבים",
  ingredient: "🥬 ירקות ורטבים",
};

const categoryOrder = ["burger", "meal", "side", "drink", "deal", "topping", "sauce", "ingredient"];

const AdminAvailability = () => {
  const [items, setItems] = useState<AvailabilityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    const { data } = await supabase
      .from("menu_availability")
      .select("*")
      .order("category");
    if (data) {
      setItems(data as AvailabilityItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();

    const channel = supabase
      .channel("admin-availability")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "menu_availability" },
        (payload) => {
          const updated = payload.new as AvailabilityItem;
          setItems((prev) =>
            prev.map((item) => (item.item_id === updated.item_id ? { ...item, available: updated.available } : item))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const syncDependentDishes = async (changedItemId: string, currentItems: AvailabilityItem[]) => {
    const dependents = getDependentDishes(changedItemId);
    if (dependents.length === 0) return;

    for (const dishId of dependents) {
      const dish = currentItems.find((i) => i.item_id === dishId);
      if (!dish) continue;

      const ingredientIds = MENU_DEPENDENCIES[dishId] || [];
      const allIngredientsAvailable = ingredientIds.every((ingId) => {
        const ing = currentItems.find((i) => i.item_id === ingId);
        return ing ? ing.available : true;
      });

      // אם המנה כובתה ידנית - לא נוגעים בה
      if (dish.manually_disabled && !allIngredientsAvailable) continue;
      if (dish.manually_disabled && allIngredientsAvailable) continue;

      const shouldBeAvailable = allIngredientsAvailable;
      if (dish.available !== shouldBeAvailable) {
        await supabase
          .from("menu_availability")
          .update({ available: shouldBeAvailable, updated_at: new Date().toISOString() })
          .eq("item_id", dishId);
      }
    }
  };

  const toggleAvailability = async (itemId: string, currentValue: boolean) => {
    const newValue = !currentValue;

    // Optimistic update - מסמן manually_disabled לפי הפעולה הידנית
    const optimisticItems = items.map((item) =>
      item.item_id === itemId ? { ...item, available: newValue, manually_disabled: !newValue } : item
    );
    setItems(optimisticItems);

    const { error } = await supabase
      .from("menu_availability")
      .update({
        available: newValue,
        manually_disabled: !newValue,
        updated_at: new Date().toISOString(),
      })
      .eq("item_id", itemId);

    if (error) {
      setItems((prev) =>
        prev.map((item) => (item.item_id === itemId ? { ...item, available: currentValue } : item))
      );
      return;
    }

    // החלת לוגיקת תלויות על מנות שמכילות את המרכיב הזה
    await syncDependentDishes(itemId, optimisticItems);
  };

  const grouped = categoryOrder
    .map((cat) => ({
      category: cat,
      label: categoryLabels[cat] || cat,
      items: items.filter((i) => i.category === cat),
    }))
    .filter((g) => g.items.length > 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <p className="text-muted-foreground text-lg">טוען...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-foreground">ניהול זמינות פריטים</h1>
          <p className="text-muted-foreground text-sm mt-2">כבה/הדלק פריטים בזמן אמת</p>
        </div>

        {grouped.map((group) => (
          <div key={group.category} className="mb-8">
            <h2 className="text-xl font-bold text-primary mb-3">{group.label}</h2>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {group.items.map((item, i) => (
                <motion.div
                  key={item.item_id}
                  className={`flex items-center justify-between px-4 py-3.5 ${
                    i < group.items.length - 1 ? "border-b border-border/50" : ""
                  }`}
                >
                  <button
                    onClick={() => toggleAvailability(item.item_id, item.available)}
                    className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                      item.available ? "bg-green-500" : "bg-muted"
                    }`}
                  >
                    <motion.div
                      className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md"
                      animate={{ left: item.available ? "1.5rem" : "0.125rem" }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${!item.available ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {item.item_name}
                    </span>
                    {!item.available && (
                      <span className="text-[10px] font-bold bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full">
                        אזל
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminAvailability;
