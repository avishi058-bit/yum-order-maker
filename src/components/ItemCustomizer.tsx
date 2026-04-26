import { useState, useRef, useCallback, useEffect } from "react";
import { flushSync } from "react-dom";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, Utensils } from "lucide-react";
import { MenuItem, toppings, Topping, smashBurgerIds, ingredients, mealUpgrade, mealSideOptions, mealDrinkOptions, drinkToAvailabilityId, donenessOptions, DEFAULT_DONENESS, excludedToppingsByItem } from "@/data/menu";
import { menuImages } from "@/data/menuImages";
import { useAlcoholConsent } from "@/hooks/useAlcoholConsent";
import AlcoholConsentModal from "@/components/AlcoholConsentModal";
import aioliImg from "@/assets/aioli-sauce.webp";
import picklesImg from "@/assets/pickles.webp";
import tomatoImg from "@/assets/tomato.webp";
import onionImg from "@/assets/onion.webp";
import mapleImg from "@/assets/maple.webp";
import onionRingsImg from "@/assets/onion-rings.webp";
import garlicConfitImg from "@/assets/garlic-confit.webp";
import friedOnionImg from "@/assets/fried-onion.webp";
import onionJamImg from "@/assets/onion-jam.webp";
import extraPattyImg from "@/assets/extra-patty.webp";
import donenessMediumImg from "@/assets/doneness-medium.webp";
import donenessMediumWellImg from "@/assets/doneness-medium-well.webp";
import donenessWellDoneImg from "@/assets/doneness-well-done.webp";

const donenessImages: Record<string, string> = {
  "doneness-medium": donenessMediumImg,
  "doneness-medium-well": donenessMediumWellImg,
  "doneness-well-done": donenessWellDoneImg,
};

const ingredientImages: Record<string, string> = {
  "aioli-sauce": aioliImg,
  "pickles": picklesImg,
  "tomato": tomatoImg,
  "onion": onionImg,
  "maple": mapleImg,
  "onion-rings": onionRingsImg,
  "garlic-confit": garlicConfitImg,
  "fried-onion": friedOnionImg,
  "onion-jam": onionJamImg,
  "extra-patty": extraPattyImg,
};

export interface ItemCustomizerInitialState {
  quantity: number;
  selectedToppings: string[];
  selectedRemovals: string[];
  withMeal: boolean;
  mealSideId?: string;
  mealDrinkId?: string;
  ownerName?: string;
}

interface ItemCustomizerProps {
  item: MenuItem | null;
  onClose: () => void;
  onConfirm: (item: MenuItem, quantity: number, selectedToppings: string[], selectedRemovals: string[], withMeal: boolean, mealSideId?: string, mealDrinkId?: string, ownerName?: string) => void;
  isAvailable?: (id: string) => boolean;
  /** When set, the customizer opens with these values prefilled — used for
   *  editing an item already in the cart. */
  initialState?: ItemCustomizerInitialState;
}

type Step = "customize" | "meal-upgrade" | "side-select" | "drink-select";

// Hero image collapse parameters (kept tiny — pure transform/opacity, no layout)
const HERO_HEIGHT = 280;          // initial hero height in px (mobile/web)
const HERO_HEIGHT_KIOSK_DEFAULT = 380; // kiosk hero height (admin-tunable via CSS var)
const HERO_MIN_SCALE = 0.55;      // scale at full collapse
const HERO_FADE_DISTANCE = 200;   // px of scroll before image fully fades

// Read the live admin-tuned kiosk hero height from the CSS var (set by useKioskCSSVars).
// Falls back to the default if not present (non-kiosk pages).
const readKioskHeroHeight = () => {
  if (typeof window === "undefined") return HERO_HEIGHT_KIOSK_DEFAULT;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--kiosk-image-h").trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : HERO_HEIGHT_KIOSK_DEFAULT;
};

// Drag-to-close parameters
const DRAG_CLOSE_THRESHOLD = 120; // px the user must drag down to close
const DRAG_MAX_TRACK = 400;       // cap on drag distance (resistance)

const ItemCustomizer = ({ item, onClose, onConfirm, isAvailable, initialState }: ItemCustomizerProps) => {
  const location = useLocation();
  const isKiosk = location.pathname === "/kiosk";
  const [quantity, setQuantity] = useState(1);
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [ingredientState, setIngredientState] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState<Step>("customize");
  const [selectedSide, setSelectedSide] = useState<string>("side-fries");
  const [selectedDrink, setSelectedDrink] = useState<string>("drink-cola");
  const [selectedDoneness, setSelectedDoneness] = useState<string>(DEFAULT_DONENESS);
  // Optional "owner name" — chef sees who each dish belongs to.
  // Toggle controls whether the input is shown; only sent if non-empty.
  const [ownerNameEnabled, setOwnerNameEnabled] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const ownerInputRef = useRef<HTMLInputElement>(null);
  const alcoholConsent = useAlcoholConsent();
  const [glutenConfirmOpen, setGlutenConfirmOpen] = useState(false);
  const [toppingsSeen, setToppingsSeen] = useState(false);
  const toppingsRef = useRef<HTMLDivElement>(null);

  // Prefill state when opening for an EDIT (initialState provided alongside item).
  // We only run this when the item id changes so the user's edits aren't clobbered
  // by re-renders, and we treat a new item-open as a fresh prefill cycle.
  useEffect(() => {
    if (!item) return;
    const itemIsSmash = smashBurgerIds.includes(item.baseBurgerId || item.id);
    if (initialState) {
      setQuantity(initialState.quantity || 1);
      setSelectedToppings(initialState.selectedToppings || []);
      const restoredRemovals = initialState.selectedRemovals || [];
      const donenessFromRemovals = restoredRemovals.find(r => r.startsWith("doneness-"));
      setSelectedDoneness(donenessFromRemovals || DEFAULT_DONENESS);
      // Restore ingredient state from saved removals
      const savedRemovals = restoredRemovals.filter(r => !r.startsWith("doneness-"));
      const restored: Record<string, boolean> = {};
      ingredients.forEach(ing => {
        const def = itemIsSmash ? ing.defaultSmash : ing.defaultRegular;
        // Check if removal is present → ingredient is OFF
        if (savedRemovals.includes(ing.removalId)) {
          restored[ing.id] = false;
        } else if (ing.addId && savedRemovals.includes(ing.addId)) {
          // Addition present → ingredient is ON (from non-default)
          restored[ing.id] = true;
        } else {
          restored[ing.id] = def;
        }
      });
      setIngredientState(restored);
      setSelectedSide(initialState.mealSideId || "side-fries");
      setSelectedDrink(initialState.mealDrinkId || "drink-cola");
      setOwnerName(initialState.ownerName || "");
      setOwnerNameEnabled(!!(initialState.ownerName && initialState.ownerName.length > 0));
      setStep("customize");
    } else {
      // Fresh open — set defaults
      const defaults: Record<string, boolean> = {};
      ingredients.forEach(ing => {
        defaults[ing.id] = itemIsSmash ? ing.defaultSmash : ing.defaultRegular;
      });
      setIngredientState(defaults);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const buildAlcoholDrinkGateItem = (drinkId: string): MenuItem => ({
    id: `beer-${drinkId}`,
    name: "",
    description: "",
    price: 0,
    category: "drink",
  });

  // Helpers used by the drink-select step to gate alcohol selection.
  const isAlcoholDrinkId = (drinkId: string) => {
    const opt = mealDrinkOptions.find((d) => d.id === drinkId);
    return opt?.category === "beer";
  };

  const handleDrinkSelection = (drinkId: string) => {
    if (isAlcoholDrinkId(drinkId)) {
      alcoholConsent.guard(buildAlcoholDrinkGateItem(drinkId), () => setSelectedDrink(drinkId));
      return;
    }

    setSelectedDrink(drinkId);
  };

  // Refs for direct DOM transforms (no re-renders during drag/scroll)
  const sheetRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Drag state (refs only — no re-render while dragging)
  const dragState = useRef({
    active: false,
    startY: 0,
    currentY: 0,
    pointerId: 0 as number,
    rafId: 0 as number,
  });

  // Ref-bound close handler so drag callbacks defined before handleClose
  // can still call the latest version without hitting a TDZ error.
  const handleCloseRef = useRef<() => void>(() => {});

  const heroHeight = isKiosk ? readKioskHeroHeight() : HERO_HEIGHT;
  const heroImage = item ? menuImages[item.id] || menuImages[item.baseBurgerId || ""] : null;
  const showHero = !!heroImage && step === "customize";
  const showCollapsingHero = showHero && !isKiosk;
  const showStaticScrollHero = showHero && isKiosk;

  // Apply hero transform from scrollTop — direct DOM, no setState.
  // Wolt-style: hero shrinks in real height (so content fills the gap and the
  // sticky header stays at the very top), while the image inside parallaxes & fades.
  // SAME behavior on website + kiosk — only the base height differs (admin-tunable).
  const applyHeroTransform = useCallback((scrollTop: number) => {
    if (isKiosk) return;
    const hero = heroRef.current;
    const img = heroImgRef.current;
    if (!hero || !img) return;
    const baseHeight = isKiosk ? readKioskHeroHeight() : HERO_HEIGHT;
    const clamped = Math.max(0, Math.min(scrollTop, HERO_FADE_DISTANCE));
    const t = clamped / HERO_FADE_DISTANCE;       // 0 → 1
    const newHeight = baseHeight * (1 - t);
    hero.style.height = `${newHeight}px`;
    const translateY = -clamped * 0.35;
    const opacity = 1 - t;
    img.style.transform = `translate3d(0, ${translateY}px, 0)`;
    img.style.opacity = String(opacity);
  }, [isKiosk]);


  // Scroll handler — passive, RAF-throttled, no setState
  const scrollRafRef = useRef(0);
  const handleScroll = useCallback(() => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      const el = scrollRef.current;
      if (!el) return;
      applyHeroTransform(el.scrollTop);
    });
  }, [applyHeroTransform]);

  // Drag-to-close — pointer events + RAF + transform on the sheet root
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const sc = scrollRef.current;
    if (sc && sc.scrollTop > 0) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const target = e.target as HTMLElement | null;
    if (target?.closest("button, a, input, textarea, select, label")) return;

    dragState.current.active = true;
    dragState.current.startY = e.clientY;
    dragState.current.currentY = e.clientY;
    dragState.current.pointerId = e.pointerId;

    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    if (sheet) sheet.style.transition = "none";
    if (backdrop) backdrop.style.transition = "none";

    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragState.current;
    if (!ds.active || e.pointerId !== ds.pointerId) return;

    const dy = e.clientY - ds.startY;

    // Only react to downward drags
    if (dy <= 0) {
      const sheet = sheetRef.current;
      const backdrop = backdropRef.current;
      if (sheet) sheet.style.transform = "translate3d(0,0,0)";
      if (backdrop) backdrop.style.opacity = "0.5";
      ds.currentY = e.clientY;
      return;
    }

    e.preventDefault();
    ds.currentY = e.clientY;
    if (ds.rafId) return;

    ds.rafId = requestAnimationFrame(() => {
      ds.rafId = 0;
      const delta = ds.currentY - ds.startY;
      const tracked = Math.min(delta, DRAG_MAX_TRACK);
      const sheet = sheetRef.current;
      const backdrop = backdropRef.current;

      if (sheet) {
        sheet.style.transform = `translate3d(0, ${tracked}px, 0)`;
        sheet.style.transition = "none";
      }

      if (backdrop) {
        const fade = 0.5 * (1 - Math.min(1, tracked / 400));
        backdrop.style.opacity = String(fade);
      }
    });
  }, []);

  const finishDrag = useCallback(() => {
    const ds = dragState.current;
    if (!ds.active) return;

    const delta = ds.currentY - ds.startY;
    ds.active = false;

    if (ds.rafId) {
      cancelAnimationFrame(ds.rafId);
      ds.rafId = 0;
    }

    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;

    if (delta >= DRAG_CLOSE_THRESHOLD) {
      if (sheet) {
        sheet.style.transition = "transform 200ms cubic-bezier(0.4,0,0.2,1)";
        sheet.style.transform = "translate3d(0, 100%, 0)";
      }
      if (backdrop) {
        backdrop.style.transition = "opacity 200ms ease-out";
        backdrop.style.opacity = "0";
      }
      window.setTimeout(() => handleCloseRef.current(), 180);
    } else {
      if (sheet) {
        sheet.style.transition = "transform 220ms cubic-bezier(0.4,0,0.2,1)";
        sheet.style.transform = "translate3d(0,0,0)";
      }
      if (backdrop) {
        backdrop.style.transition = "opacity 220ms ease-out";
        backdrop.style.opacity = "0.5";
      }
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    finishDrag();
  }, [finishDrag]);

  const onPointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    finishDrag();
  }, [finishDrag]);

  // Reset hero/scroll transform when step changes back to customize
  useEffect(() => {
    if (step === "customize") {
      const sc = scrollRef.current;
      if (sc) sc.scrollTop = 0;
      applyHeroTransform(0);
    }
  }, [step, applyHeroTransform]);

  // Track whether the toppings section has been scrolled into view
  useEffect(() => {
    const el = toppingsRef.current;
    const container = scrollRef.current;
    if (!el || !container) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setToppingsSeen(true); },
      { root: container, threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [item?.id, step]);

  if (!item) return null;


  const sideToAvailability: Record<string, string> = {
    "side-fries": "fries",
    "side-waffle": "waffle-fries",
    "side-onion-rings": "onion-rings",
    "side-tempura": "tempura-onion",
  };

  const isSideUnavailable = (sideId: string) => {
    const availId = sideToAvailability[sideId];
    if (!availId || !isAvailable) return false;
    return !isAvailable(availId);
  };

  const isDrinkUnavailable = (drinkId: string) => {
    const availId = drinkToAvailabilityId[drinkId];
    if (!availId || !isAvailable) return false;
    return !isAvailable(availId);
  };

  const isBurger = item.category === "burger" || item.category === "meal";
  const isMeal = item.category === "meal";
  const isSmash = smashBurgerIds.includes(item.baseBurgerId || item.id);

  const VEGAN_CHEDDAR_MAX = 6;

  const toggleTopping = (id: string) => {
    if (id === "vegan-cheddar") {
      // Vegan cheddar supports multiple slices (counted by occurrences in the array)
      setSelectedToppings((prev) =>
        prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
      );
      return;
    }
    if (id === "gluten-free-bun" && !selectedToppings.includes(id)) {
      // Require explicit allergen acknowledgement before adding GF bun
      setGlutenConfirmOpen(true);
      return;
    }
    setSelectedToppings((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const confirmGlutenFreeBun = () => {
    setSelectedToppings((prev) =>
      prev.includes("gluten-free-bun") ? prev : [...prev, "gluten-free-bun"]
    );
    setGlutenConfirmOpen(false);
  };

  const addCheddarSlice = () => {
    setSelectedToppings((prev) => {
      const count = prev.filter((t) => t === "vegan-cheddar").length;
      if (count >= VEGAN_CHEDDAR_MAX) return prev;
      return [...prev, "vegan-cheddar"];
    });
  };

  const removeCheddarSlice = () => {
    setSelectedToppings((prev) => {
      const idx = prev.lastIndexOf("vegan-cheddar");
      if (idx === -1) return prev;
      const copy = [...prev];
      copy.splice(idx, 1);
      return copy;
    });
  };

  const toggleIngredient = (id: string) => {
    setIngredientState(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const setAllIngredientsOff = () => {
    setIngredientState(prev => {
      const next: Record<string, boolean> = {};
      Object.keys(prev).forEach(k => { next[k] = false; });
      return next;
    });
  };

  /** Convert ingredient state to removals array for backend */
  const computeRemovals = (): string[] => {
    const result: string[] = [];
    ingredients.forEach(ing => {
      const isOn = ingredientState[ing.id] ?? (isSmash ? ing.defaultSmash : ing.defaultRegular);
      const def = isSmash ? ing.defaultSmash : ing.defaultRegular;
      if (def && !isOn) {
        // Was default ON, customer turned OFF → removal
        result.push(ing.removalId);
      } else if (!def && isOn && ing.addId) {
        // Was default OFF, customer turned ON → addition
        result.push(ing.addId);
      }
    });
    return result;
  };

  const toppingsCost = selectedToppings.reduce((sum, tId) => {
    const t = toppings.find((tp) => tp.id === tId);
    return sum + (t?.price || 0);
  }, 0);

  const unitPrice = item.price + toppingsCost;
  const totalPrice = unitPrice * quantity;

  const goToSideSelect = () => {
    if (isSideUnavailable(selectedSide)) {
      const firstAvailable = mealSideOptions.find((s) => !isSideUnavailable(s.id));
      if (firstAvailable) setSelectedSide(firstAvailable.id);
    }
    setStep("side-select");
  };

  const handleNext = () => {
    // If burger and user hasn't scrolled to see toppings, scroll there first
    if (isBurger && step === "customize" && !toppingsSeen && toppingsRef.current && scrollRef.current) {
      toppingsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      setToppingsSeen(true);
      return;
    }
    if (isMeal && step === "customize") {
      goToSideSelect();
    } else if (isBurger && step === "customize") {
      setStep("meal-upgrade");
    } else {
      handleFinish(false);
    }
  };

  const handleFinish = (withMeal: boolean, sideId?: string, drinkId?: string) => {
    const trimmedOwner = ownerNameEnabled ? ownerName.trim() : "";
    const donenessCategoryOn = !isAvailable || isAvailable("doneness-category");
    const donenessOptionOn = !isAvailable || isAvailable(selectedDoneness);
    const includeDoneness = isBurger && !isSmash && donenessCategoryOn && donenessOptionOn;
    const finalRemovals = [
      ...computeRemovals(),
      ...(includeDoneness ? [selectedDoneness] : []),
    ];
    onConfirm(
      item,
      quantity,
      selectedToppings,
      finalRemovals,
      withMeal,
      sideId,
      drinkId,
      trimmedOwner || undefined,
    );
    resetState();
  };

  const resetState = () => {
    setQuantity(1);
    setSelectedToppings([]);
    setIngredientState({});
    setSelectedDoneness(DEFAULT_DONENESS);
    setStep("customize");
    setSelectedSide("side-fries");
    setSelectedDrink("drink-cola");
    setOwnerNameEnabled(false);
    setOwnerName("");
    setToppingsSeen(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };
  // Keep the ref pointing at the latest handleClose for drag callbacks above.
  handleCloseRef.current = handleClose;

  const softDrinks = mealDrinkOptions.filter(d => d.category === "soft");
  const beerDrinks = mealDrinkOptions.filter(d => d.category === "beer");

  // Meal-upgrade is rendered as a centered modal (independent overlay)
  const isMealUpgrade = step === "meal-upgrade";

  return (
    <>
      <AnimatePresence>
      {item && (
        <>
          {/* Backdrop for the main sheet — hidden when meal-upgrade modal is shown */}
          {!isMealUpgrade && (
            <motion.div
              ref={backdropRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleClose}
              className="fixed inset-0 bg-black z-50"
              style={{ willChange: "opacity" }}
            />
          )}

          {/* Main sheet (full-screen, hero on top, scrollable content). Hidden under meal-upgrade modal. */}
          {!isMealUpgrade && (
            <motion.div
              ref={sheetRef}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320, mass: 0.9 }}
              className={`fixed left-0 right-0 z-50 bg-white text-black flex flex-col rounded-t-3xl shadow-2xl overflow-hidden ${
                isKiosk ? "bottom-0" : "inset-0"
              }`}
              style={{
                willChange: "transform",
                touchAction: "pan-y",
                // Kiosk: cap modal height via admin-controlled CSS var so the
                // burger remains visible behind it. Falls back to 70vh.
                ...(isKiosk
                  ? { top: "auto", height: "var(--kiosk-modal-h, 70vh)", maxHeight: "var(--kiosk-modal-h, 70vh)" }
                  : {}),
              }}
              dir="rtl"
            >
              {/* Drag surface for header / hero */}
              <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                className="relative shrink-0 select-none"
                style={{ touchAction: "none" }}
              >
                {/* Pull handle */}
                <div className="flex justify-center pt-3 pb-2">
                  <div className="w-12 h-1.5 rounded-full bg-gray-300" />
                </div>

                {/* Header (close button + title) */}
                <div className={`flex items-center justify-between px-5 pb-3 ${isKiosk ? "px-8 pb-4" : ""}`}>
                  <button
                    onClick={handleClose}
                    className={`rounded-full bg-gray-100 flex items-center justify-center ${isKiosk ? "w-16 h-16" : "w-10 h-10"}`}
                  >
                    <X size={isKiosk ? 32 : 20} />
                  </button>
                  <h2 className={`font-black flex-1 text-center ${isKiosk ? "text-[34px]" : "text-xl"}`}>{item.name}</h2>
                  <div className={isKiosk ? "w-16" : "w-10"} />
                </div>

                {/* Hero image (only on customize step, only if image exists) */}
                {showCollapsingHero && (
                  <div
                    ref={heroRef}
                    data-kiosk-hero={isKiosk ? "true" : undefined}
                    className="relative w-full overflow-hidden"
                    style={{
                      height: heroHeight,
                      // Contain layout/paint inside the hero so per-frame height
                      // changes during scroll don't trigger a reflow of the
                      // surrounding modal — kills the scroll-jitter on kiosk.
                      contain: "layout paint size",
                      willChange: "height",
                    }}
                  >
                    <img
                      ref={heroImgRef}
                      src={heroImage as string}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      style={{
                        willChange: "transform, opacity",
                        transformOrigin: "center center",
                      }}
                      draggable={false}
                    />
                  </div>
                )}
              </div>

              {/* Scrollable content */}
              <AnimatePresence mode="wait">
                {step === "customize" && (
                  <motion.div
                    key="customize"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="flex-1 overflow-y-auto overscroll-contain"
                    ref={scrollRef}
                    onScroll={isKiosk ? undefined : handleScroll}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerCancel}
                    style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y", overflowAnchor: "none" }}
                  >
                    {showStaticScrollHero && (
                      <div
                        data-kiosk-hero="true"
                        className="relative w-full shrink-0 overflow-hidden"
                        style={{ height: heroHeight, contain: "layout paint size", overflowAnchor: "none" }}
                      >
                        <img
                          src={heroImage as string}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          draggable={false}
                          decoding="sync"
                        />
                      </div>
                    )}
                    {(item.id === "haf-mifsha" || item.baseBurgerId === "haf-mifsha") && (
                      <div className={`mx-5 mt-4 rounded-xl border-2 border-destructive bg-destructive/10 ${isKiosk ? "p-5" : "p-3"}`}>
                        <p className={`font-black text-destructive text-right ${isKiosk ? "text-[20px]" : "text-sm"}`}>
                          ⚠️ שימו לב: מבושל באזור בשרי, אין הפרדה מוחלטת מהבשר
                        </p>
                      </div>
                    )}
                    {/* Owner-name field — printed on the kitchen receipt above this item.
                        Helpful when one customer orders multiple dishes.
                        Placed at the TOP so it's the first thing the customer sees. */}
                    {isBurger && (
                      <div className={`mx-5 ${isKiosk ? "mt-4" : "mt-3"}`}>
                        {!ownerNameEnabled && (
                          <button
                            type="button"
                            // onPointerDown fires earlier in the touch lifecycle
                            // than onClick — gives Safari/iOS the user-gesture
                            // window it needs to allow programmatic .focus()
                            // to open the on-screen keyboard.
                            onPointerDown={(e) => {
                              e.preventDefault();
                              const el = ownerInputRef.current;
                              if (el) {
                                el.focus({ preventScroll: true } as any);
                                // Some Android/Chromium kiosks need a click too
                                try { el.click(); } catch {}
                              }
                              setOwnerNameEnabled(true);
                            }}
                            className={`w-full bg-primary text-primary-foreground font-black rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform flex flex-col items-center justify-center gap-1 ${isKiosk ? "py-5 px-4" : "py-4 px-3"}`}
                          >
                            <span className={`flex items-center gap-2 ${isKiosk ? "text-[22px]" : "text-lg"}`}>
                              <span>לחץ כדי להוסיף שם למנה</span>
                              <span>✍🏼</span>
                            </span>
                            <span className={`text-black font-black ${isKiosk ? "text-[16px]" : "text-xs"}`}>
                              (רלוונטי למי שמזמין יותר ממנה אחת)
                            </span>
                          </button>
                        )}
                        {ownerNameEnabled && (
                          <div className={`rounded-xl border border-gray-300 bg-white ${isKiosk ? "px-4 py-3" : "px-3 py-2.5"}`}>
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <h3 className={`font-black text-black flex items-center gap-1.5 ${isKiosk ? "text-[22px]" : "text-base"}`}>
                                <span>👤</span>
                                <span>שם על המנה</span>
                              </h3>
                              <button
                                type="button"
                                onClick={() => { setOwnerName(""); setOwnerNameEnabled(false); }}
                                className={`text-gray-500 underline ${isKiosk ? "text-[16px]" : "text-xs"}`}
                              >
                                ביטול
                              </button>
                            </div>
                          </div>
                        )}
                        {/* Input is ALWAYS mounted and visible (clipped when
                            disabled). iOS Safari refuses programmatic focus
                            on display:none/opacity:0/visibility:hidden inputs
                            — clip-path keeps it 'visible' to the engine. */}
                        <input
                          ref={ownerInputRef}
                          type="text"
                          value={ownerName}
                          onChange={(e) => setOwnerName(e.target.value.slice(0, 30))}
                          placeholder="שם (למשל: יוסי)"
                          maxLength={30}
                          inputMode="text"
                          enterKeyHint="done"
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="words"
                          spellCheck={false}
                          name="dish-owner-name"
                          dir="rtl"
                          aria-hidden={!ownerNameEnabled}
                          tabIndex={ownerNameEnabled ? 0 : -1}
                          style={
                            ownerNameEnabled
                              ? { fontSize: "16px" }
                              : {
                                  position: "absolute",
                                  width: 1,
                                  height: 1,
                                  padding: 0,
                                  margin: 0,
                                  border: 0,
                                  clipPath: "inset(50%)",
                                  whiteSpace: "nowrap",
                                  fontSize: "16px",
                                }
                          }
                          className={
                            ownerNameEnabled
                              ? `mt-2 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-right focus:outline-none focus:border-gray-500 transition-colors block`
                              : ""
                          }
                        />
                      </div>
                    )}

                    {/* Doneness selector — only for non-smash burgers, only if category is available */}
                    {isBurger && !isSmash && (!isAvailable || isAvailable("doneness-category")) && (() => {
                      const visibleOptions = donenessOptions.filter(d => !isAvailable || isAvailable(d.id));
                      if (visibleOptions.length === 0) return null;
                      return (
                        <div className={`px-5 border-b border-gray-200 ${isKiosk ? "px-8 py-6" : "py-4"}`}>
                          <h3 className={`font-black text-right mb-1 ${isKiosk ? "text-[30px] mb-3" : "text-lg"}`}>בחר מידת עשייה</h3>
                          <p className={`text-gray-500 text-right ${isKiosk ? "text-[20px] mb-5" : "text-sm mb-3"}`}>חובה לבחור אחת</p>
                          <div className="space-y-0">
                            {visibleOptions.map((d) => {
                              const active = selectedDoneness === d.id;
                              return (
                                <button
                                  key={d.id}
                                  onClick={() => setSelectedDoneness(d.id)}
                                  className={`w-full flex items-center justify-between border-b border-gray-100 last:border-b-0 ${isKiosk ? "py-5" : "py-3"}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`rounded-full border-2 flex items-center justify-center transition-colors ${isKiosk ? "w-9 h-9" : "w-7 h-7"} ${
                                        active ? "border-primary bg-primary" : "border-gray-300"
                                      }`}
                                    >
                                      {active && <div className="w-3 h-3 rounded-full bg-white" />}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {d.recommended && (
                                      <span className={`font-bold bg-green-500 text-white rounded-full whitespace-nowrap ${isKiosk ? "text-[16px] px-3 py-1.5" : "text-xs px-2 py-1"}`}>
                                        מומלץ
                                      </span>
                                    )}
                                    <span className={`font-bold flex items-center gap-1.5 ${isKiosk ? "text-[26px]" : "text-base"}`}>
                                      {d.label} ({d.shortLabel})
                                      {d.image && donenessImages[d.image] && (
                                        <img src={donenessImages[d.image]} alt={d.label} className={`inline-block object-contain rounded ${isKiosk ? "w-14 h-14" : "w-10 h-10"}`} />
                                      )}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {isBurger && (
                      <>
                        <div className={`px-5 border-b border-gray-200 ${isKiosk ? "px-8 py-6" : "py-4"}`}>
                          <h3 className={`font-black text-right mb-1 ${isKiosk ? "text-[30px] mb-3" : "text-lg"}`}>מה במנה שלך</h3>
                          <p className={`text-gray-500 text-right ${isKiosk ? "text-[20px] mb-5" : "text-sm mb-3"}`}>לחץ כדי להוסיף או להוריד</p>
                          <div className="space-y-0">
                            {ingredients.map((ing) => {
                              const isOn = ingredientState[ing.id] ?? (isSmash ? ing.defaultSmash : ing.defaultRegular);
                              const ingredientUnavailable = isAvailable ? !isAvailable(ing.id) : false;
                              if (ingredientUnavailable) return null;
                              return (
                                <button
                                  key={ing.id}
                                  onClick={() => toggleIngredient(ing.id)}
                                  className={`w-full flex items-center justify-between border-b border-gray-100 last:border-b-0 ${isKiosk ? "py-5" : "py-3"}`}
                                >
                                  <div
                                    className={`rounded-lg border-2 flex items-center justify-center transition-colors ${isKiosk ? "w-9 h-9" : "w-7 h-7"} ${
                                      isOn ? "border-green-500 bg-green-500" : "border-gray-300 bg-white"
                                    }`}
                                  >
                                    {isOn && (
                                      <svg className={`text-white ${isKiosk ? "w-6 h-6" : "w-4 h-4"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    )}
                                  </div>
                                  <span className={`font-bold ${isKiosk ? "text-[30px]" : "text-lg"} ${!isOn ? "text-gray-400 line-through" : ""} flex items-center gap-1.5`}>
                                    {ing.name.includes("🥬") ? (
                                      <>
                                        {ing.name.replace("🥬 ", "")} 🥬
                                      </>
                                    ) : ing.name}
                                    {ing.image && ingredientImages[ing.image] ? (
                                      <img src={ingredientImages[ing.image]} alt={ing.name} className={`inline-block object-contain ${isKiosk ? "w-9 h-9" : "w-7 h-7"}`} />
                                    ) : null}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className={`px-5 ${isKiosk ? "px-8 py-6" : "py-4"}`} ref={toppingsRef}>
                          <h3 className={`font-black text-right mb-1 ${isKiosk ? "text-[30px] mb-3" : "text-lg"}`}>תוספות בתשלום</h3>
                          <p className={`text-gray-500 text-right ${isKiosk ? "text-[20px] mb-5" : "text-sm mb-3"}`}>אפשר לבחור עד ל-9 פריטים</p>
                          <div className="space-y-0">
                            {toppings
                              .filter((t: Topping) => !isAvailable || isAvailable(t.id))
                              .filter((t: Topping) => {
                                // Per-item topping exclusions (e.g. don't offer onion jam on a burger that already has it)
                                const baseId = item.baseBurgerId || item.id;
                                const excluded = excludedToppingsByItem[baseId];
                                if (excluded && excluded.includes(t.id)) return false;
                                // Smash burgers: hide regular extra patty, show smash extra patty.
                                // Non-smash burgers: hide smash extra patty, show regular extra patty.
                                if (t.id === "extra-patty") return !isSmash;
                                if (t.id === "extra-smash-patty") return isSmash;
                                return true;
                              })
                              .sort((a, b) => {
                                // For double cheese items, move vegan-cheddar to top
                                const isDoubleCheeseItem = item.id === "smash-double-cheese" || item.baseBurgerId === "smash-double-cheese" || item.id === "meal-smash-double-cheese";
                                if (isDoubleCheeseItem) {
                                  if (a.id === "vegan-cheddar") return -1;
                                  if (b.id === "vegan-cheddar") return 1;
                                }
                                return 0;
                              })
                              .map((t: Topping) => {
                              const isCheddar = t.id === "vegan-cheddar";
                              const cheddarCount = isCheddar ? selectedToppings.filter((id) => id === "vegan-cheddar").length : 0;
                              const active = isCheddar ? cheddarCount > 0 : selectedToppings.includes(t.id);
                              const showRecommended = t.recommended && (item.id === "smash-double-cheese" || item.baseBurgerId === "smash-double-cheese" || item.id === "meal-smash-double-cheese");

                              if (isCheddar) {
                                return (
                                  <div
                                    key={t.id}
                                    className={`w-full flex items-center justify-between border-b border-gray-100 last:border-b-0 ${isKiosk ? "py-5" : "py-3"}`}
                                  >
                                    {/* Left: stepper + price */}
                                    <div className="flex items-center gap-3">
                                      {cheddarCount > 0 ? (
                                        <div className={`flex items-center gap-2 ${isKiosk ? "text-[20px]" : "text-base"}`}>
                                          <button
                                            onClick={removeCheddarSlice}
                                            className={`rounded-full bg-secondary hover:bg-border flex items-center justify-center active:scale-95 transition ${isKiosk ? "w-10 h-10" : "w-8 h-8"}`}
                                            aria-label="הסר פרוסה"
                                          >
                                            <Minus size={isKiosk ? 18 : 14} />
                                          </button>
                                          <span className={`font-black w-6 text-center ${isKiosk ? "text-[22px]" : "text-base"}`}>{cheddarCount}</span>
                                          <button
                                            onClick={addCheddarSlice}
                                            disabled={cheddarCount >= VEGAN_CHEDDAR_MAX}
                                            className={`rounded-full bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center active:scale-95 transition disabled:opacity-40 ${isKiosk ? "w-10 h-10" : "w-8 h-8"}`}
                                            aria-label="הוסף פרוסה"
                                          >
                                            <Plus size={isKiosk ? 18 : 14} />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={addCheddarSlice}
                                          className={`rounded-full bg-primary text-primary-foreground font-bold flex items-center gap-1 active:scale-95 transition ${isKiosk ? "px-4 py-2 text-[18px]" : "px-3 py-1.5 text-sm"}`}
                                        >
                                          <Plus size={isKiosk ? 18 : 14} />
                                          הוסף
                                        </button>
                                      )}
                                      <span className={`text-gray-500 font-medium ${isKiosk ? "text-[20px]" : "text-sm"}`}>+ ₪{t.price} לפרוסה</span>
                                    </div>
                                    {/* Right: name */}
                                    <div className="flex items-center gap-3">
                                      <span className={`font-bold flex items-center gap-1.5 ${isKiosk ? "text-[30px]" : "text-lg"}`}>
                                      {t.name}
                                      {t.image && ingredientImages[t.image] ? (
                                        <img src={ingredientImages[t.image]} alt={t.name} className={`inline-block object-contain ${t.image === "extra-patty" ? (isKiosk ? "w-[60px] h-[60px]" : "w-12 h-12") : (isKiosk ? "w-9 h-9" : "w-7 h-7")}`} />
                                      ) : null}
                                    </span>
                                      {showRecommended && (
                                        <span className={`font-bold bg-green-500 text-white rounded-full whitespace-nowrap ${isKiosk ? "text-[16px] px-3 py-1.5" : "text-xs px-2 py-1"}`}>
                                          🔥 הולך טוב עם המנה
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <button
                                  key={t.id}
                                  onClick={() => toggleTopping(t.id)}
                                  className={`w-full flex items-center justify-between border-b border-gray-100 last:border-b-0 ${isKiosk ? "py-5" : "py-3"}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`rounded-full border-2 flex items-center justify-center transition-colors ${isKiosk ? "w-9 h-9" : "w-7 h-7"} ${
                                        active ? "border-primary bg-primary" : "border-gray-300"
                                      }`}
                                    >
                                      {active && <div className="w-3 h-3 rounded-full bg-white" />}
                                    </div>
                                    <span className={`text-gray-500 font-medium ${isKiosk ? "text-[20px]" : "text-sm"}`}>+ ₪{t.price}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`font-bold flex items-center gap-1.5 ${isKiosk ? "text-[30px]" : "text-lg"}`}>
                                      {t.name}
                                      {t.image && ingredientImages[t.image] ? (
                                        <img src={ingredientImages[t.image]} alt={t.name} className={`inline-block object-contain ${t.image === "extra-patty" ? (isKiosk ? "w-[60px] h-[60px]" : "w-12 h-12") : (isKiosk ? "w-9 h-9" : "w-7 h-7")}`} />
                                      ) : null}
                                    </span>
                                    {showRecommended && (
                                      <span className={`font-bold bg-green-500 text-white rounded-full whitespace-nowrap ${isKiosk ? "text-[16px] px-3 py-1.5" : "text-xs px-2 py-1"}`}>
                                        🔥 הולך טוב עם המנה
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}

                    {!isBurger && (
                      <div className="px-5 py-8 text-center text-muted-foreground">
                        {item.description && <p className="text-sm">{item.description}</p>}
                        <p className="text-lg font-bold text-primary mt-3">₪{item.price}</p>
                      </div>
                    )}

                    {/* moved: owner-name field is now rendered ABOVE the שינויים section */}

                    {/* Bottom spacer so footer never overlaps content */}
                    <div className="h-4" />
                  </motion.div>
                )}

                {step === "side-select" && (
                  <motion.div
                    key="side-select"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className={`flex-1 overflow-y-auto ${isKiosk ? "px-8 py-8" : "px-5 py-6"}`}
                  >
                    <h3 className={`font-black text-center ${isKiosk ? "text-[30px] mb-8" : "text-lg mb-4"}`}>בחר סוג צ׳יפס לעסקית:</h3>
                    <div className="space-y-0">
                      {mealSideOptions.map((side) => {
                        const unavailable = isSideUnavailable(side.id);
                        const active = selectedSide === side.id && !unavailable;
                        return (
                          <button
                            key={side.id}
                            onClick={() => !unavailable && setSelectedSide(side.id)}
                            disabled={unavailable}
                            className={`w-full flex items-center justify-between border-b border-gray-100 last:border-b-0 ${isKiosk ? "py-5" : "py-4"} ${
                              unavailable ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`rounded-full border-2 flex items-center justify-center transition-colors ${isKiosk ? "w-9 h-9" : "w-7 h-7"} ${
                                  active ? "border-primary bg-primary" : "border-gray-300"
                                }`}
                              >
                                {active && <div className="w-3 h-3 rounded-full bg-white" />}
                              </div>
                              {side.price > 0 && !unavailable && (
                                <span className={`text-gray-500 font-medium ${isKiosk ? "text-[20px]" : "text-base"}`}>+₪{side.price}</span>
                              )}
                              {unavailable && (
                                <span className={`font-bold text-destructive ${isKiosk ? "text-[18px]" : "text-sm"}`}>(אזל מהמלאי כרגע)</span>
                              )}
                            </div>
                            <span className={`font-bold ${isKiosk ? "text-[26px]" : "text-lg"} ${unavailable ? "line-through text-gray-400" : ""}`}>{side.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => {
                        if (isDrinkUnavailable(selectedDrink)) {
                          const firstAvail = mealDrinkOptions.find((d) => !isDrinkUnavailable(d.id));
                          if (firstAvail) setSelectedDrink(firstAvail.id);
                        }
                        setStep("drink-select");
                      }}
                      className={`w-full bg-primary text-primary-foreground font-black rounded-xl shadow-lg shadow-primary/20 mt-6 active:scale-[0.98] transition-transform ${isKiosk ? "py-5 text-[22px]" : "py-4 text-lg"}`}
                    >
                      המשך
                    </button>
                  </motion.div>
                )}

                {step === "drink-select" && (
                  <motion.div
                    key="drink-select"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className={`flex-1 overflow-y-auto ${isKiosk ? "px-8 py-8" : "px-5 py-6"}`}
                  >
                    <h3 className={`font-black text-center ${isKiosk ? "text-[30px] mb-8" : "text-lg mb-4"}`}>בחר שתייה לעסקית:</h3>

                    <div className="space-y-0">
                      {softDrinks.map((drink) => {
                        const active = selectedDrink === drink.id;
                        const unavailable = isDrinkUnavailable(drink.id);
                        return (
                          <button
                            key={drink.id}
                            disabled={unavailable}
                            onClick={() => !unavailable && setSelectedDrink(drink.id)}
                            className={`w-full flex items-center justify-between border-b border-gray-100 last:border-b-0 ${isKiosk ? "py-5" : "py-4"} ${unavailable ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`rounded-full border-2 flex items-center justify-center transition-colors ${isKiosk ? "w-9 h-9" : "w-7 h-7"} ${
                                  unavailable ? "border-gray-200" : active ? "border-primary bg-primary" : "border-gray-300"
                                }`}
                              >
                                {active && !unavailable && <div className="w-3 h-3 rounded-full bg-white" />}
                              </div>
                              {unavailable && <span className={`text-destructive ${isKiosk ? "text-[18px]" : "text-sm"}`}>(אזל מהמלאי)</span>}
                            </div>
                            <span className={`font-bold ${isKiosk ? "text-[26px]" : "text-lg"} ${unavailable ? "line-through text-gray-400" : ""}`}>{drink.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    <h4 className={`font-black text-right mt-6 mb-3 ${isKiosk ? "text-[26px]" : "text-base"}`}>בירות:</h4>
                    <div className="space-y-0">
                      {beerDrinks.map((drink) => {
                        const active = selectedDrink === drink.id;
                        const unavailable = isDrinkUnavailable(drink.id);
                        return (
                          <button
                            key={drink.id}
                            disabled={unavailable}
                            onClick={() => !unavailable && handleDrinkSelection(drink.id)}
                            className={`w-full flex items-center justify-between border-b border-gray-100 last:border-b-0 ${isKiosk ? "py-5" : "py-4"} ${unavailable ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`rounded-full border-2 flex items-center justify-center transition-colors ${isKiosk ? "w-9 h-9" : "w-7 h-7"} ${
                                  unavailable ? "border-gray-200" : active ? "border-primary bg-primary" : "border-gray-300"
                                }`}
                              >
                                {active && !unavailable && <div className="w-3 h-3 rounded-full bg-white" />}
                              </div>
                              {unavailable && <span className={`text-destructive ${isKiosk ? "text-[18px]" : "text-sm"}`}>(אזל מהמלאי)</span>}
                              {!unavailable && <span className={`text-gray-500 font-medium ${isKiosk ? "text-[20px]" : "text-base"}`}>+₪{drink.price}</span>}
                            </div>
                            <span className={`font-bold ${isKiosk ? "text-[26px]" : "text-lg"} ${unavailable ? "line-through text-gray-400" : ""}`}>{drink.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => {
                        if (isAlcoholDrinkId(selectedDrink)) {
                          alcoholConsent.guard(
                            buildAlcoholDrinkGateItem(selectedDrink),
                            () => handleFinish(true, selectedSide, selectedDrink),
                          );
                          return;
                        }

                        handleFinish(true, selectedSide, selectedDrink);
                      }}
                      className={`w-full bg-primary text-primary-foreground font-black rounded-xl shadow-lg shadow-primary/20 mt-6 active:scale-[0.98] transition-transform ${isKiosk ? "py-5 text-[22px]" : "py-4 text-lg"}`}
                    >
                      הוספה להזמנה 🍔
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom bar - only on customize step */}
              {step === "customize" && (
                <div className={`border-t border-gray-200 flex items-center gap-3 bg-white safe-bottom ${isKiosk ? "px-8 py-6" : "px-5 py-4"}`}>
                  <button
                    onClick={handleNext}
                    className={`flex-1 bg-primary text-primary-foreground font-black rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform ${isKiosk ? "py-5 text-[22px]" : "py-4 text-lg"}`}
                  >
                    {isBurger ? "המשך" : `הוספה להזמנה · ₪${totalPrice}`}
                  </button>
                  <div className={`flex items-center gap-3 bg-gray-100 rounded-xl ${isKiosk ? "px-5 py-4" : "px-4 py-3"}`}>
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className={`rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors ${isKiosk ? "w-12 h-12" : "w-10 h-10"}`}
                    >
                      <Minus size={isKiosk ? 22 : 18} />
                    </button>
                    <span className={`font-black text-center ${isKiosk ? "text-[22px] w-10" : "text-lg w-8"}`}>{quantity}</span>
                    <button
                      onClick={() => setQuantity((q) => q + 1)}
                      className={`rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors ${isKiosk ? "w-12 h-12" : "w-10 h-10"}`}
                    >
                      <Plus size={isKiosk ? 22 : 18} />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Meal-upgrade — independent centered modal (fade + scale only, opens directly in center) */}
          {isMealUpgrade && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => handleFinish(false)}
                className="fixed inset-0 bg-black z-50"
                style={{ willChange: "opacity" }}
              />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  className={`bg-white text-black w-full rounded-3xl shadow-2xl pointer-events-auto ${
                    isKiosk ? "max-w-2xl p-12" : "max-w-md p-8"
                  }`}
                  dir="rtl"
                  style={{ willChange: "transform, opacity" }}
                >
                  <div className="flex flex-col items-center text-center">
                    <div className={`rounded-full bg-primary/10 flex items-center justify-center ${
                      isKiosk ? "w-32 h-32 mb-8" : "w-20 h-20 mb-6"
                    }`}>
                      <Utensils size={isKiosk ? 64 : 36} className="text-primary" />
                    </div>
                    <h3 className={`font-black mb-4 ${isKiosk ? "text-[40px]" : "text-xl mb-3"}`}>לשדרג לארוחה עסקית?</h3>
                    <p className={`text-primary font-black mb-2 ${isKiosk ? "text-[36px]" : "text-lg mb-1"}`}>+₪{mealUpgrade.price}</p>
                    <p className={`text-gray-500 ${isKiosk ? "text-[24px] mb-10" : "text-sm mb-8"}`}>המבורגר + צ׳יפס + שתייה</p>

                    <div className={`w-full ${isKiosk ? "space-y-4" : "space-y-3"}`}>
                      <button
                        onClick={() => goToSideSelect()}
                        className={`w-full bg-primary text-primary-foreground font-black rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform ${
                          isKiosk ? "py-7 text-[32px]" : "py-4 text-lg"
                        }`}
                      >
                        שדרגו לי! 🍟🥤
                      </button>
                      <button
                        onClick={() => handleFinish(false)}
                        className={`w-full bg-gray-100 text-gray-500 font-bold rounded-xl active:scale-[0.98] transition-transform ${
                          isKiosk ? "py-6 text-[26px]" : "py-4 text-base"
                        }`}
                      >
                        לא תודה
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </>
      )}
      </AnimatePresence>

      {/* Alcohol-consent gate for beer chosen as a meal-deal drink.
          Rendered as a sibling of <AnimatePresence> — NOT as its child —
          so framer-motion does not try to forward a ref to a plain function
          component (which broke the modal from showing). */}
      <AlcoholConsentModal
        open={alcoholConsent.consentOpen}
        isKiosk={isKiosk}
        onConfirm={alcoholConsent.confirm}
        onCancel={alcoholConsent.cancel}
      />

      {/* Gluten-free bun acknowledgement gate */}
      <AnimatePresence>
        {glutenConfirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
            onClick={() => setGlutenConfirmOpen(false)}
            dir="rtl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative bg-card rounded-2xl shadow-2xl w-full ${isKiosk ? "max-w-xl p-8" : "max-w-md p-6"}`}
            >
              <button
                onClick={() => setGlutenConfirmOpen(false)}
                aria-label="סגור"
                className={`absolute top-3 left-3 rounded-full bg-secondary hover:bg-border flex items-center justify-center transition active:scale-95 ${isKiosk ? "w-10 h-10" : "w-8 h-8"}`}
              >
                <X size={isKiosk ? 20 : 16} />
              </button>
              <h3 className={`font-black text-foreground mb-3 text-right pl-10 ${isKiosk ? "text-2xl" : "text-xl"}`}>
                ⚠️ לחמנייה ללא גלוטן
              </h3>
              <p className={`text-muted-foreground text-right leading-relaxed mb-2 ${isKiosk ? "text-base" : "text-sm"}`}>
                המנה מוכנה באזור עם גלוטן ואינה סטרילית ב-100% מגלוטן. ייתכן זיהום צולב.
              </p>
              <p className={`text-muted-foreground text-right leading-relaxed mb-5 ${isKiosk ? "text-base" : "text-sm"}`}>
                הוספת לחמנייה ללא גלוטן בעלות של ₪4.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setGlutenConfirmOpen(false)}
                  className={`flex-1 rounded-full border border-border bg-background font-bold text-foreground hover:bg-accent transition ${isKiosk ? "py-3 text-base" : "py-2.5 text-sm"}`}
                >
                  ביטול
                </button>
                <button
                  onClick={confirmGlutenFreeBun}
                  className={`flex-1 rounded-full bg-primary font-bold text-primary-foreground hover:opacity-90 transition ${isKiosk ? "py-3 text-base" : "py-2.5 text-sm"}`}
                >
                  קראתי ואני מאשר
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ItemCustomizer;
