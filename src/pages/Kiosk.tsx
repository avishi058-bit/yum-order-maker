import { useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag, ArrowRight } from "lucide-react";
import KioskWelcome from "@/components/KioskWelcome";
import CartDrawer, { CartItem, DealBurgerConfig, DealDrinkChoice } from "@/components/CartDrawer";
import CheckoutForm from "@/components/CheckoutForm";
import ItemCustomizer from "@/components/ItemCustomizer";
import DealCustomizer from "@/components/DealCustomizer";
import FamilyDealCustomizer from "@/components/FamilyDealCustomizer";
import DrinkSelector from "@/components/DrinkSelector";
import SauceSelector from "@/components/SauceSelector";
import ItemPreview from "@/components/ItemPreview";
import { MenuItem, menuItems, toppings, mealSideOptions, mealDrinkOptions, drinkSubOptions } from "@/data/menu";
import { menuImages } from "@/data/menuImages";
import { useAvailability } from "@/hooks/useAvailability";
import { useRestaurantStatus } from "@/hooks/useRestaurantStatus";
import { Star } from "lucide-react";

const categories = [
  { key: "burger" as const, label: "🍔 המבורגרים" },
  { key: "meal" as const, label: "🍽️ ארוחות עסקיות" },
  { key: "side" as const, label: "🍟 תוספות" },
  { key: "drink" as const, label: "🍺 שתייה" },
  { key: "deal" as const, label: "🤝 דילים" },
];

const needsCustomization = (item: MenuItem) =>
  item.category === "burger" || item.category === "meal" || item.id === "friends-deal" || item.id === "family-deal" || (item.category === "drink" && !!drinkSubOptions[item.id]);

type KioskView = "welcome" | "menu" | "cart";

const Kiosk = () => {
  const { isAvailable } = useAvailability();
  const { status: restaurantStatus } = useRestaurantStatus();
  const isClosed = !restaurantStatus.station_open;

  const [view, setView] = useState<KioskView>("welcome");
  const [activeCategory, setActiveCategory] = useState<string>("burger");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customizerItem, setCustomizerItem] = useState<MenuItem | null>(null);
  const [dealOpen, setDealOpen] = useState(false);
  const [familyDealOpen, setFamilyDealOpen] = useState(false);
  const [drinkItem, setDrinkItem] = useState<MenuItem | null>(null);
  const [dineIn, setDineIn] = useState(true);
  const [sauceSelectorOpen, setSauceSelectorOpen] = useState(false);
  const [selectedSauces, setSelectedSauces] = useState<{ id: string; name: string; quantity: number }[]>([]);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<MenuItem | null>(null);
  const cartButtonRef = useRef<HTMLDivElement>(null);
  const handleAddItem = useCallback((item: MenuItem) => {
    if (item.id === "friends-deal") {
      setDealOpen(true);
    } else if (item.id === "family-deal") {
      setFamilyDealOpen(true);
    } else if (item.category === "burger" || item.category === "meal") {
      setCustomizerItem(item);
    } else if (item.category === "drink" && drinkSubOptions[item.id]) {
      setDrinkItem(item);
    } else {
      // Simple items (sides, simple drinks) → open preview
      setPreviewItem(item);
    }
  }, []);

  const handlePreviewAdd = useCallback((item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) => (c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1, toppings: [], removals: [], withMeal: false }];
    });
    setJustAddedId(item.id);
    setTimeout(() => setJustAddedId(null), 1200);
  }, []);

  const handleCustomizerConfirm = useCallback(
    (item: MenuItem, quantity: number, selectedToppings: string[], selectedRemovals: string[], withMeal: boolean, mealSideId?: string, mealDrinkId?: string) => {
      const cartItemId = `${item.id}-${Date.now()}`;
      setCart((prev) => [
        ...prev,
        { id: cartItemId, name: item.name, price: item.price, quantity, toppings: selectedToppings, removals: selectedRemovals, withMeal, mealSideId, mealDrinkId },
      ]);
      setCustomizerItem(null);
    },
    []
  );

  const handleDealConfirm = useCallback((burgers: DealBurgerConfig[], drinks: DealDrinkChoice[]) => {
    const drinksExtra = drinks.reduce((sum, d) => sum + d.extraCost, 0);
    setCart((prev) => [
      ...prev,
      { id: `friends-deal-${Date.now()}`, name: "דיל חברים", price: 216 + drinksExtra, quantity: 1, toppings: [], removals: [], withMeal: false, dealBurgers: burgers, dealDrinks: drinks },
    ]);
    setDealOpen(false);
  }, []);

  const handleFamilyDealConfirm = useCallback((burgers: DealBurgerConfig[], drinks: DealDrinkChoice[]) => {
    const drinksExtra = drinks.reduce((sum, d) => sum + d.extraCost, 0);
    setCart((prev) => [
      ...prev,
      { id: `family-deal-${Date.now()}`, name: "דיל משפחתי", price: 300 + drinksExtra, quantity: 1, toppings: [], removals: [], withMeal: false, dealBurgers: burgers, dealDrinks: drinks.length > 0 ? drinks : undefined },
    ]);
    setFamilyDealOpen(false);
  }, []);

  const handleDrinkConfirm = useCallback((item: MenuItem, selectedDrink: string) => {
    setDrinkItem(null);
    // Show preview with the selected drink variant
    setPreviewItem({
      ...item,
      id: `${item.id}-${selectedDrink}-${Date.now()}`,
      name: `${item.name} — ${selectedDrink}`,
    });
  }, []);

  const updateQuantity = useCallback((id: string, delta: number) => {
    setCart((prev) => prev.map((c) => (c.id === id ? { ...c, quantity: c.quantity + delta } : c)).filter((c) => c.quantity > 0));
  }, []);

  const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);
  const burgerCount = cart.reduce((sum, item) => {
    if (item.dealBurgers) return sum + item.dealBurgers.length * item.quantity;
    const menuItem = menuItems.find((m) => m.name === item.name || item.id.startsWith(m.id));
    if (menuItem && (menuItem.category === "burger" || menuItem.category === "meal")) return sum + item.quantity;
    return sum;
  }, 0);
  const freeSauces = burgerCount * 3;

  const getTotal = () => {
    let base = cart.reduce((sum, item) => {
      if (item.dealBurgers) return sum + item.price * item.quantity;
      const toppingsCost = item.toppings.reduce((s, tId) => {
        const t = toppings.find((tp) => tp.id === tId);
        return s + (t?.price || 0);
      }, 0);
      const mealCost = item.withMeal ? 23 : 0;
      const sideCost = item.mealSideId ? (mealSideOptions.find((s) => s.id === item.mealSideId)?.price || 0) : 0;
      const drinkCost = item.mealDrinkId ? (mealDrinkOptions.find((d) => d.id === item.mealDrinkId)?.price || 0) : 0;
      return sum + (item.price + toppingsCost + mealCost + sideCost + drinkCost) * item.quantity;
    }, 0);
    if (!dineIn && selectedSauces.length > 0) {
      const totalSauceQty = selectedSauces.reduce((sum, s) => sum + s.quantity, 0);
      base += Math.max(0, totalSauceQty - freeSauces);
    }
    return base;
  };

  const resetOrder = () => {
    setCart([]);
    setView("welcome");
    setActiveCategory("burger");
    setDineIn(true);
    setSelectedSauces([]);
  };

  const filteredItems = menuItems.filter((i) => i.category === activeCategory && isAvailable(i.id));

  if (isClosed) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center text-center p-8" dir="rtl">
        <p className="text-8xl mb-8">🔒</p>
        <p className="text-4xl font-black text-foreground mb-4">ההזמנות סגורות כרגע</p>
        <p className="text-2xl text-muted-foreground">נחזור בקרוב!</p>
      </div>
    );
  }

  if (view === "welcome") {
    return <KioskWelcome onStart={() => setView("menu")} />;
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden" dir="rtl">
      {/* Top bar */}
      <div className="flex-none flex items-center justify-between px-6 py-4 bg-card border-b border-border">
        <button onClick={resetOrder} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowRight size={28} />
          <span className="text-lg font-bold">חזרה</span>
        </button>
        <h1 className="text-2xl font-black text-primary">הבקתה 🐄</h1>
        {/* Dine-in toggle */}
        <div className="bg-secondary rounded-full p-1 flex gap-1">
          <button
            onClick={() => setDineIn(true)}
            className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${dineIn ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground"}`}
          >
            🪑 לשבת
          </button>
          <button
            onClick={() => setDineIn(false)}
            className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${!dineIn ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground"}`}
          >
            🥡 לקחת
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex-none flex gap-2 px-4 py-3 bg-card/50 border-b border-border overflow-x-auto">
        {categories.map((cat) => {
          const count = menuItems.filter((i) => i.category === cat.key && isAvailable(i.id)).length;
          if (count === 0) return null;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-6 py-3 rounded-2xl text-lg font-bold whitespace-nowrap transition-all ${
                activeCategory === cat.key
                  ? "bg-primary text-primary-foreground shadow-lg scale-105"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Menu grid - scrollable area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {filteredItems.map((item) => {
            const image = menuImages[item.id];
            return (
              <motion.div
                key={item.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAddItem(item)}
                className="bg-card border border-border rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow active:bg-secondary/50 relative flex flex-col"
              >
                {image && (
                  <div className="relative w-full aspect-[4/3]">
                    <img src={image} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                    {item.popular && (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 text-sm font-bold bg-primary text-primary-foreground px-3 py-1 rounded-full shadow-md">
                        <Star size={14} fill="currentColor" />
                        פופולארי
                      </span>
                    )}
                  </div>
                )}
                <div className="p-4 flex flex-col items-center text-center flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap justify-center">
                    {item.badge && <span className="text-2xl">{item.badge}</span>}
                    <h3 className="font-black text-xl">{item.name}</h3>
                  </div>
                  {item.weight && (
                    <span className="text-sm text-muted-foreground bg-secondary px-3 py-1 rounded-full mb-2">{item.weight}</span>
                  )}
                  <span className="text-primary font-black text-2xl mt-auto pt-2">₪{item.price}</span>
                </div>

                {/* Added feedback */}
                <AnimatePresence>
                  {justAddedId === item.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute inset-0 bg-primary/90 flex items-center justify-center rounded-2xl"
                    >
                      <span className="text-primary-foreground text-2xl font-black flex items-center gap-2">
                        <ShoppingBag size={24} />
                        נוסף לסל!
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Bottom cart bar */}
      {totalItems > 0 && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="flex-none bg-primary text-primary-foreground px-6 py-5 flex items-center justify-between cursor-pointer active:opacity-90"
          onClick={() => setCartOpen(true)}
        >
          <div className="flex items-center gap-3">
            <div ref={cartButtonRef} className="bg-primary-foreground/20 w-12 h-12 rounded-full flex items-center justify-center">
              <ShoppingBag size={24} />
            </div>
            <div>
              <p className="text-xl font-black">הסל שלי</p>
              <p className="text-sm opacity-80">{totalItems} פריטים</p>
            </div>
          </div>
          <p className="text-3xl font-black">₪{getTotal()}</p>
        </motion.div>
      )}

      {/* Modals - reuse existing components */}
      <ItemCustomizer item={customizerItem} onClose={() => setCustomizerItem(null)} onConfirm={handleCustomizerConfirm} isAvailable={isAvailable} />
      <DrinkSelector item={drinkItem} onClose={() => setDrinkItem(null)} onConfirm={handleDrinkConfirm} isAvailable={isAvailable} />
      <DealCustomizer open={dealOpen} onClose={() => setDealOpen(false)} onConfirm={handleDealConfirm} isAvailable={isAvailable} />
      <FamilyDealCustomizer open={familyDealOpen} onClose={() => setFamilyDealOpen(false)} onConfirm={handleFamilyDealConfirm} isAvailable={isAvailable} />
      <ItemPreview item={previewItem} onClose={() => setPreviewItem(null)} onAdd={handlePreviewAdd} cartButtonRef={cartButtonRef} />

      <CartDrawer
        isKiosk
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        onUpdateQuantity={updateQuantity}
        onCheckout={() => {
          setCartOpen(false);
          if (!dineIn && burgerCount > 0) {
            setSauceSelectorOpen(true);
          } else {
            setCheckoutOpen(true);
          }
        }}
      />

      <SauceSelector
        open={sauceSelectorOpen}
        freeSauces={freeSauces}
        onClose={() => setSauceSelectorOpen(false)}
        onConfirm={(sauces) => {
          setSelectedSauces(sauces);
          setSauceSelectorOpen(false);
          setCheckoutOpen(true);
        }}
      />

      <AnimatePresence>
        {checkoutOpen && (
          <CheckoutForm
            items={cart}
            total={getTotal()}
            onClose={() => setCheckoutOpen(false)}
            onSuccess={() => {
              setCheckoutOpen(false);
              resetOrder();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Kiosk;
