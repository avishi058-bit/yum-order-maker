import { useState, useCallback, useRef } from "react";
import { useKioskInactivityTimer } from "@/hooks/useKioskInactivityTimer";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag, ArrowRight } from "lucide-react";
import KioskWelcome from "@/components/KioskWelcome";
import MenuSection from "@/components/MenuSection";
import CartDrawer, { CartItem, DealBurgerConfig, DealDrinkChoice } from "@/components/CartDrawer";
import CheckoutForm from "@/components/CheckoutForm";
import ItemCustomizer from "@/components/ItemCustomizer";
import DealCustomizer from "@/components/DealCustomizer";
import FamilyDealCustomizer from "@/components/FamilyDealCustomizer";
import DrinkSelector from "@/components/DrinkSelector";
import SauceSelector from "@/components/SauceSelector";
import DineInSelector from "@/components/DineInSelector";
import ItemPreview from "@/components/ItemPreview";
import { MenuItem, menuItems, toppings, mealSideOptions, mealDrinkOptions, drinkSubOptions } from "@/data/menu";
import { useAvailability } from "@/hooks/useAvailability";
import { useRestaurantStatus } from "@/hooks/useRestaurantStatus";

const needsCustomization = (item: MenuItem) =>
  item.category === "burger" || item.category === "meal" || item.id === "friends-deal" || item.id === "family-deal" || (item.category === "drink" && !!drinkSubOptions[item.id]);

type KioskView = "welcome" | "menu" | "cart";

const Kiosk = () => {
  const { isAvailable } = useAvailability();
  const { status: restaurantStatus } = useRestaurantStatus();
  const isClosed = !restaurantStatus.station_open;

  const [view, setView] = useState<KioskView>("welcome");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderSuccess, setOrderSuccess] = useState<number | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customizerItem, setCustomizerItem] = useState<MenuItem | null>(null);
  const [dealOpen, setDealOpen] = useState(false);
  const [familyDealOpen, setFamilyDealOpen] = useState(false);
  const [drinkItem, setDrinkItem] = useState<MenuItem | null>(null);
  const [dineIn, setDineIn] = useState<boolean | null>(null);
  const [dineInSelectorOpen, setDineInSelectorOpen] = useState(false);
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

  const resetOrder = useCallback(() => {
    setCart([]);
    setView("welcome");
    setDineIn(null);
    setDineInSelectorOpen(false);
    setSelectedSauces([]);
    setCartOpen(false);
    setCheckoutOpen(false);
    setCustomizerItem(null);
    setDealOpen(false);
    setFamilyDealOpen(false);
    setDrinkItem(null);
    setSauceSelectorOpen(false);
    setPreviewItem(null);
  }, []);

  const { countdown } = useKioskInactivityTimer(view === "menu", resetOrder);

  

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
        <div /> {/* spacer */}
      </div>

      {/* Scrollable menu - all categories */}
      <div className="flex-1 overflow-y-auto">
        <MenuSection onAddItem={handleAddItem} dineIn={dineIn} onDineInChange={setDineIn} isAvailable={isAvailable} isKiosk />
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
            onSuccess={(orderNumber) => {
              setCheckoutOpen(false);
              setOrderSuccess(orderNumber ?? 0);
              // Fire confetti
              import("canvas-confetti").then(({ default: confetti }) => {
                confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 } });
              });
              setTimeout(() => {
                setOrderSuccess(null);
                resetOrder();
              }, 2000);
            }}
          />
        )}
      </AnimatePresence>

      {/* Order success popup */}
      <AnimatePresence>
        {orderSuccess !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: -20 }}
              transition={{ type: "spring", damping: 18, stiffness: 200 }}
              className="bg-card rounded-3xl p-12 text-center shadow-2xl max-w-lg mx-4 border border-border"
            >
              <p className="text-8xl mb-6">🎉</p>
              <p className="text-4xl font-black text-foreground mb-3">הזמנתך התקבלה!</p>
              <p className="text-5xl font-black text-primary mb-4">#{orderSuccess}</p>
              <p className="text-2xl text-muted-foreground">תודה רבה, ההזמנה בהכנה 🍔</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inactivity countdown overlay */}
      <AnimatePresence>
        {countdown !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-[9999] backdrop-blur-sm"
            onClick={() => {/* touch resets via window listener */}}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="bg-card rounded-3xl p-12 text-center shadow-2xl max-w-md mx-4"
            >
              <p className="text-6xl mb-6">⏳</p>
              <p className="text-3xl font-black text-foreground mb-3">עדיין כאן?</p>
              <p className="text-xl text-muted-foreground mb-8">ההזמנה תתאפס בעוד</p>
              <div className="relative w-32 h-32 mx-auto mb-8">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="45" fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 45}`}
                    strokeDashoffset={`${2 * Math.PI * 45 * (1 - countdown / 30)}`}
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-5xl font-black text-primary">
                  {countdown}
                </span>
              </div>
              <p className="text-lg text-muted-foreground">גע במסך כדי להמשיך</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Kiosk;
