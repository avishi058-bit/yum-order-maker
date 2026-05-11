import { useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { AnimatePresence } from "framer-motion";
import { ShoppingBag, Phone, LogIn, Smartphone } from "lucide-react";
import HeroSection from "@/components/HeroSection";
import MenuSection from "@/components/MenuSection";
import { CartItem, DealBurgerConfig, DealDrinkChoice } from "@/components/CartDrawer";
import type { ItemCustomizerInitialState } from "@/components/ItemCustomizer";

/** Result handed back when the favorite modal awaits a customizer round-trip. */
interface CustomizerResult {
  item: MenuItem;
  quantity: number;
  selectedToppings: string[];
  selectedRemovals: string[];
  withMeal: boolean;
  mealSideId?: string;
  mealDrinkId?: string;
  ownerName?: string;
}
import OrderTopBar, { setTrackedOrder } from "@/components/OrderTopBar";
import BusinessStatusBar from "@/components/BusinessStatusBar";
import SideMenu from "@/components/SideMenu";
import KioskWelcome from "@/components/KioskWelcome";
import CustomerGreeting from "@/components/CustomerGreeting";
import ItemPreview from "@/components/ItemPreview";

// Lazy-loaded: only needed once the user opens a modal/customizer/checkout.
// This trims the initial JS bundle significantly (ItemCustomizer alone ~1300 lines).
const KioskCartDrawer = lazy(() => import("@/components/KioskCartDrawer"));
const CheckoutForm = lazy(() => import("@/components/CheckoutForm"));
const ItemCustomizer = lazy(() => import("@/components/ItemCustomizer"));
const DealCustomizer = lazy(() => import("@/components/DealCustomizer"));
const FamilyDealCustomizer = lazy(() => import("@/components/FamilyDealCustomizer"));
const DrinkSelector = lazy(() => import("@/components/DrinkSelector"));
const SauceSelector = lazy(() => import("@/components/SauceSelector"));
const AccessibilityWidget = lazy(() => import("@/components/AccessibilityWidget"));
const CustomerAuthModal = lazy(() => import("@/components/CustomerAuthModal"));
const SavedCartModal = lazy(() => import("@/components/SavedCartModal"));
const AlcoholConsentModal = lazy(() => import("@/components/AlcoholConsentModal"));
const ReopenNotifyModal = lazy(() => import("@/components/ReopenNotifyModal"));
const OrderHistoryModal = lazy(() => import("@/components/OrderHistoryModal"));
const OrderLiveTracker = lazy(() => import("@/components/OrderLiveTracker"));
const FavoriteOrderModal = lazy(() => import("@/components/FavoriteOrderModal"));
const SaveAsFavoriteModal = lazy(() => import("@/components/SaveAsFavoriteModal"));
import IosInstallModal from "@/components/IosInstallModal";
import { isStandalonePwa, isIos } from "@/lib/push";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { MenuItem, menuItems, toppings, mealSideOptions, mealDrinkOptions, drinkSubOptions } from "@/data/menu";
import { computeCartItemTotal } from "@/lib/cartPricing";
import { useAvailability } from "@/hooks/useAvailability";
import { useRestaurantStatus } from "@/hooks/useRestaurantStatus";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useSavedCart } from "@/hooks/useSavedCart";
import { useAlcoholConsent } from "@/hooks/useAlcoholConsent";
import { useBusinessHours } from "@/hooks/useBusinessHours";
import { Bell } from "lucide-react";
import { uiPositions } from "@/config/uiConfig";
import { useFlyToCart } from "@/contexts/FlyToCartContext";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const { isAvailable } = useAvailability();
  const { status: restaurantStatus } = useRestaurantStatus();
  const { status: businessStatus } = useBusinessHours();
  const { isLoggedIn, customer, loading: authLoading } = useCustomerAuth();
  const isStation = localStorage.getItem("habakta_station") === "true";
  const isClosed = isStation ? !restaurantStatus.station_open : !restaurantStatus.website_open;
  // Manual closure = admin closed website while business hours say we should be open
  const isManualClosure = !isStation && isClosed && businessStatus.isOpen;
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [showKioskWelcome, setShowKioskWelcome] = useState(isStation);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customizerItem, setCustomizerItem] = useState<MenuItem | null>(null);
  // When set, the customizer is opened in EDIT mode for this cart item.
  // On confirm, we replace the cart entry instead of appending a new one.
  const [editingCartId, setEditingCartId] = useState<string | null>(null);
  const [customizerInitial, setCustomizerInitial] = useState<ItemCustomizerInitialState | undefined>(undefined);
  const [dealOpen, setDealOpen] = useState(false);
  const [familyDealOpen, setFamilyDealOpen] = useState(false);
  const [drinkItem, setDrinkItem] = useState<MenuItem | null>(null);
  const [dineIn, setDineIn] = useState<boolean | null>(isStation ? true : null);
  const [sauceSelectorOpen, setSauceSelectorOpen] = useState(false);
  const [selectedSauces, setSelectedSauces] = useState<{ id: string; name: string; quantity: number }[]>([]);
  const [previewItem, setPreviewItem] = useState<MenuItem | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [favoriteModalOpen, setFavoriteModalOpen] = useState(false);
  const [favoriteStartInSetup, setFavoriteStartInSetup] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const isInstalled = typeof window !== "undefined" ? isStandalonePwa() : false;
  const isIosDevice = typeof window !== "undefined" ? isIos() : false;
  const { canPrompt: canNativeInstall, promptInstall } = useInstallPrompt();
  const handleInstallClick = useCallback(async () => {
    // iPhone/iPad: Safari can't trigger install programmatically — show manual steps.
    if (isIosDevice) {
      setInstallModalOpen(true);
      return;
    }
    // Android (Chrome/Edge): trigger the native install prompt if browser captured it.
    if (canNativeInstall) {
      const outcome = await promptInstall();
      if (outcome === "unavailable") setInstallModalOpen(true);
      return;
    }
    // Fallback (desktop / browser hasn't fired the event yet): show instructions.
    setInstallModalOpen(true);
  }, [isIosDevice, canNativeInstall, promptInstall]);
  const [liveTrackerOrder, setLiveTrackerOrder] = useState<{ orderNumber: number; phone: string } | null>(null);
  /**
   * When set, the next ItemCustomizer confirm/close resolves this promise
   * INSTEAD of mutating the cart. Used by the favorite-order modal to let
   * the user build/edit favorite items via the same UI as regular ordering.
   */
  const customizerResolverRef = useRef<((result: CustomizerResult | null) => void) | null>(null);
  const cartButtonRef = useRef<HTMLDivElement>(null);
  const { flyToCart, registerCartTarget } = useFlyToCart();

  // Auto-prompt unauthenticated visitors to log in — ONLY inside the installed PWA (standalone),
  // never on the regular website and never on the kiosk station. Stops once the user is logged in.
  useEffect(() => {
    if (isStation) return;
    if (!isInstalled) return;
    if (authLoading) return;
    if (isLoggedIn) return;
    try {
      if (sessionStorage.getItem("habakta_login_prompted") === "1") return;
    } catch {}
    const t = setTimeout(() => {
      setAuthModalOpen(true);
      try { sessionStorage.setItem("habakta_login_prompted", "1"); } catch {}
    }, 1500);
    return () => clearTimeout(t);
  }, [authLoading, isLoggedIn, isStation, isInstalled]);

  // Re-register the cart target whenever the button mounts/unmounts.
  // The button only renders once the cart has items, so on the very first
  // add we use a small rAF deferral (see flyFromCenter) to give it a frame
  // to appear before launching the animation.
  const cartButtonCallbackRef = useCallback((node: HTMLDivElement | null) => {
    cartButtonRef.current = node;
    registerCartTarget(node);
  }, [registerCartTarget]);

  /** Fire a fly-to-cart from screen center (used after modal confirm). */
  const flyFromCenter = useCallback(() => {
    const sourceRect = new DOMRect(
      window.innerWidth / 2 - 40,
      window.innerHeight / 2 - 40,
      80,
      80,
    );
    flyToCart({ sourceRect });
  }, [flyToCart]);

  const addToCartDirect = useCallback((item: MenuItem & { _menuItemId?: string }) => {
    const menuItemId = item._menuItemId ?? item.id;
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) => (c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { id: item.id, menuItemId, name: item.name, price: item.price, quantity: 1, toppings: [], removals: [], withMeal: false }];
    });
  }, []);

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
      setPreviewItem(item);
    }
  }, []);

  const handleAddItem = useCallback((item: MenuItem) => {
    alcoholConsent.guard(item, () => openItemFlow(item));
  }, [alcoholConsent, openItemFlow]);

  const handleCustomizerConfirm = useCallback(
    (item: MenuItem, quantity: number, selectedToppings: string[], selectedRemovals: string[], withMeal: boolean, mealSideId?: string, mealDrinkId?: string, ownerName?: string) => {
      // BRIDGE mode: a caller (e.g. favorite modal) is awaiting the result —
      // hand it back instead of touching the cart.
      if (customizerResolverRef.current) {
        customizerResolverRef.current({ item, quantity, selectedToppings, selectedRemovals, withMeal, mealSideId, mealDrinkId, ownerName });
        customizerResolverRef.current = null;
        setCustomizerItem(null);
        setEditingCartId(null);
        setCustomizerInitial(undefined);
        return;
      }
      setCart((prev) => {
        // EDIT mode: replace the existing cart entry in-place (preserve order + id).
        if (editingCartId) {
          return prev.map((c) =>
            c.id === editingCartId
              ? { ...c, name: item.name, price: item.price, quantity, toppings: selectedToppings, removals: selectedRemovals, withMeal, mealSideId, mealDrinkId, ownerName }
              : c
          );
        }
        // ADD mode: append a new entry.
        const cartItemId = `${item.id}-${Date.now()}`;
        return [
          ...prev,
          { id: cartItemId, menuItemId: item.id, name: item.name, price: item.price, quantity, toppings: selectedToppings, removals: selectedRemovals, withMeal, mealSideId, mealDrinkId, ownerName },
        ];
      });
      setCustomizerItem(null);
      setEditingCartId(null);
      setCustomizerInitial(undefined);
      // Stay on the menu after add. Fly the item toward the cart icon for
      // a clear "added!" cue. Skip on EDIT (no fly — user is just updating).
      if (!editingCartId) flyFromCenter();
    },
    [editingCartId, flyFromCenter]
  );

  /**
   * Opens the existing ItemCustomizer for a given menu item and resolves with
   * the user's selections (or null if they closed the customizer). Lets the
   * favorite-order modal reuse the full toppings/removals/meal UI.
   */
  const customizeMenuItem = useCallback(
    (menuItem: MenuItem, initialState?: ItemCustomizerInitialState) =>
      new Promise<CustomizerResult | null>((resolve) => {
        customizerResolverRef.current = resolve;
        setCustomizerInitial(initialState);
        setEditingCartId(null);
        setCustomizerItem(menuItem);
      }),
    []
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

  const handleDealConfirm = useCallback(
    (burgers: DealBurgerConfig[], drinks: DealDrinkChoice[]) => {
      const drinksExtra = drinks.reduce((sum, d) => sum + d.extraCost, 0);
      setCart((prev) => [
        ...prev,
        {
          id: `friends-deal-${Date.now()}`,
          menuItemId: "friends-deal",
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
      flyFromCenter();
    },
    [flyFromCenter]
  );

  const handleFamilyDealConfirm = useCallback(
    (burgers: DealBurgerConfig[], drinks: DealDrinkChoice[]) => {
      const drinksExtra = drinks.reduce((sum, d) => sum + d.extraCost, 0);
      setCart((prev) => [
        ...prev,
        {
          id: `family-deal-${Date.now()}`,
          menuItemId: "family-deal",
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
      flyFromCenter();
    },
    [flyFromCenter]
  );

  const handleDrinkConfirm = useCallback(
    (item: MenuItem, selectedDrink: string) => {
      setDrinkItem(null);
      // Show preview with the selected drink variant; preserve canonical menu id for server-side pricing.
      setPreviewItem({
        ...item,
        id: `${item.id}-${selectedDrink}-${Date.now()}`,
        name: `${item.name} — ${selectedDrink}`,
        _menuItemId: item.id,
      } as MenuItem);
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
      return sum + computeCartItemTotal(item);
    }, 0);
    // Add extra sauce cost
    if (dineIn === false && selectedSauces.length > 0) {
      const totalSauceQty = selectedSauces.reduce((sum, s) => sum + s.quantity, 0);
      const extraSauces = Math.max(0, totalSauceQty - freeSauces);
      base += extraSauces;
    }
    return base;
  };

  // ── Saved cart (server + localStorage) ─────────────────────────────────
  // Pause persistence + prompt while checkout is in progress (already an active order).
  const cartTotal = getTotal();
  const {
    savedCart,
    suppressNextSave,
    markResumed,
    discardSaved,
    dismissPrompt,
  } = useSavedCart({
    cart,
    dineIn,
    total: cartTotal,
    paused: checkoutOpen || isStation,
  });

  const handleResumeSavedCart = useCallback(() => {
    if (!savedCart) return;
    suppressNextSave();
    setCart(savedCart.items);
    if (savedCart.dineIn !== null && dineIn === null) {
      setDineIn(savedCart.dineIn);
    }
    markResumed();
    setCartOpen(true);
  }, [savedCart, suppressNextSave, dineIn, markResumed]);

  const handleStartOver = useCallback(() => {
    discardSaved();
  }, [discardSaved]);

  const handleDineInChoice = (val: boolean) => {
    setDineIn(val);
    setTimeout(() => {
      document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Persistent order tracking top bar */}
      {!isStation && <OrderTopBar />}

      {/* Business hours status bar — sticky, public-facing only */}
      {!isStation && <BusinessStatusBar />}

      {/* Top action row: hamburger menu + customer greeting / login */}
      {!isStation && (
        <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border" dir="rtl">
          <SideMenu
            onLoginClick={() => setAuthModalOpen(true)}
            onUpdateFavorite={() => { setFavoriteStartInSetup(true); setFavoriteModalOpen(true); }}
          />
          <div className="flex items-center gap-2">
            {!isInstalled && (
              <button
                onClick={handleInstallClick}
                className="animate-wiggle-dance flex items-center gap-1.5 px-3 py-2 rounded-full bg-green-600 hover:bg-green-700 text-white transition-colors text-xs font-bold shadow-lg shadow-green-600/40"
                aria-label="הוסף למסך הבית"
              >
                <span>הוסף למסך הבית</span>
                <span aria-hidden>📲</span>
              </button>
            )}
            {isLoggedIn ? (
              <CustomerGreeting onOpenHistory={() => setHistoryModalOpen(true)} />
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-semibold"
              >
                <LogIn size={16} />
                התחברות
              </button>
            )}
          </div>
        </div>
      )}

      {/* "Welcome back" hero strip + favorite-order CTA — full-width row, logged-in customers only */}
      {!isStation && isLoggedIn && customer && !isClosed && (
        <div className="w-full px-4 py-3 bg-gradient-to-l from-green-500/10 via-primary/5 to-transparent border-b border-border" dir="rtl">
          <h2 className="text-lg sm:text-2xl font-black text-foreground leading-tight text-center sm:text-right">
            כיף שחזרת {customer.name.split(" ")[0]}🥰✨
          </h2>
          <button
            onClick={() => {
              setFavoriteStartInSetup(false);
              setFavoriteModalOpen(true);
            }}
            className="animate-dance-loop mt-2 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-green-600 hover:bg-green-700 text-white font-bold text-sm sm:text-base shadow-lg shadow-green-600/40 transition-colors"
          >
            <span aria-hidden>❤️</span>
            אני רוצה את הקבוע שלי
          </button>
        </div>
      )}

      {/* Kiosk welcome screen */}
      {isStation && showKioskWelcome && !isClosed && (
        <KioskWelcome onStart={() => setShowKioskWelcome(false)} />
      )}

      {isClosed && (
        <div className="bg-destructive text-destructive-foreground text-center py-4 px-6 font-bold text-lg sticky top-0 z-50">
          {isManualClosure
            ? "⏸️ האתר סגור כרגע עקב עומס · נחזור בקרוב!"
            : "🚫 המסעדה סגורה כרגע להזמנות · נשמח לראות אתכם בפעם הבאה!"}
        </div>
      )}

      {!isClosed && totalItems > 0 && !cartOpen && (
        <div ref={cartButtonCallbackRef} className={uiPositions.cartButton.position}>
          <button
            onClick={() => setCartOpen(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-black px-5 py-3.5 rounded-full flex items-center gap-3 shadow-xl shadow-green-600/40 transition-colors"
            dir="rtl"
          >
            <span className="relative flex items-center justify-center w-9 h-9 rounded-full bg-white/20">
              <ShoppingBag size={20} />
              <span className="absolute -top-1 -right-1 bg-white text-green-700 text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                {totalItems}
              </span>
            </span>
            <span className="text-base">סיום הזמנה</span>
          </button>
        </div>
      )}

      {!isStation && <HeroSection onDineInChoice={isClosed ? undefined : handleDineInChoice} dineIn={dineIn} />}
      {isClosed ? (
        <div className="py-16 text-center px-6">
          <p className="text-6xl mb-4">{isManualClosure ? "⏸️" : "🔒"}</p>
          <p className="text-2xl font-black text-foreground mb-2">
            {isManualClosure ? "האתר סגור כרגע עקב עומס" : "ההזמנות סגורות כרגע"}
          </p>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            {isManualClosure
              ? "אנחנו עובדים על להוריד את העומס ונחזור בהקדם. השאירו לנו מספר ונעדכן אתכם ברגע שנפתח שוב 🙏"
              : "נחזור בקרוב!"}
          </p>
          {!isStation && (
            <button
              onClick={() => setReopenModalOpen(true)}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-black px-6 py-3 rounded-xl shadow-lg shadow-primary/30 hover:scale-105 transition-transform"
            >
              <Bell size={20} />
              עדכנו אותי כשנפתח שוב
            </button>
          )}
        </div>
      ) : dineIn !== null ? (
        <MenuSection onAddItem={handleAddItem} dineIn={dineIn} onDineInChange={setDineIn} isAvailable={isAvailable} isKiosk={isStation} />
      ) : null}

      <Suspense fallback={null}>
        {customizerItem && (
          <ItemCustomizer
            item={customizerItem}
            onClose={() => {
              // If a favorite-modal flow is awaiting this customizer, cancel it.
              if (customizerResolverRef.current) {
                customizerResolverRef.current(null);
                customizerResolverRef.current = null;
              }
              setCustomizerItem(null);
              setEditingCartId(null);
              setCustomizerInitial(undefined);
            }}
            onConfirm={handleCustomizerConfirm}
            isAvailable={isAvailable}
            initialState={customizerInitial}
          />
        )}

        {drinkItem && (
          <DrinkSelector
            item={drinkItem}
            onClose={() => setDrinkItem(null)}
            onConfirm={handleDrinkConfirm}
            isAvailable={isAvailable}
          />
        )}

        {dealOpen && (
          <DealCustomizer
            open={dealOpen}
            onClose={() => setDealOpen(false)}
            onConfirm={handleDealConfirm}
            isAvailable={isAvailable}
          />
        )}

        {familyDealOpen && (
          <FamilyDealCustomizer
            open={familyDealOpen}
            onClose={() => setFamilyDealOpen(false)}
            onConfirm={handleFamilyDealConfirm}
            isAvailable={isAvailable}
          />
        )}

        {cartOpen && (
          <KioskCartDrawer
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
            onQuickAdd={(item) => addToCartDirect(item)}
            onSelectDrink={(item) => {
              setCartOpen(false);
              setDrinkItem(item);
            }}
            onBackToMenu={() => {
              setCartOpen(false);
              setTimeout(() => {
                document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" });
              }, 100);
            }}
            isAvailable={isAvailable}
            onEditItem={handleEditCartItem}
            isKiosk={isStation}
          />
        )}

        {sauceSelectorOpen && (
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
        )}
      </Suspense>
      <ItemPreview
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        onAdd={(item) => addToCartDirect(item)}
        cartButtonRef={cartButtonRef}
      />

      <Suspense fallback={null}>
        <AnimatePresence>
          {checkoutOpen && (
            <CheckoutForm
              items={cart}
              total={getTotal()}
              sauces={selectedSauces}
              freeSauces={freeSauces}
              onClose={() => setCheckoutOpen(false)}
              onSuccess={(orderNumber, phone) => {
                setCheckoutOpen(false);
                setCart([]);
                if (isStation) {
                  setShowKioskWelcome(true);
                } else if (orderNumber) {
                  const trackedOrder = { orderNumber, phone, notificationsEnabled: false, soundEnabled: false };
                  setTrackedOrder(trackedOrder);
                  setLiveTrackerOrder({ orderNumber, phone: phone ?? "" });
                  window.dispatchEvent(new CustomEvent("track-order", { detail: trackedOrder }));
                  toast({
                    title: "ההזמנה התקבלה בהצלחה 🎉",
                    description:
                      "ניתן להתעדכן בסטטוס ההזמנה בכל זמן דרך האתר (בחלק העליון), גם אם יצאת מהאתר.",
                    duration: 10000,
                  });
                  // Offer push notifications to users who haven't decided yet
                  if (typeof Notification !== "undefined" && Notification.permission === "default") {
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent("request-notify-permission"));
                    }, 2500);
                  }
                }
              }}
            />
          )}
        </AnimatePresence>
      </Suspense>

      {!isStation && (
        <footer className="py-8 text-center border-t border-border space-y-3">
          <p className="text-foreground font-bold">הַבִּקְתָּה — המבורגר של מושבניקים 🐄</p>
          <p className="text-muted-foreground text-sm">כשר בהשגחת הרבנות · בשר שדות נגב</p>
          <a
            href="tel:058-4633-555"
            className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
          >
            <Phone size={14} />
            058-4633-555
          </a>
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2">
            <a href="/privacy" className="hover:text-foreground transition-colors">מדיניות פרטיות</a>
            <span>·</span>
            <a href="/terms" className="hover:text-foreground transition-colors">תנאי שימוש</a>
            <span>·</span>
            <a href="/cookie-policy" className="hover:text-foreground transition-colors">מדיניות עוגיות</a>
          </div>
        </footer>
      )}

      <Suspense fallback={null}>
        <AccessibilityWidget />
        {authModalOpen && (
          <CustomerAuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
        )}

        {alcoholConsent.consentOpen && (
          <AlcoholConsentModal
            open={alcoholConsent.consentOpen}
            isKiosk={isStation}
            onConfirm={alcoholConsent.confirm}
            onCancel={alcoholConsent.cancel}
          />
        )}

        {reopenModalOpen && (
          <ReopenNotifyModal open={reopenModalOpen} onClose={() => setReopenModalOpen(false)} />
        )}

        {!!savedCart && cart.length === 0 && !checkoutOpen && !isStation && (
          <SavedCartModal
            open={true}
            savedCart={savedCart}
            customerName={customer?.name ?? null}
            onResume={handleResumeSavedCart}
            onStartOver={handleStartOver}
            onDismiss={dismissPrompt}
          />
        )}

        {historyModalOpen && (
          <OrderHistoryModal
            open={historyModalOpen}
            onClose={() => setHistoryModalOpen(false)}
            onReorder={(newItems) => {
              setCart((prev) => [...prev, ...newItems]);
              setCartOpen(true);
            }}
          />
        )}

        {liveTrackerOrder && (
          <OrderLiveTracker
            orderNumber={liveTrackerOrder.orderNumber}
            phone={liveTrackerOrder.phone}
            onClose={() => setLiveTrackerOrder(null)}
          />
        )}

        <IosInstallModal open={installModalOpen} onClose={() => setInstallModalOpen(false)} />

        <FavoriteOrderModal
          open={favoriteModalOpen}
          onClose={() => { setFavoriteModalOpen(false); setFavoriteStartInSetup(false); }}
          currentCart={cart}
          startInSetup={favoriteStartInSetup}
          customizeMenuItem={customizeMenuItem}
          onUseFavorite={(items, mode) => {
            setCart((prev) => [...prev, ...items]);
            if (mode === "checkout") {
              setCartOpen(false);
              setCheckoutOpen(true);
            } else {
              setCartOpen(true);
            }
          }}
        />
      </Suspense>
    </div>
  );
};

export default Index;
