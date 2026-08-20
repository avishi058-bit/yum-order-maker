import { useState, useRef, useCallback, useEffect } from "react";
import { flushSync } from "react-dom";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, Utensils, Check } from "lucide-react";
import { MenuItem, menuItems, toppings as staticToppings, Topping, smashBurgerIds, ingredients, mealUpgrade, mealSideOptions, mealDrinkOptions, drinkToAvailabilityId, donenessOptions, DEFAULT_DONENESS, excludedToppingsByItem } from "@/data/menu";
import { useCustomToppings } from "@/lib/customToppingsStore";
import { findTopping } from "@/lib/toppingsLookup";
import { menuImages } from "@/data/menuImages";
import { useAlcoholConsent } from "@/hooks/useAlcoholConsent";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import AlcoholConsentModal from "@/components/AlcoholConsentModal";
import { containsSixtySeven, useSkibidiGuard } from "@/components/SkibidiGuard";
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
import cheddarIcon from "@/assets/menu/cheddar-icon.png";
import donenessMediumImg from "@/assets/doneness-medium.webp";
import donenessMediumWellImg from "@/assets/doneness-medium-well.webp";
import donenessWellDoneImg from "@/assets/doneness-well-done.webp";
import friesRegularImg from "@/assets/fries-regular.webp";
import waffleFriesImg from "@/assets/waffle-fries.webp";
import onionRingsSideImg from "@/assets/onion-rings.webp";
import tempuraOnionRingsImg from "@/assets/tempura-onion-rings.webp";
import drinkColaImg from "@/assets/drink-cola.png";
import drinkZeroImg from "@/assets/drink-zero.png";
import drinkSpriteImg from "@/assets/drink-sprite.png";
import drinkSpriteZeroImg from "@/assets/drink-sprite-zero.png";
import drinkFantaImg from "@/assets/drink-fanta.png";
import drinkFantaGrapeImg from "@/assets/drink-fanta-grape.png";
import drinkFantaExoticImg from "@/assets/drink-fanta-exotic.png";
import drinkSodaImg from "@/assets/drink-soda.png";
import drinkWaterImg from "@/assets/drink-water.png";
import drinkBluImg from "@/assets/drink-blu.png";
import drinkBluWatermelonImg from "@/assets/drink-blu-watermelon.png";
import drinkBluMojitoImg from "@/assets/drink-blu-mojito.png";
import drinkBluDayImg from "@/assets/drink-blu-day.png";
import drinkBluMelonAppleImg from "@/assets/drink-blu-melon-apple.png";
import drinkGoldstarImg from "@/assets/drink-goldstar.png";
import drinkStellaImg from "@/assets/drink-stella.png";
import drinkHeinekenImg from "@/assets/drink-heineken.png";
import drinkCoronaImg from "@/assets/drink-corona.png";
import drinkCarlsbergImg from "@/assets/drink-carlsberg.png";
import drinkPaulanerImg from "@/assets/drink-paulaner.png";
import drinkWeissImg from "@/assets/drink-weiss.png";
import drinkShapiraImg from "@/assets/drink-shapira.webp";
import drinkMaccabiImg from "@/assets/drink-maccabi.webp";
import drinkFlavoredWaterAppleImg from "@/assets/drink-flavored-water-apple.png";
import drinkFlavoredWaterGrapeImg from "@/assets/drink-flavored-water-grape.png";
import drinkGrapesImg from "@/assets/drink-grapes.png";
import drinkOrangesImg from "@/assets/drink-apples.png";
import fuzeTeaAsset from "@/assets/menu/fuze-tea.webp";

const mealSideImages: Record<string, string> = {
  "side-fries": friesRegularImg,
  "side-sweet-potato": waffleFriesImg,
  "side-onion-rings": onionRingsSideImg,
  "side-tempura": tempuraOnionRingsImg,
};

const mealDrinkImages: Record<string, string> = {
  "drink-cola": drinkColaImg,
  "drink-zero": drinkZeroImg,
  "drink-sprite": drinkSpriteImg,
  "drink-sprite-zero": drinkSpriteZeroImg,
  "drink-fanta": drinkFantaImg,
  "drink-fanta-grape": drinkFantaGrapeImg,
  "drink-fanta-exotic": drinkFantaExoticImg,
  "drink-soda": drinkSodaImg,
  "drink-water": drinkWaterImg,
  "drink-blu": drinkBluImg,
  "drink-blu-watermelon": drinkBluWatermelonImg,
  "drink-blu-mojito": drinkBluMojitoImg,
  "drink-blu-day": drinkBluDayImg,
  "drink-blu-melon-apple": drinkBluMelonAppleImg,
  "drink-goldstar": drinkGoldstarImg,
  "drink-stella": drinkStellaImg,
  "drink-heineken": drinkHeinekenImg,
  "drink-corona": drinkCoronaImg,
  "drink-carlsberg": drinkCarlsbergImg,
  "drink-paulaner": drinkPaulanerImg,
  "drink-weiss": drinkWeissImg,
  "drink-shapira": drinkShapiraImg,
  "drink-maccabi": drinkMaccabiImg,
  "drink-flavored-water-apple": drinkFlavoredWaterAppleImg,
  "drink-flavored-water-grape": drinkFlavoredWaterGrapeImg,
  "drink-grapes": drinkGrapesImg,
  "drink-oranges": drinkOrangesImg,
  "drink-apples": drinkOrangesImg,
  "drink-fuze-tea": fuzeTeaAsset,
};

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
  "cheddar": cheddarIcon,
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
  onConfirm: (item: MenuItem, quantity: number, selectedToppings: string[], selectedRemovals: string[], withMeal: boolean, mealSideId?: string, mealDrinkId?: string, ownerName?: string, sideItems?: Array<{ itemId: string; qty: number }>) => void;
  isAvailable?: (id: string) => boolean;
  /** Take-away (false) shows the optional "name on the dish" step at the end. */
  dineIn?: boolean | null;
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

const ItemCustomizer = ({ item, onClose, onConfirm, isAvailable, dineIn, initialState }: ItemCustomizerProps) => {
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
  // Asked as the LAST step, and only for take-away orders.
  const [ownerName, setOwnerName] = useState("");
  const [nameStepOpen, setNameStepOpen] = useState(false);
  const [pendingFinish, setPendingFinish] = useState<{ withMeal: boolean; sideId?: string; drinkId?: string } | null>(null);
  const ownerInputRef = useRef<HTMLInputElement>(null);

  const { trigger: triggerSkibidi } = useSkibidiGuard();
  const alcoholConsent = useAlcoholConsent();
  const [glutenConfirmOpen, setGlutenConfirmOpen] = useState(false);
  // Names of paid toppings auto-removed because they contain gluten
  const [glutenRemovedNotice, setGlutenRemovedNotice] = useState<string[]>([]);
  const [toppingsSeen, setToppingsSeen] = useState(false);
  const toppingsRef = useRef<HTMLDivElement>(null);
  // Optional "side dishes" the user can add alongside a burger (arayes 3/4).
  const [sideItemCounts, setSideItemCounts] = useState<Record<string, number>>({});
  const customToppings = useCustomToppings();
  const toppings = [...staticToppings, ...customToppings];

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
      setNameStepOpen(false);
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

  // After picking a drink, smoothly scroll the user down to the
  // "add to order" button so it's clear what to do next.
  const scrollToDrinkAddButton = () => {
    requestAnimationFrame(() => {
      drinkAddBtnRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  };

  const handleDrinkSelection = (drinkId: string) => {
    if (isAlcoholDrinkId(drinkId)) {
      alcoholConsent.guard(buildAlcoholDrinkGateItem(drinkId), () => {
        setSelectedDrink(drinkId);
        scrollToDrinkAddButton();
      });
      return;
    }

    setSelectedDrink(drinkId);
    scrollToDrinkAddButton();
  };

  // Refs for direct DOM transforms (no re-renders during drag/scroll)
  const sheetRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const drinkAddBtnRef = useRef<HTMLButtonElement>(null);

  // Lock the page-behind-the-modal so iOS doesn't rubber-band/scroll the
  // background instead of the sheet content. MUST be conditional on `item`
  // because Kiosk renders this component permanently with item=null.
  useBodyScrollLock(!!item);

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

  const isInteractiveDragTarget = useCallback((target: HTMLElement | null) =>
    !!target?.closest("button, a, input, textarea, select, label, [role='button']"), []);

  const beginDrag = useCallback((clientY: number, pointerId: number) => {
    dragState.current.active = true;
    dragState.current.startY = clientY;
    dragState.current.currentY = clientY;
    dragState.current.pointerId = pointerId;

    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    if (sheet) sheet.style.transition = "none";
    if (backdrop) backdrop.style.transition = "none";
  }, []);

  const applyDragPosition = useCallback((clientY: number) => {
    const ds = dragState.current;
    if (!ds.active) return;

    const dy = clientY - ds.startY;

    // Only react to downward drags
    if (dy <= 0) {
      const sheet = sheetRef.current;
      const backdrop = backdropRef.current;
      if (sheet) sheet.style.transform = "translate3d(0,0,0)";
      if (backdrop) backdrop.style.opacity = "0.5";
      ds.currentY = clientY;
      return;
    }

    ds.currentY = clientY;
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

  // Drag-to-close — pointer events + RAF + transform on the sheet root
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const sc = scrollRef.current;
    const target = e.target as HTMLElement | null;
    // Only enforce the "scroll is at top" guard when the drag actually starts
    // INSIDE the scrollable content. When the user grabs the header / pull-handle
    // (outside the scroll container), allow drag-to-close regardless of scroll
    // position — important for kiosk where content is often scrolled past hero.
    const insideScroll = !!(sc && target && sc.contains(target));
    if (insideScroll && sc && sc.scrollTop > 0) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    if (isInteractiveDragTarget(target)) return;

    beginDrag(e.clientY, e.pointerId);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, [isInteractiveDragTarget, beginDrag]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragState.current;
    if (!ds.active || e.pointerId !== ds.pointerId) return;

    if (e.clientY > ds.startY) e.preventDefault();
    applyDragPosition(e.clientY);
  }, [applyDragPosition]);

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

  // Native non-passive touch listeners on the scroll container. Kiosk browsers
  // often let the scrollable hero/content claim the gesture before React pointer
  // events can move the sheet, so we directly drive the same drag-to-close flow
  // once a downward pull reaches the top of the scroll area.
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    let startY = 0;
    let startX = 0;
    let claimed = false;
    let blocked = false;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const target = e.target as HTMLElement | null;
      claimed = false;
      blocked = isInteractiveDragTarget(target);
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (blocked || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dy = touch.clientY - startY;
      const dx = Math.abs(touch.clientX - startX);
      // If a pointer-driven drag is already active (kiosks fire both pointer +
      // touch events), just keep feeding position into it — do NOT call
      // beginDrag again or we would overwrite its pointerId and lock the drag.
      if (dragState.current.active) {
        // Only consume the gesture for DOWNWARD drags (drag-to-close).
        // Upward swipes must be allowed through so the browser can scroll
        // the content natively — otherwise the modal feels frozen.
        if (dy <= 0) return;
        if (e.cancelable) e.preventDefault();
        applyDragPosition(touch.clientY);
        claimed = true;
        return;
      }
      if (!claimed) {
        if (dy > 6 && dy > dx && sc.scrollTop <= 2) {
          claimed = true;
          beginDrag(startY, -1);
        } else {
          return;
        }
      }
      if (claimed && e.cancelable) e.preventDefault();
      applyDragPosition(touch.clientY);
    };
    const onTouchEnd = () => {
      // Only finish here if this touch handler started the drag (pointerId -1).
      // Otherwise let the pointerup/pointercancel handler finalize it, so we
      // don't double-finish and snap the sheet back unexpectedly.
      if (claimed && dragState.current.active && dragState.current.pointerId === -1) {
        finishDrag();
      }
      claimed = false;
      blocked = false;
    };
    sc.addEventListener("touchstart", onTouchStart, { passive: true });
    sc.addEventListener("touchmove", onTouchMove, { passive: false });
    sc.addEventListener("touchend", onTouchEnd, { passive: true });
    sc.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      sc.removeEventListener("touchstart", onTouchStart);
      sc.removeEventListener("touchmove", onTouchMove);
      sc.removeEventListener("touchend", onTouchEnd);
      sc.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [step, isInteractiveDragTarget, beginDrag, applyDragPosition, finishDrag]);

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
    "side-sweet-potato": "sweet-potato-fries",
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
  // חף מפשע (צמחוני) — ללא בחירת מידת עשייה
  const isVegan = (item.baseBurgerId || item.id) === "haf-mifsha";
  // קריספי צ׳יקן — עוף, ללא בחירת מידת עשייה
  const isChicken = (item.baseBurgerId || item.id) === "crispy-chicken";

  const VEGAN_CHEDDAR_MAX = 6;

  // Paid toppings that contain gluten — blocked once a GF bun is chosen.
  const GLUTEN_TOPPING_IDS = ["onion-rings-topping", "crispy-onion-chips"];
  const isGlutenFree = selectedToppings.includes("gluten-free-bun");
  const toppingNameById = (id: string) => toppings.find((t) => t.id === id)?.name || id;

  const toggleTopping = (id: string) => {
    if (isGlutenFree && GLUTEN_TOPPING_IDS.includes(id) && !selectedToppings.includes(id)) {
      // Contains gluten — not selectable alongside a gluten-free bun
      return;
    }
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
    if (id === "gluten-free-bun") setGlutenRemovedNotice([]);

    setSelectedToppings((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const confirmGlutenFreeBun = () => {
    const removed = selectedToppings.filter((t) => GLUTEN_TOPPING_IDS.includes(t));
    setSelectedToppings((prev) => [
      ...prev.filter((t) => !GLUTEN_TOPPING_IDS.includes(t)),
      ...(prev.includes("gluten-free-bun") ? [] : ["gluten-free-bun"]),
    ]);
    setGlutenRemovedNotice(Array.from(new Set(removed)).map(toppingNameById));
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
      // Crispy chicken never has tomato — never emit a tomato removal/addition.
      if (isChicken && ing.id === "tomato") return;
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

  /** Take-away burgers get an optional "name on the dish" step right before
   *  the item is added to the cart. */
  const nameStepEnabled = isBurger && dineIn === false;

  const handleFinish = (withMeal: boolean, sideId?: string, drinkId?: string, skipNameStep = false) => {
    if (nameStepEnabled && !skipNameStep) {
      setPendingFinish({ withMeal, sideId, drinkId });
      setNameStepOpen(true);
      return;
    }
    const trimmedOwner = ownerName.trim();
    const donenessCategoryOn = !isAvailable || isAvailable("doneness-category");
    const donenessOptionOn = !isAvailable || isAvailable(selectedDoneness);
    const includeDoneness = isBurger && !isSmash && !isVegan && donenessCategoryOn && donenessOptionOn;
    const finalRemovals = [
      ...computeRemovals(),
      ...(includeDoneness ? [selectedDoneness] : []),
    ];
    const sideItems = Object.entries(sideItemCounts)
      .filter(([, q]) => q > 0)
      .map(([itemId, qty]) => ({ itemId, qty }));
    onConfirm(
      item,
      quantity,
      selectedToppings,
      finalRemovals,
      withMeal,
      sideId,
      drinkId,
      trimmedOwner || undefined,
      sideItems.length > 0 ? sideItems : undefined,
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
    setNameStepOpen(false);
    setPendingFinish(null);
    setOwnerName("");
    setToppingsSeen(false);
    setSideItemCounts({});
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
                isKiosk ? "bottom-0" : "inset-0 pwa-safe-screen"
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
                    {item.description && (
                      <div className={`mx-5 ${isKiosk ? "mt-4" : "mt-3"}`}>
                        <p className={`text-black font-bold leading-relaxed text-right ${isKiosk ? "text-[20px]" : "text-base"}`}>
                          {item.description}
                        </p>
                      </div>
                    )}
                    {(item.id === "haf-mifsha" || item.baseBurgerId === "haf-mifsha") && (
                      <div className={`mx-5 mt-4 rounded-xl border-2 border-destructive bg-destructive/10 ${isKiosk ? "p-5" : "p-3"}`}>
                        <p className={`font-black text-destructive text-right ${isKiosk ? "text-[20px]" : "text-sm"}`}>
                          ⚠️ שימו לב: מבושל באזור בשרי, אין הפרדה מוחלטת מהבשר
                        </p>
                      </div>
                    )}

                    {/* Doneness selector — only for non-smash burgers, only if category is available */}
                    {isBurger && !isSmash && !isVegan && !isChicken && (!isAvailable || isAvailable("doneness-category")) && (() => {
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
                                  aria-pressed={active}
                                  className={`w-full flex items-center justify-between border-b border-gray-100 last:border-b-0 ${isKiosk ? "py-5" : "py-3"}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`rounded-full border-2 flex items-center justify-center transition-colors ${isKiosk ? "w-9 h-9" : "w-7 h-7"} ${
                                        active ? "border-primary bg-primary" : "border-gray-300"
                                      }`}
                                    >
                                      {active && <Check size={isKiosk ? 20 : 16} className="text-primary-foreground" strokeWidth={4} />}
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
                            {ingredients.filter((ing) => !(isChicken && ing.id === "tomato")).map((ing) => {
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
                          {glutenRemovedNotice.length > 0 && (
                            <div className={`rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-right mb-3 ${isKiosk ? "p-4 text-[20px]" : "p-3 text-sm"}`}>
                              ⚠️ הוסרו אוטומטית: {glutenRemovedNotice.join(", ")} — מכילים גלוטן ולכן לא ניתן להוסיף אותם עם לחמנייה ללא גלוטן.
                            </div>
                          )}
                          <div className="space-y-0">
                            {toppings
                              .filter((t: Topping) => t.id !== "arayes-extra-quarter")
                              .filter((t: Topping) => t.id !== "pickled-jalapeno-side")
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
                                // Vegan extra patty — only for חף מפשע
                                if (t.id === "extra-vegan-patty") return baseId === "haf-mifsha";
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
                              const isJalapeno = t.id === "pickled-jalapeno";
                              const jalapenoSide = selectedToppings.includes("pickled-jalapeno-side");
                              const cheddarCount = isCheddar ? selectedToppings.filter((id) => id === "vegan-cheddar").length : 0;
                              const active = isCheddar
                                ? cheddarCount > 0
                                : isJalapeno
                                  ? selectedToppings.includes("pickled-jalapeno") || jalapenoSide
                                  : selectedToppings.includes(t.id);
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

                              if (isJalapeno) {
                                const setJalapeno = (mode: "none" | "in" | "side") =>
                                  setSelectedToppings((prev) => {
                                    const rest = prev.filter((id) => id !== "pickled-jalapeno" && id !== "pickled-jalapeno-side");
                                    if (mode === "none") return rest;
                                    return [...rest, mode === "in" ? "pickled-jalapeno" : "pickled-jalapeno-side"];
                                  });
                                const inDish = selectedToppings.includes("pickled-jalapeno");
                                return (
                                  <div
                                    key={t.id}
                                    className={`w-full border-b border-gray-100 last:border-b-0 ${isKiosk ? "py-5" : "py-3"}`}
                                  >
                                    <button
                                      onClick={() => setJalapeno(active ? "none" : dineIn ? "in" : "in")}
                                      aria-pressed={active}
                                      className="w-full flex items-center justify-between"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div
                                          className={`rounded-full border-2 flex items-center justify-center transition-colors ${isKiosk ? "w-9 h-9" : "w-7 h-7"} ${
                                            active ? "border-primary bg-primary" : "border-gray-300"
                                          }`}
                                        >
                                          {active && <Check size={isKiosk ? 20 : 16} className="text-primary-foreground" strokeWidth={4} />}
                                        </div>
                                        <span className={`text-gray-500 font-medium ${isKiosk ? "text-[20px]" : "text-sm"}`}>+ ₪{t.price}</span>
                                      </div>
                                      <span className={`font-bold ${isKiosk ? "text-[30px]" : "text-lg"}`}>{t.name} 🌶️</span>
                                    </button>
                                    {active && dineIn && (
                                      <div className="flex items-center justify-end gap-2 mt-2">
                                        {([
                                          { mode: "in" as const, label: "במנה", on: inDish },
                                          { mode: "side" as const, label: "בצד", on: jalapenoSide },
                                        ]).map((opt) => (
                                          <button
                                            key={opt.mode}
                                            onClick={() => setJalapeno(opt.mode)}
                                            aria-pressed={opt.on}
                                            className={`rounded-full border-2 font-bold transition-colors ${isKiosk ? "px-5 py-2.5 text-[20px]" : "px-4 py-1.5 text-sm"} ${
                                              opt.on ? "border-primary bg-primary text-primary-foreground" : "border-gray-300 text-gray-600"
                                            }`}
                                          >
                                            {opt.label}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              const glutenBlocked = isGlutenFree && GLUTEN_TOPPING_IDS.includes(t.id);

                              return (
                                <button
                                  key={t.id}
                                  onClick={() => toggleTopping(t.id)}
                                  aria-pressed={active}
                                  disabled={glutenBlocked}
                                  className={`w-full flex items-center justify-between border-b border-gray-100 last:border-b-0 ${isKiosk ? "py-5" : "py-3"} ${glutenBlocked ? "opacity-50 cursor-not-allowed" : ""}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`rounded-full border-2 flex items-center justify-center transition-colors ${isKiosk ? "w-9 h-9" : "w-7 h-7"} ${
                                        active ? "border-primary bg-primary" : "border-gray-300"
                                      }`}
                                    >
                                      {active && <Check size={isKiosk ? 20 : 16} className="text-primary-foreground" strokeWidth={4} />}
                                    </div>
                                    <span className={`text-gray-500 font-medium ${isKiosk ? "text-[20px]" : "text-sm"}`}>+ ₪{t.price}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`font-bold flex items-center gap-1.5 ${isKiosk ? "text-[30px]" : "text-lg"} ${glutenBlocked ? "line-through text-gray-400" : ""}`}>
                                      {t.name}
                                      {t.image && ingredientImages[t.image] ? (
                                        <img src={ingredientImages[t.image]} alt={t.name} className={`inline-block object-contain ${t.image === "extra-patty" ? (isKiosk ? "w-[60px] h-[60px]" : "w-12 h-12") : (isKiosk ? "w-9 h-9" : "w-7 h-7")}`} />
                                      ) : null}
                                    </span>
                                    {glutenBlocked && (
                                      <span className={`font-bold bg-amber-500 text-white rounded-full whitespace-nowrap ${isKiosk ? "text-[16px] px-3 py-1.5" : "text-xs px-2 py-1"}`}>
                                        ⚠️ מכיל גלוטן
                                      </span>
                                    )}
                                    {showRecommended && !glutenBlocked && (
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

                        {/* תוספות צד — שלח גם מנות עראיס (3 / 4 רבעים) יחד עם ההמבורגר */}
                        {!initialState && item.id !== "arayes-special" && item.id !== "arayes-special-4" && (() => {
                          const sideOptions = (["arayes-special", "arayes-special-4"] as const)
                            .map((id) => menuItems.find((m) => m.id === id))
                            .filter((m): m is MenuItem => !!m)
                            .filter((m) => !isAvailable || isAvailable(m.id));
                          if (sideOptions.length === 0) return null;
                          return (
                            <div className={`px-5 ${isKiosk ? "px-8 py-6" : "py-4"}`}>
                              <h3 className={`font-black text-right mb-1 ${isKiosk ? "text-[30px] mb-3" : "text-lg"}`}>תוספות צד</h3>
                              <p className={`text-gray-500 text-right ${isKiosk ? "text-[20px] mb-5" : "text-sm mb-3"}`}>הוסף מנת עראיס יחד עם ההמבורגר</p>
                              <div className="space-y-0">
                                {sideOptions.map((side) => {
                                  const count = sideItemCounts[side.id] || 0;
                                  const setCount = (n: number) =>
                                    setSideItemCounts((s) => ({ ...s, [side.id]: Math.max(0, n) }));
                                  return (
                                    <div
                                      key={side.id}
                                      className={`w-full flex items-center justify-between border-b border-gray-100 last:border-b-0 ${isKiosk ? "py-5" : "py-3"}`}
                                    >
                                      <div className="flex items-center gap-3">
                                        {count > 0 ? (
                                          <div className={`flex items-center gap-2 ${isKiosk ? "text-[20px]" : "text-base"}`}>
                                            <button
                                              onClick={() => setCount(count - 1)}
                                              className={`rounded-full bg-secondary hover:bg-border flex items-center justify-center active:scale-95 transition ${isKiosk ? "w-10 h-10" : "w-8 h-8"}`}
                                              aria-label="הסר"
                                            >
                                              <Minus size={isKiosk ? 18 : 14} />
                                            </button>
                                            <span className={`font-black w-6 text-center ${isKiosk ? "text-[22px]" : "text-base"}`}>{count}</span>
                                            <button
                                              onClick={() => setCount(count + 1)}
                                              className={`rounded-full bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center active:scale-95 transition ${isKiosk ? "w-10 h-10" : "w-8 h-8"}`}
                                              aria-label="הוסף"
                                            >
                                              <Plus size={isKiosk ? 18 : 14} />
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            onClick={() => setCount(1)}
                                            className={`rounded-full bg-primary text-primary-foreground font-bold flex items-center gap-1 active:scale-95 transition ${isKiosk ? "px-4 py-2 text-[18px]" : "px-3 py-1.5 text-sm"}`}
                                          >
                                            <Plus size={isKiosk ? 18 : 14} />
                                            הוסף
                                          </button>
                                        )}
                                        <span className={`text-gray-500 font-medium ${isKiosk ? "text-[20px]" : "text-sm"}`}>+ ₪{side.price}</span>
                                      </div>
                                      <span className={`font-bold ${isKiosk ? "text-[26px]" : "text-lg"}`}>{side.name}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
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
                    {isGlutenFree && (
                      <div className={`rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-right mb-4 ${isKiosk ? "p-4 text-[20px]" : "p-3 text-sm"}`}>
                        ⚠️ בחרת לחמנייה ללא גלוטן: הצ׳יפס מטוגן בשמן שבו מטוגנים גם מוצרים המכילים גלוטן. טבעות הבצל וטבעות הבצל בטמפורה מכילות גלוטן.
                      </div>
                    )}
                    <div className="space-y-0">
                      {mealSideOptions.map((side) => {
                        const unavailable = isSideUnavailable(side.id);
                        // Hide tempura onion rings entirely when out of stock; other sides still show "אזל"
                        if (unavailable && side.id === "tempura-onion") return null;
                        const active = selectedSide === side.id && !unavailable;
                        // Allergen marking (shown once a GF bun was chosen)
                        const sideGlutenLabel = !isGlutenFree
                          ? null
                          : side.id === "side-onion-rings" || side.id === "side-tempura"
                            ? "⚠️ מכיל גלוטן"
                            : side.id === "side-fries" || side.id === "side-sweet-potato"
                              ? "⚠️ מטוגן בשמן עם גלוטן"
                              : null;


                        return (
                          <button
                            key={side.id}
                            aria-pressed={active}
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
                            <div className="flex items-center gap-3">
                              {sideGlutenLabel && (
                                <span className={`font-bold bg-amber-500 text-white rounded-full whitespace-nowrap ${isKiosk ? "text-[16px] px-3 py-1.5" : "text-[11px] px-2 py-1"}`}>
                                  {sideGlutenLabel}
                                </span>
                              )}
                              <span className={`font-bold ${isKiosk ? "text-[26px]" : "text-lg"} ${unavailable ? "line-through text-gray-400" : ""}`}>{side.name}</span>

                              {mealSideImages[side.id] && (
                                <img
                                  src={mealSideImages[side.id]}
                                  alt={side.name}
                                  width={80}
                                  height={80}
                                  className={`${isKiosk ? "w-20 h-20" : "w-16 h-16"} object-contain flex-shrink-0 ${unavailable ? "opacity-40 grayscale" : ""}`}
                                />
                              )}
                            </div>
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
                        // Hide out-of-stock BLU variants entirely instead of showing "אזל"
                        if (unavailable && drink.id.startsWith("drink-blu")) return null;

                        return (
                          <button
                            key={drink.id}
                            disabled={unavailable}
                            onClick={() => { if (!unavailable) { setSelectedDrink(drink.id); scrollToDrinkAddButton(); } }}
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
                              {drink.price > 0 && !unavailable && (
                                <span className={`inline-flex items-center justify-center rounded-full bg-primary px-2 py-0.5 font-black text-primary-foreground shadow-sm ${isKiosk ? "text-[22px] min-w-[52px]" : "text-base min-w-[40px]"}`}>+₪{drink.price}</span>
                              )}
                              {unavailable && <span className={`text-destructive ${isKiosk ? "text-[18px]" : "text-sm"}`}>(אזל מהמלאי)</span>}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`font-bold ${isKiosk ? "text-[26px]" : "text-lg"} ${unavailable ? "line-through text-gray-400" : ""}`}>{drink.name}</span>
                              {mealDrinkImages[drink.id] && (
                                <img
                                  src={mealDrinkImages[drink.id]}
                                  alt={drink.name}
                                  width={80}
                                  height={80}
                                  loading="lazy"
                                  className={`${isKiosk ? "w-20 h-20" : "w-16 h-16"} object-contain flex-shrink-0 ${unavailable ? "opacity-40 grayscale" : ""}`}
                                />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {beerDrinks.some((d) => !isDrinkUnavailable(d.id)) && (
                    <h4 className={`font-black text-right mt-6 mb-3 ${isKiosk ? "text-[26px]" : "text-base"}`}>בירות:</h4>
                    )}
                    <div className="space-y-0">
                      {beerDrinks.map((drink) => {
                        const active = selectedDrink === drink.id;
                        const unavailable = isDrinkUnavailable(drink.id);
                        if (unavailable) return null;
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
                            <div className="flex items-center gap-3">
                              <span className={`font-bold ${isKiosk ? "text-[26px]" : "text-lg"} ${unavailable ? "line-through text-gray-400" : ""}`}>{drink.name}</span>
                              {mealDrinkImages[drink.id] && (
                                <img
                                  src={mealDrinkImages[drink.id]}
                                  alt={drink.name}
                                  width={80}
                                  height={80}
                                  loading="lazy"
                                  className={`${isKiosk ? "w-20 h-20" : "w-16 h-16"} object-contain flex-shrink-0 ${unavailable ? "opacity-40 grayscale" : ""}`}
                                />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      ref={drinkAddBtnRef}
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
                <div className={`border-t border-gray-200 flex items-center gap-3 bg-white pwa-safe-bottom ${isKiosk ? "px-8 py-6" : "px-5 py-4"}`}>
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

      {/* Final step (take-away only): optional name on the dish. */}
      <AnimatePresence>
        {nameStepOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
            dir="rtl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.18 }}
              className={`bg-white text-black w-full rounded-3xl shadow-2xl ${isKiosk ? "max-w-2xl p-10" : "max-w-md p-6"}`}
            >
              <h3 className={`font-black text-center ${isKiosk ? "text-[36px] mb-2" : "text-xl mb-1"}`}>
                של מי המנה? :)
              </h3>
              <p className={`text-gray-500 text-center ${isKiosk ? "text-[22px] mb-6" : "text-sm mb-4"}`}>
                נכתוב את השם על המנה כדי למנוע בלבולים (אפשר לדלג)
              </p>
              <input
                ref={ownerInputRef}
                autoFocus
                type="text"
                value={ownerName}
                onChange={(e) => {
                  const raw = e.target.value.slice(0, 30);
                  if (containsSixtySeven(raw)) {
                    triggerSkibidi();
                    setOwnerName("");
                    return;
                  }
                  setOwnerName(raw);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleFinish(pendingFinish?.withMeal ?? false, pendingFinish?.sideId, pendingFinish?.drinkId, true);
                }}
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
                style={{ fontSize: isKiosk ? "26px" : "16px" }}
                className={`w-full bg-white border-2 border-gray-200 rounded-xl text-right focus:outline-none focus:border-primary transition-colors ${isKiosk ? "px-5 py-5" : "px-4 py-3"}`}
              />
              <div className={`${isKiosk ? "space-y-4 mt-8" : "space-y-3 mt-5"}`}>
                <button
                  onClick={() => handleFinish(pendingFinish?.withMeal ?? false, pendingFinish?.sideId, pendingFinish?.drinkId, true)}
                  className={`w-full bg-primary text-primary-foreground font-black rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform ${isKiosk ? "py-6 text-[30px]" : "py-4 text-lg"}`}
                >
                  הוספה להזמנה 🍔
                </button>
                <button
                  onClick={() => {
                    setOwnerName("");
                    handleFinish(pendingFinish?.withMeal ?? false, pendingFinish?.sideId, pendingFinish?.drinkId, true);
                  }}
                  className={`w-full bg-gray-100 text-gray-500 font-bold rounded-xl active:scale-[0.98] transition-transform ${isKiosk ? "py-5 text-[24px]" : "py-3 text-base"}`}
                >
                  דלג
                </button>
              </div>
            </motion.div>
          </motion.div>
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
              <p className={`text-muted-foreground text-right leading-relaxed mb-2 ${isKiosk ? "text-base" : "text-sm"}`}>
                שימו לב: הצ׳יפס מטוגן בשמן שבו מטוגנים גם מוצרים עם גלוטן. טבעות בצל וטבעות בצל בטמפורה מכילות גלוטן.
              </p>
              <p className={`text-muted-foreground text-right leading-relaxed mb-2 ${isKiosk ? "text-base" : "text-sm"}`}>
                תוספות המכילות גלוטן (שלוש טבעות בצל ביתיות / שבבי בצל קריספי) יוסרו אוטומטית ולא ניתן להוסיף אותן.
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
