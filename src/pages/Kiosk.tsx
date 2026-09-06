import { useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { useKioskInactivityTimer } from "@/hooks/useKioskInactivityTimer";
import { useKioskCSSVars } from "@/hooks/useKioskCSSVars";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag, ArrowRight } from "lucide-react";
import KioskWelcome from "@/components/KioskWelcome";
import type { CartItem, DealBurgerConfig, DealDrinkChoice } from "@/components/CartDrawer";
import type { ItemCustomizerInitialState } from "@/components/ItemCustomizer";

// Everything below the welcome screen is loaded after first paint. This keeps
// kiosk startup fast even on an older Android tablet or a cold network cache.
const MenuSection = lazy(() => import("@/components/MenuSection"));
const KioskCartDrawer = lazy(() => import("@/components/KioskCartDrawer"));
const DrinkSelector = lazy(() => import("@/components/DrinkSelector"));
const ArayesCustomizer = lazy(() => import("@/components/ArayesCustomizer"));
const SauceSelector = lazy(() => import("@/components/SauceSelector"));
const CheckoutForm = lazy(() => import("@/components/CheckoutForm"));
const ItemCustomizer = lazy(() => import("@/components/ItemCustomizer"));
const DealCustomizer = lazy(() => import("@/components/DealCustomizer"));
const FamilyDealCustomizer = lazy(() => import("@/components/FamilyDealCustomizer"));
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
          className="bg-white rounded-3xl p-10 text-center shadow-2xl max-w-lg mx-4 border border-gray-200"
        >
          <p className="text-5xl mb-6">🍔</p>
          <h2 className="text-3xl font-black text-gray-900 mb-2">איך תרצה את ההזמנה?</h2>
          <p className="text-lg text-gray-500 mb-8">בחר אופציה כדי להמשיך</p>
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
const ItemPreview = lazy(() => import("@/components/ItemPreview"));
const KioskKeyboard = lazy(() => import("@/components/KioskKeyboard"));
import { MenuItem, menuItems, toppings, mealSideOptions, mealDrinkOptions, drinkSubOptions, sauceOptions } from "@/data/menu";
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
  const [successPaymentMethod, setSuccessPaymentMethod] = useState<"cash" | "credit" | "counter" | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customizerItem, setCustomizerItem] = useState<MenuItem | null>(null);
  const [editingCartId, setEditingCartId] = useState<string | null>(null);
  const [customizerInitial, setCustomizerInitial] = useState<ItemCustomizerInitialState | undefined>(undefined);
  const [dealOpen, setDealOpen] = useState(false);
  const [familyDealOpen, setFamilyDealOpen] = useState(false);
  const [drinkItem, setDrinkItem] = useState<MenuItem | null>(null);
  const [arayesItem, setArayesItem] = useState<MenuItem | null>(null);
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
      setSuccessPaymentMethod("credit");
      setView("welcome");
      setCart([]);
      setCheckoutOpen(false);
      import("canvas-confetti").then(({ default: confetti }) => {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 } });
      });
      setTimeout(() => {
        setOrderSuccess(null);
        setSuccessPaymentMethod(null);
      }, 2000);
      setSearchParams({}, { replace: true });
    }
  }, []);

  // Warm only the menu code while the welcome screen is idle. Do not prefetch
  // customizers or their many images here: on kiosk hardware that saturated
  // the network and delayed both the welcome screen and menu images.
  useEffect(() => {
    let timer: number | undefined;
    let idleId: number | undefined;
    const warm = () => {
      void import("@/components/MenuSection");
    };
    const browser = window as typeof window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (browser.requestIdleCallback) {
      idleId = browser.requestIdleCallback(warm, { timeout: 1200 });
    } else {
      timer = window.setTimeout(warm, 800);
    }
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      if (idleId !== undefined) browser.cancelIdleCallback?.(idleId);
    };
  }, []);

  // Stable callback so memoized <KioskWelcome> never re-renders when the parent
  // re-renders (e.g. realtime availability/settings updates).
  const handleWelcomeStart = useCallback((choice: boolean) => {
    setDineIn(choice);
    setView("menu");
  }, []);

  const alcoholConsent = useAlcoholConsent();

  const openItemFlow = useCallback((item: MenuItem) => {
    if (item.id === "friends-deal") {
      setDealOpen(true);
    } else if (item.id === "family-deal") {
      setFamilyDealOpen(true);
    } else if (item.id === "arayes-special" || item.id === "arayes-special-4") {
      setArayesItem(item);
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
    (item: MenuItem, quantity: number, selectedToppings: string[], selectedRemovals: string[], withMeal: boolean, mealSideId?: string, mealDrinkId?: string, ownerName?: string, sideItems?: Array<{ itemId: string; qty: number; label?: string }>) => {
      setCart((prev) => {
        if (editingCartId) {
          return prev.map((c) =>
            c.id === editingCartId
              ? { ...c, name: item.name, price: item.price, quantity, toppings: selectedToppings, removals: selectedRemovals, withMeal, mealSideId, mealDrinkId, ownerName }
              : c
          );
        }
        const cartItemId = `${item.id}-${Date.now()}`;
        const next = [
          ...prev,
          { id: cartItemId, menuItemId: item.id, name: item.name, price: item.price, quantity, toppings: selectedToppings, removals: selectedRemovals, withMeal, mealSideId, mealDrinkId, ownerName },
        ];
        // Append optional side items (e.g. arayes 3/4 added from "תוספות צד")
        if (sideItems && sideItems.length > 0) {
          for (const s of sideItems) {
            const m = menuItems.find((mi) => mi.id === s.itemId);
            if (!m) continue;
            next.push({
              id: `${m.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              menuItemId: m.id,
              name: s.label ? `${m.name} — ${s.label}` : m.name,
              price: m.price,
              quantity: s.qty,
              toppings: [],
              removals: [],
              withMeal: false,
            });
          }
        }
        return next;
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
    // Add directly to cart — no second confirmation preview on kiosk.
    const cartItemId = `${item.id}-${selectedDrink}-${Date.now()}`;
    setCart((prev) => [
      ...prev,
      { id: cartItemId, menuItemId: item.id, name: `${item.name} — ${selectedDrink}`, price: item.price, quantity: 1, toppings: [], removals: [], withMeal: false },
    ]);
    flyFromCenter();
  }, [flyFromCenter]);

  const updateQuantity = useCallback((id: string, delta: number) => {
    setCart((prev) => prev.map((c) => (c.id === id ? { ...c, quantity: c.quantity + delta } : c)).filter((c) => c.quantity > 0));
  }, []);

  const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);
  const FRIED_SIDE_IDS = ["fries", "sweet-potato-fries", "onion-rings", "tempura-onion"];
  const burgerCount = cart.reduce((sum, item) => {
    if (item.dealBurgers) return sum + item.dealBurgers.length * item.quantity;
    const menuItem = menuItems.find((m) => m.name === item.name || item.id.startsWith(m.id));
    if (menuItem && (menuItem.category === "burger" || menuItem.category === "meal")) return sum + item.quantity;
    return sum;
  }, 0);
  const sideFreeSauces = cart.reduce((sum, item) => {
    if (item.dealBurgers) return sum;
    const menuItem = menuItems.find((m) => m.name === item.name || item.id.startsWith(m.id));
    if (!menuItem) return sum;
    if (menuItem.id === "friends-mix") return sum + 5 * item.quantity;
    if (FRIED_SIDE_IDS.includes(menuItem.id)) return sum + 2 * item.quantity;
    return sum;
  }, 0);
  const freeSauces = burgerCount > 0 ? burgerCount * 3 : sideFreeSauces;

  const getTotal = () => {
    // computeCartItemTotal handles both deals (base + per-burger toppings)
    // and regular items.
    let base = cart.reduce((sum, item) => sum + computeCartItemTotal(item), 0);
    if (!dineIn && selectedSauces.length > 0) {
      let regularQty = 0;
      let premiumCost = 0;
      for (const s of selectedSauces) {
        const opt = sauceOptions.find((x) => x.id === s.id);
        if (opt?.price) premiumCost += opt.price * s.quantity;
        else regularQty += s.quantity;
      }
      base += Math.max(0, regularQty - freeSauces) + premiumCost;
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
        onStart={handleWelcomeStart}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-white text-gray-900 flex flex-col overflow-hidden" dir="rtl">
      {/* Top bar */}
      <div className="flex-none flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <button onClick={resetOrder} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowRight size={28} />
          <span className="text-lg font-bold">חזרה</span>
        </button>
        <h1 className="text-2xl font-black text-primary">הבקתה 🐄</h1>
        <div /> {/* spacer */}
      </div>


      {/* Scrollable menu - all categories */}
      <div className="flex-1 overflow-y-auto">
        <Suspense fallback={<div className="h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">טוען תפריט…</div>}>
          <MenuSection onAddItem={handleAddItem} dineIn={dineIn} onDineInChange={setDineIn} isAvailable={isAvailable} isKiosk />
        </Suspense>
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

      {/* Modals - reuse existing components. Suspense fallback is null: the
          chunks are prefetched during Welcome (see prefetchCustomerFlow), so
          in practice they are already resident when opened. */}
      <Suspense fallback={null}>
        <ItemCustomizer item={customizerItem} onClose={() => { setCustomizerItem(null); setEditingCartId(null); setCustomizerInitial(undefined); }} onConfirm={handleCustomizerConfirm} isAvailable={isAvailable} dineIn={dineIn} initialState={customizerInitial} />
        <DealCustomizer open={dealOpen} onClose={() => setDealOpen(false)} onConfirm={handleDealConfirm} isAvailable={isAvailable} />
        <FamilyDealCustomizer open={familyDealOpen} onClose={() => setFamilyDealOpen(false)} onConfirm={handleFamilyDealConfirm} isAvailable={isAvailable} />
        <DrinkSelector item={drinkItem} onClose={() => setDrinkItem(null)} onConfirm={handleDrinkConfirm} isAvailable={isAvailable} isKiosk />
        <ItemPreview item={previewItem} onClose={() => setPreviewItem(null)} onAdd={handlePreviewAdd} cartButtonRef={cartButtonRef} />
        <ArayesCustomizer
        item={arayesItem}
        isKiosk
        onClose={() => setArayesItem(null)}
        onConfirm={(it, quantity, toppings) => {
          setCart((prev) => [
            ...prev,
            {
              id: `${it.id}-${Date.now()}`,
              menuItemId: it.id,
              name: it.name,
              price: it.price,
              quantity,
              toppings,
              removals: [],
              withMeal: false,
            },
          ]);
          setArayesItem(null);
          flyFromCenter();
        }}
        />

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
        isClosed={isClosed}
        onBackToMenu={() => setCartOpen(false)}
        onQuickAdd={(item) => {
          if (item.id === "arayes-special" || item.id === "arayes-special-4") {
            setCartOpen(false);
            openItemFlow(item);
            return;
          }
          // One-tap add for simple items (sides + simple drinks).
          handlePreviewAdd(item);
        }}
        onSelectDrink={(item) => {
          setCartOpen(false);
          setDrinkItem(item);
        }}
        onCheckout={() => {
          setCartOpen(false);
          if (dineIn === null) {
            setDineInSelectorOpen(true);
          } else if (!dineIn && freeSauces > 0) {
            setSauceSelectorOpen(true);
          } else {
            setCheckoutOpen(true);
          }
        }}
        />

      <DineInSelector
        open={dineInSelectorOpen}
        onSelect={(val) => {
          setDineIn(val);
          setDineInSelectorOpen(false);
          if (!val && freeSauces > 0) {
            setSauceSelectorOpen(true);
          } else {
            setCheckoutOpen(true);
          }
        }}
      />

        <SauceSelector
          open={sauceSelectorOpen}
          freeSauces={freeSauces}
          isAvailable={isAvailable}
          isKiosk
          onClose={() => setSauceSelectorOpen(false)}
          onConfirm={(sauces) => {
            setSelectedSauces(sauces);
            setSauceSelectorOpen(false);
            setCheckoutOpen(true);
          }}
        />
      </Suspense>


      <AnimatePresence>
        {checkoutOpen && (
          <Suspense fallback={null}>
            <CheckoutForm
              dineIn={dineIn}
              items={cart}
              total={getTotal()}
              sauces={dineIn ? [] : selectedSauces}
              freeSauces={freeSauces}
              onClose={() => setCheckoutOpen(false)}
              onSuccess={(orderNumber, _phone, method) => {
                setCheckoutOpen(false);
                setOrderSuccess(orderNumber ?? 0);
                setSuccessPaymentMethod(method ?? null);
                // Fire confetti
                import("canvas-confetti").then(({ default: confetti }) => {
                  confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 } });
                });
                setTimeout(() => {
                  setOrderSuccess(null);
                  setSuccessPaymentMethod(null);
                  resetOrder();
                }, 2000);
              }}
            />
          </Suspense>
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
              className="bg-white rounded-3xl p-12 text-center shadow-2xl max-w-lg mx-4 border border-gray-200"
            >
              <p className="text-8xl mb-6">🎉</p>
              <p className="text-4xl font-black text-gray-900 mb-3">הזמנתך התקבלה!</p>
              <p className="text-5xl font-black text-primary mb-4">#{orderSuccess}</p>
              <div className="rounded-2xl border-4 border-primary bg-primary/10 px-6 py-5 mb-4">
                <p className="text-5xl font-black text-primary leading-tight">
                  גש לשלם בקופה
                </p>
                <p className="text-3xl font-black text-gray-900 mt-2">
                  באשראי או מזומן
                </p>
              </div>
              <p className="text-2xl text-gray-500">מספר ההזמנה שלך למעלה</p>

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
      <Suspense fallback={null}>
        <KioskKeyboard />
      </Suspense>
    </div>
  );
};

export default Kiosk;
