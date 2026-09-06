import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { getDependentDishes, isDishSatisfied, getDishIngredients, SMASH_DISH_IDS } from "@/lib/menuDependencies";
import DayOpenChecklist, { shouldShowDayOpenChecklist } from "@/components/DayOpenChecklist";
import MissingIngredientsDialog, { IngredientOption } from "@/components/MissingIngredientsDialog";


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

const categoryOrder = ["burger", "meal", "side", "topping", "drink", "sauce", "deal", "ingredient"];

const AdminAvailability = () => {
  const [items, setItems] = useState<AvailabilityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChecklist, setShowChecklist] = useState(false);
  const [missingPrompt, setMissingPrompt] = useState<{ dishName: string; ingredients: IngredientOption[] } | null>(null);

  const fetchItems = async () => {
    const { data } = await supabase
      .from("menu_availability")
      .select("*")
      .order("category");
    if (data) {
      setItems(data as AvailabilityItem[]);
      if (shouldShowDayOpenChecklist()) setShowChecklist(true);
    }
    setLoading(false);
  };

  const enableItems = async (itemIds: string[]) => {
    await supabase
      .from("menu_availability")
      .update({ available: true, manually_disabled: false, updated_at: new Date().toISOString() })
      .in("item_id", itemIds);
    setItems((prev) =>
      prev.map((i) => (itemIds.includes(i.item_id) ? { ...i, available: true, manually_disabled: false } : i))
    );
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
            prev.map((item) =>
              item.item_id === updated.item_id
                ? { ...item, available: updated.available, manually_disabled: updated.manually_disabled }
                : item
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // מסנכרן מנות התלויות במרכיב שהשתנה (רקורסיבי – מרכיב יכול להיות גם מנה)
  const syncDependentDishes = async (
    changedItemId: string,
    currentItems: AvailabilityItem[],
    seen: Set<string> = new Set()
  ): Promise<AvailabilityItem[]> => {
    if (seen.has(changedItemId)) return currentItems;
    seen.add(changedItemId);

    const dependents = getDependentDishes(changedItemId);
    let working = currentItems;

    for (const dishId of dependents) {
      const dish = working.find((i) => i.item_id === dishId);
      if (!dish) continue;

      const shouldBeAvailable = isDishSatisfied(dishId, (ingId) => {
        const ing = working.find((i) => i.item_id === ingId);
        return ing ? ing.available : true;
      });

      // אם המנה כובתה ידנית - לא נוגעים בה
      if (dish.manually_disabled) continue;

      if (dish.available !== shouldBeAvailable) {
        await supabase
          .from("menu_availability")
          .update({ available: shouldBeAvailable, updated_at: new Date().toISOString() })
          .eq("item_id", dishId);
        working = working.map((i) => (i.item_id === dishId ? { ...i, available: shouldBeAvailable } : i));
        setItems(working);
        working = await syncDependentDishes(dishId, working, seen);
      }
    }

    return working;
  };

  const setAvailability = async (itemId: string, newValue: boolean, base: AvailabilityItem[]) => {
    const optimisticItems = base.map((item) =>
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
      setItems(base);
      return base;
    }

    return await syncDependentDishes(itemId, optimisticItems);
  };

  const disableIngredients = async (itemIds: string[]) => {
    let working = items;
    for (const id of itemIds) {
      working = await setAvailability(id, false, working);
    }
  };

  const toggleAllSmash = async (turnOff: boolean) => {
    let working = items;
    for (const id of SMASH_DISH_IDS) {
      if (!working.find((i) => i.item_id === id)) continue;
      working = await setAvailability(id, !turnOff, working);
    }
  };

  // מנות שבכיבוי שלהן יודעים בוודאות איזה מרכיב אזל – בלי לשאול
  const AUTO_MISSING_INGREDIENT: Record<string, string> = {
    "smash-double-cheese": "vegan-cheddar",
    "meal-smash-double-cheese": "vegan-cheddar",
  };

  const toggleAvailability = async (itemId: string, currentValue: boolean) => {
    const newValue = !currentValue;
    const updated = await setAvailability(itemId, newValue, items);

    if (!newValue) {
      // כיבוי דאבל צ'יז => הצ'דר הטבעוני אזל, ישירות
      const autoId = AUTO_MISSING_INGREDIENT[itemId];
      if (autoId) {
        const ing = updated.find((i) => i.item_id === autoId);
        if (ing?.available) {
          await setAvailability(autoId, false, updated);
        }
        return;
      }

      // כיבוי ידני של מנה מורכבת בזמן שכל המרכיבים דלוקים – נשאל מה חסר
      const deps = getDishIngredients(itemId);
      const availableDeps = deps
        .map((id) => updated.find((i) => i.item_id === id))
        .filter((i): i is AvailabilityItem => !!i && i.available);
      if (availableDeps.length > 0) {
        const dish = updated.find((i) => i.item_id === itemId);
        setMissingPrompt({
          dishName: dish?.item_name || "",
          ingredients: availableDeps.map((i) => ({ item_id: i.item_id, item_name: i.item_name })),
        });
      }
    }
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
      {showChecklist && (
        <DayOpenChecklist
          items={items}
          onEnable={enableItems}
          onClose={() => setShowChecklist(false)}
        />
      )}
      {missingPrompt && (
        <MissingIngredientsDialog
          dishName={missingPrompt.dishName}
          ingredients={missingPrompt.ingredients}
          onConfirm={disableIngredients}
          onClose={() => setMissingPrompt(null)}
        />
      )}
      <div className="max-w-2xl mx-auto px-4 py-8">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-foreground">ניהול זמינות פריטים</h1>
          <p className="text-muted-foreground text-sm mt-2">כבה/הדלק פריטים בזמן אמת</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => toggleAllSmash(true)}
            className="py-3 rounded-xl bg-destructive text-destructive-foreground font-black"
          >
            כבה את כל הסמאשים
          </button>
          <button
            onClick={() => toggleAllSmash(false)}
            className="py-3 rounded-xl bg-green-600 text-white font-black"
          >
            הדלק את כל הסמאשים
          </button>
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
