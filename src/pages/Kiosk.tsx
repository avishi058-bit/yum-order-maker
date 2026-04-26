import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useKioskInactivityTimer } from "@/hooks/useKioskInactivityTimer";
import { useKioskCSSVars } from "@/hooks/useKioskCSSVars";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag, ArrowRight } from "lucide-react";
import KioskWelcome from "@/components/KioskWelcome";
import MenuSection from "@/components/MenuSection";
import { CartItem, DealBurgerConfig, DealDrinkChoice } from "@/components/CartDrawer";
import KioskCartDrawer from "@/components/KioskCartDrawer";
import CheckoutForm from "@/components/CheckoutForm";
import ItemCustomizer, { type ItemCustomizerInitialState } from "@/components/ItemCustomizer";
import DealCustomizer from "@/components/DealCustomizer";
import FamilyDealCustomizer from "@/components/FamilyDealCustomizer";
import DrinkSelector from "@/components/DrinkSelector";
import SauceSelector from "@/components/SauceSelector";
import { menuImages } from "@/data/menuImages";
// Inline DineInSelector - was a separate component but only used here
const DineInSelector = ({ open, onSelect }: { open: boolean; onSelect: (dineIn: boolean) => void }) => {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        dir="rtl"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 200 }}
          className="bg-card rounded-3xl p-10 text-center shadow-2xl max-w-lg mx-4 border border-border"
        >
          <p className="text-5xl mb-6">🍔</p>
          <h2 className="text-3xl font-black text-foreground mb-2">איך תרצה את ההזמנה?</h2>
          <p className="text-lg text-muted-foreground mb-8">בחר אופציה כדי להמשיך</p>
          <div className="flex gap-4">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => onSelect(true)}
              className="flex-1 bg-primary text-primary-foreground rounded-2xl py-6 px-6 text-2xl font-black shadow-lg hover:opacity-90 transition-opacity">
              🪑 לשבת
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => onSelect(false)}
              className="flex-1 bg-accent text-accent-foreground rounded-2xl py-6 px-6 text-2xl font-black shadow-lg hover:opacity-90 transition-opacity">
              🥡 לקחת
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
import ItemPreview from "@/components/ItemPreview";
import KioskKeyboard from "@/components/KioskKeyboard";
import { MenuItem, menuItems, toppings, mealSideOptions, mealDrinkOptions, drinkSubOptions } from "@/data/menu";
import { computeCartItemTotal } from "@/lib/cartPricing";
import { useAvailability } from "@/hooks/useAvailability";
import { useRestaurantStatus } from "@/hooks/useRestaurantStatus";
import { useAlcoholConsent } from "@/hooks/useAlcoholConsent";
import AlcoholConsentModal from "@/components/AlcoholConsentModal";
import { useFlyToCart } from "@/contexts/FlyToCartContext";

const needsCustomization = (item: MenuItem) =>
  item.category === "burger" || item.category === "meal" || item.id === "friends-deal" || item.id === "family-deal" || (item.category === "drink" && !!drinkSubOptions[item.id]);

type KioskView = "welcome" | "menu" | "cart";

const Kiosk = () => {
  // Inject kiosk CSS variables + layout-stability classes (admin-controlled)
  useKioskCSSVars(true);

  const { isAvailable } = useAvailability();
  const { status: restaurantStatus } = useRestaurantStatus();
  const isClosed = !restaurantStatus.station_open;

  const [view, setView] = useState<KioskView>("welcome");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderSuccess, setOrderSuccess] = useState<number | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customizerItem, setCustomizerItem] = useState<MenuItem | null>(null);
  const [editingCartId, setEditingCartId] = useState<string | null>(null);
  const [customizerInitial, setCustomizerInitial] = useState<ItemCustomizerInitialState | undefined>(undefined);
  const [dealOpen, setDealOpen] = useState(false);
  const [familyDealOpen, setFamilyDealOpen] = useState(false);
  const [drinkItem, setDrinkItem] = useState<MenuItem | null>(null);
  const [dineIn, setDineIn] = useState<boolean | null>(null);
  const [dineInSelectorOpen, setDineInSelectorOpen] = useState(false);
  const [sauceSelectorOpen, setSauceSelectorOpen] = useState(false);
  const [selectedSauces, setSelectedSauces] = useState<{ id: string; name: string; quantity: number }[]>([]);
  const [previewItem, setPreviewItem] = useState<MenuItem | null>(null);
  const cartButtonRef = useRef<HTMLDivElement>(null);
  const { flyToCart, registerCartTarget } = useFlyToCart();
  const cartButtonCallbackRef = useCallback((node: HTMLDivElement | null) => {
    cartButtonRef.current = node;
    registerCartTarget(node);
  }, [registerCartTarget]);

  const flyFromCenter = useCallback(() => {
    const sourceRect = new DOMRect(
      window.innerWidth / 2 - 40,
      window.innerHeight / 2 - 40,
      80,
      80,
    );
    flyToCart({ sourceRect });
  }, [flyToCart]);
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle return from credit card payment
  useEffect(() => {
    const paid = searchParams.get("paid");
    const orderNum = searchParams.get("order");
    if (paid === "true" && orderNum) {
      setOrderSuccess(parseInt(orderNum));
      setView("welcome");
      setCart([]);
      setCheckoutOpen(false);
      import("canvas-confetti").then(({ default: confetti }) => {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 } });
      });
      setTimeout(() => {
        setOrderSuccess(null);
      }, 2000);
      setSearchParams({}, { replace: true });
    }
  }, []);

  // Preload + decode all menu images on kiosk mount (runs during the Welcome
  // screen too, since this component mounts immediately). By the time the user
  // taps "התחל הזמנה" the bitmaps are already in memory & decoded — no
  // progressive flicker, no layout settle, no scroll jump.
  const [imagesReady, setImagesReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const unique = Array.from(new Set(Object.values(menuImages)));
    Promise.all(
      unique.map(
        (src) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.decoding = "async";
            (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = "high";
            const done = () => resolve();
            img.onload = () => {
              img.decode().then(done, done);
            };
            img.onerror = done;
            img.src = src;
          })
      )
    ).then(() => {
      if (!cancelled) setImagesReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  // If user tapped "Start" before images finished, auto-advance once ready.
  const [pendingStart, setPendingStart] = useState(false);
  useEffect(() => {
    if (pendingStart && imagesReady) {
      setView("menu");
      setPendingStart(false);
    }
  }, [pendingStart, imagesReady]);

  const alcoholConsent = useAlcoholConsent();

  const openItemFlow = useCallback((item: MenuItem) => {
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

  const handleAddItem = useCallback((item: MenuItem) => {
    alcoholConsent.guard(item, () => openItemFlow(item));
  }, [alcoholConsent, openItemFlow]);

  const handlePreviewAdd = useCallback((item: MenuItem & { _menuItemId?: string }) => {
    const menuItemId = item._menuItemId ?? item.id;
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) => (c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { id: item.id, menuItemId, name: item.name, price: item.price, quantity: 1, toppings: [], removals: [], withMeal: false }];
    });
    // ItemPreview already plays its own fly animation, so no extra fly here
    // (it would double-fire). Stay on menu — no auto-open.
  }, []);

  const handleCustomizerConfirm = useCallback(
    (item: MenuItem, quantity: number, selectedToppings: string[], selectedRemovals: string[], withMeal: boolean, mealSideId?: string, mealDrinkId?: string, ownerName?: string) => {
      setCart((prev) => {
        if (editingCartId) {
          return prev.map((c) =>
            c.id === editingCartId
              ? { ...c, name: item.name, price: item.price, quantity, toppings: selectedToppings, removals: selectedRemovals, withMeal, mealSideId, mealDrinkId, ownerName }
              : c
          );
        }
        const cartItemId = `${item.id}-${Date.now()}`;
        return [
          ...prev,
          { id: cartItemId, menuItemId: item.id, name: item.name, price: item.price, quantity, toppings: selectedToppings, removals: selectedRemovals, withMeal, mealSideId, mealDrinkId, ownerName },
        ];
      });
      setCustomizerItem(null);
      setEditingCartId(null);
      setCustomizerInitial(undefined);
      // Stay on menu after add — no auto-open. Fly to cart for clear feedback.
      if (!editingCartId) flyFromCenter();
    },
    [editingCartId, flyFromCenter]
  );

  const handleEditCartItem = useCallback((cartId: string) => {
    const cartItem = cart.find((c) => c.id === cartId);
    if (!cartItem) return;
    const menuItem = menuItems.find((m) => m.id === cartItem.menuItemId);
    if (!menuItem) return;
    setEditingCartId(cartId);
    setCustomizerInitial({
      quantity: cartItem.quantity,
      selectedToppings: cartItem.toppings,
      selectedRemovals: cartItem.removals,
      withMeal: cartItem.withMeal,
      mealSideId: cartItem.mealSideId,
      mealDrinkId: cartItem.mealDrinkId,
      ownerName: cartItem.ownerName,
    });
    setCartOpen(false);
    setCustomizerItem(menuItem);
  }, [cart]);

  const handleDealConfirm = useCallback((burgers: DealBurgerConfig[], drinks: DealDrinkChoice[]) => {
    const drinksExtra = drinks.reduce((sum, d) => sum + d.extraCost, 0);
    setCart((prev) => [
      ...prev,
      { id: `friends-deal-${Date.now()}`, menuItemId: "friends-deal", name: "דיל חברים", price: 216 + drinksExtra, quantity: 1, toppings: [], removals: [], withMeal: false, dealBurgers: burgers, dealDrinks: drinks },
    ]);
    setDealOpen(false);
    flyFromCenter();
  }, [flyFromCenter]);

  const handleFamilyDealConfirm = useCallback((burgers: DealBurgerConfig[], drinks: DealDrinkChoice[]) => {
    const drinksExtra = drinks.reduce((sum, d) => sum + d.extraCost, 0);
    setCart((prev) => [
      ...prev,
      { id: `family-deal-${Date.now()}`, menuItemId: "family-deal", name: "דיל משפחתי", price: 300 + drinksExtra, quantity: 1, toppings: [], removals: [], withMeal: false, dealBurgers: burgers, dealDrinks: drinks.length > 0 ? drinks : undefined },
    ]);
    setFamilyDealOpen(false);
    flyFromCenter();
  }, [flyFromCenter]);

  const handleDrinkConfirm = useCallback((item: MenuItem, selectedDrink: string) => {
    setDrinkItem(null);
    // Show preview with the selected drink variant; preserve canonical menu id for server-side pricing.
    setPreviewItem({
      ...item,
      id: `${item.id}-${selectedDrink}-${Date.now()}`,
      name: `${item.name} — ${selectedDrink}`,
      _menuItemId: item.id,
    } as MenuItem);
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
      return sum + computeCartItemTotal(item);
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
    return (
      <KioskWelcome
        imagesReady={imagesReady}
        onStart={() => {
          if (imagesReady) {
            setView("menu");
          } else {
            setPendingStart(true);
          }
        }}
      />
    );
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

      {/* Floating green "סיום הזמנה" button — same as website */}
      {totalItems > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <button
            ref={cartButtonCallbackRef as any}
            onClick={() => setCartOpen(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-black px-8 py-5 rounded-full flex items-center gap-4 shadow-2xl shadow-green-600/40 transition-colors active:scale-[0.98]"
            dir="rtl"
          >
            <span className="relative flex items-center justify-center w-12 h-12 rounded-full bg-white/20">
              <ShoppingBag size={26} />
              <span className="absolute -top-1 -right-1 bg-white text-green-700 text-sm font-black w-6 h-6 rounded-full flex items-center justify-center shadow-sm">
                {totalItems}
              </span>
            </span>
            <span className="text-2xl">סיום הזמנה</span>
            <span className="text-2xl font-black border-r border-white/30 pr-4">₪{getTotal()}</span>
          </button>
        </div>
      )}

      {/* Modals - reuse existing components */}
      <ItemCustomizer item={customizerItem} onClose={() => { setCustomizerItem(null); setEditingCartId(null); setCustomizerInitial(undefined); }} onConfirm={handleCustomizerConfirm} isAvailable={isAvailable} initialState={customizerInitial} />
      <DrinkSelector item={drinkItem} onClose={() => setDrinkItem(null)} onConfirm={handleDrinkConfirm} isAvailable={isAvailable} />
      <DealCustomizer open={dealOpen} onClose={() => setDealOpen(false)} onConfirm={handleDealConfirm} isAvailable={isAvailable} />
      <FamilyDealCustomizer open={familyDealOpen} onClose={() => setFamilyDealOpen(false)} onConfirm={handleFamilyDealConfirm} isAvailable={isAvailable} />
      <ItemPreview item={previewItem} onClose={() => setPreviewItem(null)} onAdd={handlePreviewAdd} cartButtonRef={cartButtonRef} />

      <AlcoholConsentModal
        open={alcoholConsent.consentOpen}
        isKiosk
        onConfirm={alcoholConsent.confirm}
        onCancel={alcoholConsent.cancel}
      />

      <KioskCartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        onUpdateQuantity={updateQuantity}
        isAvailable={isAvailable}
        onEditItem={handleEditCartItem}
        isKiosk
        onBackToMenu={() => setCartOpen(false)}
        onQuickAdd={(item) => {
          // One-tap add for simple items (sides + simple drinks).
          handlePreviewAdd(item);
        }}
        onSelectDrink={(item) => {
          setCartOpen(false);
          setDrinkItem(item);
        }}
        onCheckout={() => {
          setCartOpen(false);
          setDineInSelectorOpen(true);
        }}
      />

      <DineInSelector
        open={dineInSelectorOpen}
        onSelect={(val) => {
          setDineIn(val);
          setDineInSelectorOpen(false);
          if (!val && burgerCount > 0) {
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
            sauces={selectedSauces}
            freeSauces={freeSauces}
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

      {/* On-screen keyboard for kiosk — auto shows on input focus */}
      <KioskKeyboard />
    </div>
  );
};

export default Kiosk;
