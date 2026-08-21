import { useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import OrderTopBar, { getTrackedOrder, setTrackedOrder } from "@/components/OrderTopBar";
import BusinessStatusBar from "@/components/BusinessStatusBar";
import SideMenu from "@/components/SideMenu";
import KioskWelcome from "@/components/KioskWelcome";
import CustomerGreeting from "@/components/CustomerGreeting";
import ItemPreview from "@/components/ItemPreview";
import OrderSuccessModal from "@/components/OrderSuccessModal";

// Lazy-loaded: only needed once the user opens a modal/customizer/checkout.
// This trims the initial JS bundle significantly (ItemCustomizer alone ~1300 lines).
const KioskCartDrawer = lazy(() => import("@/components/KioskCartDrawer"));
const CheckoutForm = lazy(() => import("@/components/CheckoutForm"));
const ItemCustomizer = lazy(() => import("@/components/ItemCustomizer"));
const DealCustomizer = lazy(() => import("@/components/DealCustomizer"));
const FamilyDealCustomizer = lazy(() => import("@/components/FamilyDealCustomizer"));
const DrinkSelector = lazy(() => import("@/components/DrinkSelector"));
const ArayesCustomizer = lazy(() => import("@/components/ArayesCustomizer"));
const SauceSelector = lazy(() => import("@/components/SauceSelector"));
// AccessibilityWidget is now mounted globally in App.tsx via AccessibilityWidgetGlobal.
const CustomerAuthModal = lazy(() => import("@/components/CustomerAuthModal"));
const SavedCartModal = lazy(() => import("@/components/SavedCartModal"));
const AlcoholConsentModal = lazy(() => import("@/components/AlcoholConsentModal"));
const ReopenNotifyModal = lazy(() => import("@/components/ReopenNotifyModal"));
const OrderHistoryModal = lazy(() => import("@/components/OrderHistoryModal"));
const OrderLiveTracker = lazy(() => import("@/components/OrderLiveTracker"));
const FavoriteOrderModal = lazy(() => import("@/components/FavoriteOrderModal"));
const DeliveryFlow = lazy(() => import("@/components/DeliveryFlow"));
import type { DeliveryApprovedData } from "@/components/DeliveryFlow";

import IosInstallModal from "@/components/IosInstallModal";
import { isStandalonePwa, isIos } from "@/lib/push";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { MenuItem, menuItems, toppings, mealSideOptions, mealDrinkOptions, drinkSubOptions, sauceOptions } from "@/data/menu";
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
import { toast } from "sonner";

import { useTrackCustomerActivity } from "@/hooks/useCustomerActivity";

const Index = () => {
  const { isAvailable } = useAvailability();
  const { status: restaurantStatus, resolved: statusResolved } = useRestaurantStatus();
  const { status: businessStatus } = useBusinessHours();
  const { isLoggedIn, customer, loading: authLoading, favoriteItems } = useCustomerAuth();
  const isStation = localStorage.getItem("habakta_station") === "true";
  const isClosed = isStation ? !restaurantStatus.station_open : !restaurantStatus.website_open;
  // Manual closure = admin closed website while business hours say we should be open
  const [browseMenuOpen, setBrowseMenuOpen] = useState(false);
  const isManualClosure = !isStation && isClosed && businessStatus.isOpen;
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [savedConfirmOpen, setSavedConfirmOpen] = useState(false);
  const [showKioskWelcome, setShowKioskWelcome] = useState(isStation);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutSkipDetails, setCheckoutSkipDetails] = useState(false);
  const [customizerItem, setCustomizerItem] = useState<MenuItem | null>(null);
  // When set, the customizer is opened in EDIT mode for this cart item.
  // On confirm, we replace the cart entry instead of appending a new one.
  const [editingCartId, setEditingCartId] = useState<string | null>(null);
  const [customizerInitial, setCustomizerInitial] = useState<ItemCustomizerInitialState | undefined>(undefined);
  const [dealOpen, setDealOpen] = useState(false);
  const [familyDealOpen, setFamilyDealOpen] = useState(false);
  const [drinkItem, setDrinkItem] = useState<MenuItem | null>(null);
  const [arayesItem, setArayesItem] = useState<MenuItem | null>(null);
  const [dineIn, setDineIn] = useState<boolean | null>(isStation ? true : null);
  const [deliveryFlowOpen, setDeliveryFlowOpen] = useState(false);
  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryApprovedData | null>(null);
  const [sauceSelectorOpen, setSauceSelectorOpen] = useState(false);
  const [selectedSauces, setSelectedSauces] = useState<{ id: string; name: string; quantity: number }[]>([]);
  const [previewItem, setPreviewItem] = useState<MenuItem | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [favoriteModalOpen, setFavoriteModalOpen] = useState(false);
  const [favoriteStartInSetup, setFavoriteStartInSetup] = useState(false);
  
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [postInstallInstructionsOpen, setPostInstallInstructionsOpen] = useState(false);
  const isInstalled = typeof window !== "undefined" ? isStandalonePwa() : false;
  // iOS partitions PWA storage from Safari (iOS 17.4+), so auto-login from a Safari order
  // does NOT carry into the installed PWA. Only on iOS PWA we must prompt the user once.
  const needsManualLogin = typeof window !== "undefined" ? isInstalled && isIos() : false;
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

  useEffect(() => {
    const openPostInstallInstructions = () => setPostInstallInstructionsOpen(true);
    window.addEventListener("open-post-install-instructions", openPostInstallInstructions);
    return () => window.removeEventListener("open-post-install-instructions", openPostInstallInstructions);
  }, []);

  const [liveTrackerOrder, setLiveTrackerOrder] = useState<{ orderNumber: number; phone: string } | null>(null);
  // Big confirmation shown right after an order is created (prevents double orders).
  const [successOrder, setSuccessOrder] = useState<{ orderNumber: number; note?: string } | null>(null);

  // Auto-open the live tracker/timer when the customer returns to the site
  // and still has an active order saved in localStorage. Skip in kiosk/station mode.
  useEffect(() => {
    const isStationMode = localStorage.getItem("habakta_station") === "true";
    if (isStationMode) return;
    const tracked = getTrackedOrder();
    if (tracked?.phone) {
      setLiveTrackerOrder({ orderNumber: tracked.orderNumber, phone: tracked.phone });
    }
  }, []);
  /**
   * When set, the next ItemCustomizer confirm/close resolves this promise
   * INSTEAD of mutating the cart. Used by the favorite-order modal to let
   * the user build/edit favorite items via the same UI as regular ordering.
   */
  const customizerResolverRef = useRef<((result: CustomizerResult | null) => void) | null>(null);
  const cartButtonRef = useRef<HTMLDivElement>(null);
  const { flyToCart, registerCartTarget } = useFlyToCart();

  // Auto-prompt unauthenticated visitors to log in — ONLY inside the installed PWA on iOS,
  // where Safari's storage is partitioned from the PWA so auto-login from the order can't work.
  // On Android PWA / regular web / kiosk we never prompt. Stops once the user is logged in.
  useEffect(() => {
    if (isStation) return;
    if (!needsManualLogin) return;
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
  }, [authLoading, isLoggedIn, isStation, needsManualLogin]);

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

  // Anonymous "customer is building an order" signal for the kitchen dashboard.
  // Active ONLY while the customer is actively on an ordering screen
  // (a customizer/selector modal is open). Disappears immediately when
  // they close it or leave the tab. Not shown from the in-store kiosk.
  const isBuildingOrder =
    !isStation &&
    (!!customizerItem ||
      !!drinkItem ||
      !!arayesItem ||
      dealOpen ||
      familyDealOpen ||
      sauceSelectorOpen ||
      !!previewItem);
  useTrackCustomerActivity(isBuildingOrder);

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
      setPreviewItem(item);
    }
  }, []);

  const handleAddItem = useCallback((item: MenuItem) => {
    alcoholConsent.guard(item, () => openItemFlow(item));
  }, [alcoholConsent, openItemFlow]);

  const handleCustomizerConfirm = useCallback(
    (item: MenuItem, quantity: number, selectedToppings: string[], selectedRemovals: string[], withMeal: boolean, mealSideId?: string, mealDrinkId?: string, ownerName?: string, sideItems?: Array<{ itemId: string; qty: number }>) => {
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
              name: m.name,
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
      // Add the chosen drink variant directly to the cart — no second confirmation needed.
      addToCartDirect({
        ...item,
        id: `${item.id}-${selectedDrink}-${Date.now()}`,
        name: `${item.name} — ${selectedDrink}`,
        _menuItemId: item.id,
      } as MenuItem & { _menuItemId?: string });
      // Same fly-to-cart cue as the kiosk so the customer sees the can was added.
      flyFromCenter();
    },
    [addToCartDirect, flyFromCenter]
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
  const FRIED_SIDE_IDS = ["fries", "sweet-potato-fries", "onion-rings", "tempura-onion"];
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
  const sideFreeSauces = cart.reduce((sum, item) => {
    if (item.dealBurgers) return sum;
    const menuItem = menuItems.find(m => m.name === item.name || item.id.startsWith(m.id));
    if (!menuItem) return sum;
    if (menuItem.id === "friends-mix") return sum + 5 * item.quantity;
    if (FRIED_SIDE_IDS.includes(menuItem.id)) return sum + 2 * item.quantity;
    return sum;
  }, 0);
  const freeSauces = burgerCount > 0 ? burgerCount * 3 : sideFreeSauces;

  const getTotal = () => {
    // computeCartItemTotal already handles deals (base + per-burger toppings)
    // AND regular items, so we use it for everything.
    let base = cart.reduce((sum, item) => sum + computeCartItemTotal(item), 0);
    // Add extra sauce cost (premium priced sauces always billed; regular sauces above the free quota billed at 1₪ each)
    if (dineIn === false && selectedSauces.length > 0) {
      let regularQty = 0;
      let premiumCost = 0;
      for (const s of selectedSauces) {
        const opt = sauceOptions.find((x) => x.id === s.id);
        if (opt?.price) premiumCost += opt.price * s.quantity;
        else regularQty += s.quantity;
      }
      const extraSauces = Math.max(0, regularQty - freeSauces);
      base += extraSauces + premiumCost;
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
    setDeliveryInfo(null);
    setTimeout(() => {
      document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleDeliveryChoice = () => {
    setDeliveryFlowOpen(true);
  };

  const handleDeliveryApproved = (data: DeliveryApprovedData) => {
    setDeliveryInfo(data);
    setDeliveryFlowOpen(false);
    setDineIn(false); // treat like takeaway for menu/pricing
    toast.success("נמצא שליח! 🛵", { description: "אפשר להתחיל להזמין" });
    setTimeout(() => {
      document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Until the open/closed state is known (first ever visit, no cached value),
  // show a spinner instead of optimistically rendering the "open" UI.
  if (!statusResolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

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
            <a
              href="https://waze.com/ul?q=דרך%20ערבי%20נחל%2023%20תושיה"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="נווט למסעדה עם Waze"
              className="w-9 h-9 hover:scale-105 active:scale-95 transition-transform overflow-hidden shrink-0"
            >
              <img src="/waze-icon.png" alt="Waze" className="w-full h-full object-cover" />
            </a>
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

      {totalItems > 0 && !cartOpen && (
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
            <span className="text-base">{isClosed ? "שמור הזמנה לשליחה מאוחרת" : "סיום הזמנה"}</span>
          </button>
        </div>
      )}

      {!isStation && (
        <HeroSection
          onDineInChoice={isClosed ? undefined : handleDineInChoice}
          onDeliveryChoice={isClosed ? undefined : handleDeliveryChoice}
          showDelivery={restaurantStatus.delivery_enabled}
          dineIn={dineIn}
        />
      )}
      {isClosed ? (
        <div className="py-12 text-center px-6">
          <p className="text-6xl mb-4">{isManualClosure ? "⏸️" : "🔒"}</p>
          <p className="text-2xl font-black text-foreground mb-2">
            {isManualClosure ? "האתר סגור כרגע עקב עומס" : "ההזמנות סגורות כרגע"}
          </p>
          <p className="text-base text-muted-foreground mb-6 max-w-md mx-auto">
            {isManualClosure
              ? "אנחנו עובדים על להוריד את העומס ונחזור בהקדם."
              : "המטבח סגור להזמנות כרגע — נשמח לראות אתכם בפעם הבאה!"}
          </p>

          <div className="mb-6">
            <button
              onClick={() => {
                setDineIn(false);
                setBrowseMenuOpen(true);
                setTimeout(() => document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" }), 100);
              }}
              className="inline-flex flex-col items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-black px-8 py-5 rounded-2xl shadow-xl shadow-green-600/30 hover:scale-105 transition-transform"
            >
              <span className="text-xl">📝 הרכיבו הזמנה לשמירה</span>
              <span className="text-sm font-normal opacity-90">תישמר אצלכם — תצטרכו לחזור ולשלוח אותה כשנפתח</span>
            </button>
          </div>

          {!isStation && (
            <button
              onClick={() => setReopenModalOpen(true)}
              className="inline-flex items-center gap-2 border border-primary/30 bg-primary/10 text-primary font-bold px-6 py-3 rounded-xl hover:bg-primary/20 transition-colors"
            >
              <Bell size={20} />
              עדכנו אותי כשנפתח שוב
            </button>
          )}
        </div>
      ) : dineIn !== null ? (
        <MenuSection onAddItem={handleAddItem} dineIn={dineIn} onDineInChange={setDineIn} isAvailable={isAvailable} isKiosk={isStation} />
      ) : null}

      {isClosed && browseMenuOpen && (
        <Suspense fallback={null}>
          <div className="pb-10">
            <div className="sticky top-[72px] z-40 bg-amber-100 dark:bg-amber-950 border-y border-amber-200 dark:border-amber-800 py-3 px-4">
              <p className="text-center text-amber-900 dark:text-amber-100 font-black text-sm md:text-base">
                ⚠️ המטבח סגור כרגע להזמנות. ההזמנה תישמר אצלכם — חזרו ושלחו אותה בעצמכם כשנפתח.
              </p>
            </div>
            <MenuSection
              onAddItem={handleAddItem}
              dineIn={false}
              onDineInChange={() => {}}
              isAvailable={isAvailable}
              isKiosk={isStation}
            />
          </div>
        </Suspense>
      )}

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
            dineIn={isClosed ? false : dineIn}
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

        {arayesItem && (
          <ArayesCustomizer
            item={arayesItem}
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
        )}


        {cartOpen && (
          <KioskCartDrawer
            open={cartOpen}
            onClose={() => setCartOpen(false)}
            items={cart}
            onUpdateQuantity={updateQuantity}
            onCheckout={() => {
              if (isClosed) {
                setCartOpen(false);
                setSavedConfirmOpen(true);
                return;
              }
              if (deliveryInfo && getTotal() < 300) {
                toast.error("מינימום הזמנה למשלוח 300₪", {
                  description: `הסכום הנוכחי: ${getTotal()}₪. יש להוסיף עוד ${Math.max(0, 300 - getTotal())}₪`,
                });
                return;
              }
              setCartOpen(false);
              if (dineIn === false && freeSauces > 0) {
                setSauceSelectorOpen(true);
              } else {
                setCheckoutOpen(true);
              }
            }}
            onQuickAdd={(item) => {
              if (item.id === "arayes-special" || item.id === "arayes-special-4") {
                setCartOpen(false);
                openItemFlow(item);
                return;
              }
              addToCartDirect(item);
            }}
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
            isClosed={isClosed}
          />
        )}

        {sauceSelectorOpen && (
          <SauceSelector
            open={sauceSelectorOpen}
            freeSauces={freeSauces}
            isAvailable={isAvailable}
            isKiosk={isStation}
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
              dineIn={dineIn}
              items={cart}
              total={getTotal()}
              sauces={selectedSauces}
              freeSauces={freeSauces}
              skipDetails={checkoutSkipDetails}
              delivery={deliveryInfo ?? undefined}
              onClose={() => { setCheckoutOpen(false); setCheckoutSkipDetails(false); }}
              onSuccess={(orderNumber, phone) => {
                // Snapshot the cart BEFORE clearing — used for the
                // "save as your regular" post-order prompt.
                const orderedSnapshot = cart.slice();
                setCheckoutOpen(false);
                setCheckoutSkipDetails(false);
                setCart([]);
                setDeliveryInfo(null);
                // Order was placed — discard any saved cart so the
                // "continue previous order" modal doesn't pop up later.
                suppressNextSave();
                void discardSaved();
                if (isStation) {
                  setShowKioskWelcome(true);
                } else if (orderNumber) {
                  const trackedOrder = { orderNumber, phone, notificationsEnabled: false, soundEnabled: false };
                  setTrackedOrder(trackedOrder);
                  setLiveTrackerOrder({ orderNumber, phone: phone ?? "" });
                  window.dispatchEvent(new CustomEvent("track-order", { detail: trackedOrder }));
                  setSuccessOrder({ orderNumber });
                  // Offer push notifications to users who haven't decided yet
                  if (typeof Notification !== "undefined" && Notification.permission === "default") {
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent("request-notify-permission"));
                    }, 2500);
                  }
                  // Save-as-favorite prompt is now shown BEFORE payment
                  // (inside CheckoutForm), not after the order completes.
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
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground pt-2">
            <a href="/privacy" className="hover:text-foreground transition-colors">מדיניות פרטיות</a>
            <span>·</span>
            <a href="/terms" className="hover:text-foreground transition-colors">תנאי שימוש</a>
            <span>·</span>
            <a href="/cookie-policy" className="hover:text-foreground transition-colors">מדיניות עוגיות</a>
            <span>·</span>
            <a href="/accessibility-statement" className="hover:text-foreground transition-colors">הצהרת נגישות</a>
            <span>·</span>
            <a href="/unsubscribe" className="hover:text-foreground transition-colors">הסרה מרשימת תפוצה</a>
          </div>
        </footer>
      )}

      <Suspense fallback={null}>
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

        {/* SaveAsFavoriteModal moved into CheckoutForm (pre-payment). */}

        {!!savedCart && cart.length === 0 && !checkoutOpen && !isStation && savedCart.items.reduce((s, i) => s + (i.quantity || 0), 0) >= 3 && (
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

        {successOrder && (
          <OrderSuccessModal
            orderNumber={successOrder.orderNumber}
            note={successOrder.note}
            onClose={() => setSuccessOrder(null)}
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
        {deliveryFlowOpen && (
          <DeliveryFlow
            open={deliveryFlowOpen}
            onClose={() => setDeliveryFlowOpen(false)}
            onApproved={handleDeliveryApproved}
          />
        )}
        <IosInstallModal
          open={postInstallInstructionsOpen}
          postInstallOpen
          onClose={() => setPostInstallInstructionsOpen(false)}
        />

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
              setCheckoutSkipDetails(true);
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
