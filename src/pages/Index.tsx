import { useState, useCallback, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { ShoppingBag, Phone } from "lucide-react";
import HeroSection from "@/components/HeroSection";
import MenuSection from "@/components/MenuSection";
import CartDrawer, { CartItem, DealBurgerConfig, DealDrinkChoice } from "@/components/CartDrawer";
import CheckoutForm from "@/components/CheckoutForm";
import ItemCustomizer from "@/components/ItemCustomizer";
import DealCustomizer from "@/components/DealCustomizer";
import FamilyDealCustomizer from "@/components/FamilyDealCustomizer";
import DrinkSelector from "@/components/DrinkSelector";
import SauceSelector from "@/components/SauceSelector";
import AccessibilityWidget from "@/components/AccessibilityWidget";
import ItemPreview from "@/components/ItemPreview";
import OrderLiveTracker from "@/components/OrderLiveTracker";
import KioskWelcome from "@/components/KioskWelcome";
import { MenuItem, menuItems, toppings, mealSideOptions, mealDrinkOptions, drinkSubOptions } from "@/data/menu";
import { useAvailability } from "@/hooks/useAvailability";
import { useRestaurantStatus } from "@/hooks/useRestaurantStatus";

const Index = () => {
  const { isAvailable } = useAvailability();
  const { status: restaurantStatus } = useRestaurantStatus();
  const isStation = localStorage.getItem("habakta_station") === "true";
  const isClosed = isStation ? !restaurantStatus.station_open : !restaurantStatus.website_open;
  const [showKioskWelcome, setShowKioskWelcome] = useState(isStation);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customizerItem, setCustomizerItem] = useState<MenuItem | null>(null);
  const [dealOpen, setDealOpen] = useState(false);
  const [familyDealOpen, setFamilyDealOpen] = useState(false);
  const [drinkItem, setDrinkItem] = useState<MenuItem | null>(null);
  const [dineIn, setDineIn] = useState<boolean | null>(isStation ? true : null);
  const [sauceSelectorOpen, setSauceSelectorOpen] = useState(false);
  const [selectedSauces, setSelectedSauces] = useState<{ id: string; name: string; quantity: number }[]>([]);
  const [previewItem, setPreviewItem] = useState<MenuItem | null>(null);
  const [trackingOrderNumber, setTrackingOrderNumber] = useState<number | null>(null);
  const cartButtonRef = useRef<HTMLDivElement>(null);

  const addToCartDirect = useCallback((item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) => (c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1, toppings: [], removals: [], withMeal: false }];
    });
  }, []);

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
      setPreviewItem(item);
    }
  }, []);

  const handleCustomizerConfirm = useCallback(
    (item: MenuItem, quantity: number, selectedToppings: string[], selectedRemovals: string[], withMeal: boolean, mealSideId?: string, mealDrinkId?: string) => {
      const cartItemId = `${item.id}-${Date.now()}`;
      setCart((prev) => [
        ...prev,
        {
          id: cartItemId,
          name: item.name,
          price: item.price,
          quantity,
          toppings: selectedToppings,
          removals: selectedRemovals,
          withMeal,
          mealSideId,
          mealDrinkId,
        },
      ]);
      setCustomizerItem(null);
      setCartOpen(true);
    },
    []
  );

  const handleDealConfirm = useCallback(
    (burgers: DealBurgerConfig[], drinks: DealDrinkChoice[]) => {
      const drinksExtra = drinks.reduce((sum, d) => sum + d.extraCost, 0);
      setCart((prev) => [
        ...prev,
        {
          id: `friends-deal-${Date.now()}`,
          name: "דיל חברים",
          price: 216 + drinksExtra,
          quantity: 1,
          toppings: [],
          removals: [],
          withMeal: false,
          dealBurgers: burgers,
          dealDrinks: drinks,
        },
      ]);
      setDealOpen(false);
      setCartOpen(true);
    },
    []
  );

  const handleFamilyDealConfirm = useCallback(
    (burgers: DealBurgerConfig[], drinks: DealDrinkChoice[]) => {
      const drinksExtra = drinks.reduce((sum, d) => sum + d.extraCost, 0);
      setCart((prev) => [
        ...prev,
        {
          id: `family-deal-${Date.now()}`,
          name: "דיל משפחתי",
          price: 300 + drinksExtra,
          quantity: 1,
          toppings: [],
          removals: [],
          withMeal: false,
          dealBurgers: burgers,
          dealDrinks: drinks.length > 0 ? drinks : undefined,
        },
      ]);
      setFamilyDealOpen(false);
      setCartOpen(true);
    },
    []
  );

  const handleDrinkConfirm = useCallback(
    (item: MenuItem, selectedDrink: string) => {
      setDrinkItem(null);
      // Show preview with the selected drink variant
      setPreviewItem({
        ...item,
        id: `${item.id}-${selectedDrink}-${Date.now()}`,
        name: `${item.name} — ${selectedDrink}`,
      });
    },
    []
  );

  const updateQuantity = useCallback((id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  }, []);

  const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);

  // Count burgers in cart for free sauces calculation
  const burgerCount = cart.reduce((sum, item) => {
    if (item.dealBurgers) {
      return sum + (item.dealBurgers.length * item.quantity);
    }
    const menuItem = menuItems.find(m => m.name === item.name || item.id.startsWith(m.id));
    if (menuItem && (menuItem.category === 'burger' || menuItem.category === 'meal')) {
      return sum + item.quantity;
    }
    return sum;
  }, 0);
  const freeSauces = burgerCount * 3;

  const getTotal = () => {
    let base = cart.reduce((sum, item) => {
      if (item.dealBurgers) {
        return sum + item.price * item.quantity;
      }
      const toppingsCost = item.toppings.reduce((s, tId) => {
        const t = toppings.find((tp) => tp.id === tId);
        return s + (t?.price || 0);
      }, 0);
      const mealCost = item.withMeal ? 23 : 0;
      const sideCost = item.mealSideId ? (mealSideOptions.find(s => s.id === item.mealSideId)?.price || 0) : 0;
      const drinkCost = item.mealDrinkId ? (mealDrinkOptions.find(d => d.id === item.mealDrinkId)?.price || 0) : 0;
      return sum + (item.price + toppingsCost + mealCost + sideCost + drinkCost) * item.quantity;
    }, 0);
    // Add extra sauce cost
    if (dineIn === false && selectedSauces.length > 0) {
      const totalSauceQty = selectedSauces.reduce((sum, s) => sum + s.quantity, 0);
      const extraSauces = Math.max(0, totalSauceQty - freeSauces);
      base += extraSauces;
    }
    return base;
  };

  const handleDineInChoice = (val: boolean) => {
    setDineIn(val);
    setTimeout(() => {
      document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Kiosk welcome screen */}
      {isStation && showKioskWelcome && !isClosed && (
        <KioskWelcome onStart={() => setShowKioskWelcome(false)} />
      )}

      {isClosed && (
        <div className="bg-destructive text-destructive-foreground text-center py-4 px-6 font-bold text-lg sticky top-0 z-50">
          🚫 המסעדה סגורה כרגע להזמנות · נשמח לראות אתכם בפעם הבאה!
        </div>
      )}

      {!isClosed && totalItems > 0 && !cartOpen && (
        <div ref={cartButtonRef}>
          <button
            onClick={() => setCartOpen(true)}
            className="fixed bottom-6 left-6 z-30 bg-primary text-primary-foreground w-14 h-14 rounded-full flex items-center justify-center shadow-xl shadow-primary/30 hover:scale-105 transition-transform"
          >
            <ShoppingBag size={22} />
            <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
              {totalItems}
            </span>
          </button>
        </div>
      )}

      {!isStation && <HeroSection onDineInChoice={isClosed ? undefined : handleDineInChoice} dineIn={dineIn} />}
      {isClosed ? (
        <div className="py-20 text-center text-muted-foreground">
          <p className="text-6xl mb-4">🔒</p>
          <p className="text-xl font-bold">ההזמנות סגורות כרגע</p>
          <p className="text-sm mt-2">נחזור בקרוב!</p>
        </div>
      ) : dineIn !== null ? (
        <MenuSection onAddItem={handleAddItem} dineIn={dineIn} onDineInChange={setDineIn} isAvailable={isAvailable} isKiosk={isStation} />
      ) : null}

      <ItemCustomizer
        item={customizerItem}
        onClose={() => setCustomizerItem(null)}
        onConfirm={handleCustomizerConfirm}
        isAvailable={isAvailable}
      />

      <DrinkSelector
        item={drinkItem}
        onClose={() => setDrinkItem(null)}
        onConfirm={handleDrinkConfirm}
        isAvailable={isAvailable}
      />

      <DealCustomizer
        open={dealOpen}
        onClose={() => setDealOpen(false)}
        onConfirm={handleDealConfirm}
        isAvailable={isAvailable}
      />

      <FamilyDealCustomizer
        open={familyDealOpen}
        onClose={() => setFamilyDealOpen(false)}
        onConfirm={handleFamilyDealConfirm}
        isAvailable={isAvailable}
      />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        onUpdateQuantity={updateQuantity}
        onCheckout={() => {
          setCartOpen(false);
          if (dineIn === false && burgerCount > 0) {
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

      <ItemPreview
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        onAdd={(item) => addToCartDirect(item)}
        cartButtonRef={cartButtonRef}
      />

      <AnimatePresence>
        {checkoutOpen && (
          <CheckoutForm
            items={cart}
            total={getTotal()}
            onClose={() => setCheckoutOpen(false)}
            onSuccess={(orderNumber) => {
              setCheckoutOpen(false);
              setCart([]);
              if (isStation) {
                setShowKioskWelcome(true);
              } else if (orderNumber) {
                setTrackingOrderNumber(orderNumber);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Live order tracker */}
      {trackingOrderNumber !== null && (
        <OrderLiveTracker
          orderNumber={trackingOrderNumber}
          onClose={() => setTrackingOrderNumber(null)}
        />
      )}

      {!isStation && (
        <footer className="py-8 text-center border-t border-border space-y-2">
          <p className="text-foreground font-bold">הַבִּקְתָּה — המבורגר של מושבניקים 🐄</p>
          <p className="text-muted-foreground text-sm">כשר בהשגחת הרבנות · בשר שדות נגב</p>
          <a
            href="tel:058-4633-555"
            className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
          >
            <Phone size={14} />
            058-4633-555
          </a>
        </footer>
      )}

      <AccessibilityWidget />
    </div>
  );
};

export default Index;
