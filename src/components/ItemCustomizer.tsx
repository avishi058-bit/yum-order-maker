import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, Utensils } from "lucide-react";
import { MenuItem, toppings, Topping, removals, smashModifications, smashBurgerIds, mealUpgrade, mealSideOptions, mealDrinkOptions, drinkToAvailabilityId } from "@/data/menu";
import { menuImages } from "@/data/menuImages";
import { useAlcoholConsent } from "@/hooks/useAlcoholConsent";
import AlcoholConsentModal from "@/components/AlcoholConsentModal";

interface ItemCustomizerProps {
  item: MenuItem | null;
  onClose: () => void;
  onConfirm: (item: MenuItem, quantity: number, selectedToppings: string[], selectedRemovals: string[], withMeal: boolean, mealSideId?: string, mealDrinkId?: string) => void;
  isAvailable?: (id: string) => boolean;
}

type Step = "customize" | "meal-upgrade" | "side-select" | "drink-select";

// Hero image collapse parameters (kept tiny — pure transform/opacity, no layout)
const HERO_HEIGHT = 280;          // initial hero height in px (mobile/web)
const HERO_HEIGHT_KIOSK = 380;    // kiosk hero height
const HERO_MIN_SCALE = 0.55;      // scale at full collapse
const HERO_FADE_DISTANCE = 200;   // px of scroll before image fully fades

// Drag-to-close parameters
const DRAG_CLOSE_THRESHOLD = 120; // px the user must drag down to close
const DRAG_MAX_TRACK = 400;       // cap on drag distance (resistance)

const ItemCustomizer = ({ item, onClose, onConfirm, isAvailable }: ItemCustomizerProps) => {
  const location = useLocation();
  const isKiosk = location.pathname === "/kiosk";
  const [quantity, setQuantity] = useState(1);
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [selectedRemovals, setSelectedRemovals] = useState<string[]>(["no-changes"]);
  const [step, setStep] = useState<Step>("customize");
  const [selectedSide, setSelectedSide] = useState<string>("side-fries");
  const [selectedDrink, setSelectedDrink] = useState<string>("drink-cola");
  const alcoholConsent = useAlcoholConsent();

  // Helpers used by the drink-select step's "Add" button to gate alcohol selection.
  const isAlcoholDrinkId = (drinkId: string) => {
    const opt = mealDrinkOptions.find((d) => d.id === drinkId);
    return opt?.category === "beer";
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

  const heroHeight = isKiosk ? HERO_HEIGHT_KIOSK : HERO_HEIGHT;
  const heroImage = item ? menuImages[item.id] || menuImages[item.baseBurgerId || ""] : null;
  const showHero = !!heroImage && step === "customize";

  // Apply hero transform from scrollTop — direct DOM, no setState.
  // Wolt-style: hero shrinks in real height (so content fills the gap and the
  // sticky header stays at the very top), while the image inside parallaxes & fades.
  const applyHeroTransform = useCallback((scrollTop: number) => {
    const hero = heroRef.current;
    const img = heroImgRef.current;
    if (!hero || !img) return;
    const baseHeight = isKiosk ? HERO_HEIGHT_KIOSK : HERO_HEIGHT;
    const clamped = Math.max(0, Math.min(scrollTop, HERO_FADE_DISTANCE));
    const t = clamped / HERO_FADE_DISTANCE;       // 0 → 1
    // Collapse the hero container height (cheap on a single element).
    const newHeight = baseHeight * (1 - t);
    hero.style.height = `${newHeight}px`;
    // Image: gentle parallax + fade. Opacity nukes paint cost when hidden.
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

  if (!item) return null;

  // Map removal IDs to ingredient availability IDs
  const removalToIngredient: Record<string, string> = {
    "no-lettuce": "lettuce",
    "no-tomato": "tomato",
    "no-pickles": "pickles",
    "no-aioli": "aioli",
    "no-onion": "onion",
  };

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
  const removalsList = isSmash ? smashModifications : removals;

  const getIngredientUnavailable = (removalId: string) => {
    const ingredientId = removalToIngredient[removalId];
    if (!ingredientId || !isAvailable) return false;
    return !isAvailable(ingredientId);
  };

  const toggleTopping = (id: string) => {
    setSelectedToppings((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const toggleRemoval = (id: string) => {
    if (id === "no-changes") {
      setSelectedRemovals((prev) => prev.includes("no-changes") ? [] : ["no-changes"]);
    } else if (id === "dry") {
      setSelectedRemovals((prev) => prev.includes("dry") ? ["no-changes"] : ["dry"]);
    } else {
      setSelectedRemovals((prev) =>
        prev.includes(id)
          ? prev.filter((r) => r !== id).length === 0 ? ["no-changes"] : prev.filter((r) => r !== id)
          : [...prev.filter((r) => r !== "no-changes" && r !== "dry"), id]
      );
    }
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
    if (isMeal && step === "customize") {
      goToSideSelect();
    } else if (isBurger && step === "customize") {
      setStep("meal-upgrade");
    } else {
      handleFinish(false);
    }
  };

  const handleFinish = (withMeal: boolean, sideId?: string, drinkId?: string) => {
    onConfirm(item, quantity, selectedToppings, selectedRemovals.filter(r => r !== "no-changes"), withMeal, sideId, drinkId);
    resetState();
  };

  const resetState = () => {
    setQuantity(1);
    setSelectedToppings([]);
    setSelectedRemovals(["no-changes"]);
    setStep("customize");
    setSelectedSide("side-fries");
    setSelectedDrink("drink-cola");
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
              className="fixed inset-0 z-50 bg-white text-black flex flex-col rounded-t-3xl shadow-2xl overflow-hidden"
              style={{ willChange: "transform", touchAction: "pan-y" }}
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
                    className={`rounded-full bg-gray-100 flex items-center justify-center ${isKiosk ? "w-14 h-14" : "w-10 h-10"}`}
                  >
                    <X size={isKiosk ? 28 : 20} />
                  </button>
                  <h2 className={`font-black flex-1 text-center ${isKiosk ? "text-[28px]" : "text-xl"}`}>{item.name}</h2>
                  <div className={isKiosk ? "w-14" : "w-10"} />
                </div>

                {/* Hero image (only on customize step, only if image exists) */}
                {showHero && (
                  <div
                    ref={heroRef}
                    className="relative w-full overflow-hidden bg-gray-100"
                    style={{ height: heroHeight }}
                  >
                    <img
                      ref={heroImgRef}
                      src={heroImage as string}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      style={{
                        willChange: "transform, opacity",
                        transformOrigin: "center top",
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
                    onScroll={handleScroll}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerCancel}
                    style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
                  >
                    {isBurger && (
                      <>
                        <div className={`px-5 border-b border-gray-200 ${isKiosk ? "px-8 py-6" : "py-4"}`}>
                          <h3 className={`font-black text-right mb-1 ${isKiosk ? "text-[24px] mb-2" : "text-lg"}`}>{isSmash ? "שינויים" : "שינויים אפשריים"}</h3>
                          <p className={`text-gray-500 text-right ${isKiosk ? "text-[18px] mb-4" : "text-sm mb-3"}`}>{isSmash ? "ברירת מחדל: חסה, חמוצים ואיולי" : "אפשר לבחור עד ל-5 פריטים"}</p>
                          <div className="space-y-0">
                            {removalsList.map((r) => {
                              const ingredientUnavailable = getIngredientUnavailable(r.id);
                              const active = selectedRemovals.includes(r.id) || ingredientUnavailable;
                              const isLocked = ingredientUnavailable;
                              return (
                                <button
                                  key={r.id}
                                  onClick={() => !isLocked && toggleRemoval(r.id)}
                                  className={`w-full flex items-center justify-between border-b border-gray-100 last:border-b-0 ${isLocked ? "opacity-70" : ""} ${isKiosk ? "py-5" : "py-3"}`}
                                >
                                  <div
                                    className={`rounded-full border-2 flex items-center justify-center transition-colors ${isKiosk ? "w-9 h-9" : "w-7 h-7"} ${
                                      active ? "border-primary bg-primary" : "border-gray-300"
                                    }`}
                                  >
                                    {active && <div className="w-3 h-3 rounded-full bg-white" />}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`font-bold ${isKiosk ? "text-[20px]" : "text-base"}`}>{r.name}</span>
                                    {isLocked && (
                                      <span className={`font-bold text-destructive ${isKiosk ? "text-[16px]" : "text-sm"}`}>(חסר במלאי כרגע)</span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className={`px-5 ${isKiosk ? "px-8 py-6" : "py-4"}`}>
                          <h3 className={`font-black text-right mb-1 ${isKiosk ? "text-[24px] mb-2" : "text-lg"}`}>תוספות בתשלום</h3>
                          <p className={`text-gray-500 text-right ${isKiosk ? "text-[18px] mb-4" : "text-sm mb-3"}`}>אפשר לבחור עד ל-9 פריטים</p>
                          <div className="space-y-0">
                            {toppings.filter((t: Topping) => !isAvailable || isAvailable(t.id)).map((t: Topping) => {
                              const active = selectedToppings.includes(t.id);
                              const showRecommended = t.recommended && (item.id === "smash-double-cheese" || item.baseBurgerId === "smash-double-cheese" || item.id === "meal-smash-double-cheese");
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
                                    <span className={`text-gray-500 font-medium ${isKiosk ? "text-[18px]" : "text-sm"}`}>+ ₪{t.price}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`font-bold ${isKiosk ? "text-[20px]" : "text-base"}`}>{t.name}</span>
                                    {showRecommended && (
                                      <span className="text-xs font-bold bg-green-500 text-white px-2 py-1 rounded-full whitespace-nowrap">
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
                    <h3 className={`font-black text-center ${isKiosk ? "text-[24px] mb-6" : "text-lg mb-4"}`}>בחר סוג צ׳יפס לעסקית:</h3>
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
                                <span className={`text-gray-500 font-medium ${isKiosk ? "text-[18px]" : "text-base"}`}>+₪{side.price}</span>
                              )}
                              {unavailable && (
                                <span className="text-sm font-bold text-destructive">(אזל מהמלאי כרגע)</span>
                              )}
                            </div>
                            <span className={`font-bold ${isKiosk ? "text-[20px]" : "text-lg"} ${unavailable ? "line-through text-gray-400" : ""}`}>{side.name}</span>
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
                    <h3 className={`font-black text-center ${isKiosk ? "text-[24px] mb-6" : "text-lg mb-4"}`}>בחר שתייה לעסקית:</h3>

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
                              {unavailable && <span className="text-sm text-destructive">(אזל מהמלאי)</span>}
                            </div>
                            <span className={`font-bold ${isKiosk ? "text-[20px]" : "text-lg"} ${unavailable ? "line-through text-gray-400" : ""}`}>{drink.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    <h4 className={`font-black text-right mt-4 mb-2 ${isKiosk ? "text-[20px]" : "text-base"}`}>בירות:</h4>
                    <div className="space-y-0">
                      {beerDrinks.map((drink) => {
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
                              {unavailable && <span className="text-sm text-destructive">(אזל מהמלאי)</span>}
                              {!unavailable && <span className={`text-gray-500 font-medium ${isKiosk ? "text-[18px]" : "text-base"}`}>+₪{drink.price}</span>}
                            </div>
                            <span className={`font-bold ${isKiosk ? "text-[20px]" : "text-lg"} ${unavailable ? "line-through text-gray-400" : ""}`}>{drink.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => {
                        if (isAlcoholDrinkId(selectedDrink)) {
                          // Use a synthetic MenuItem-shaped object whose id starts with "beer-"
                          // so the shared guard (isAlcoholicItem) recognizes it.
                          alcoholConsent.guard(
                            { id: `beer-${selectedDrink}`, name: "", description: "", price: 0, category: "drink" } as MenuItem,
                            () => handleFinish(true, selectedSide, selectedDrink),
                          );
                        } else {
                          handleFinish(true, selectedSide, selectedDrink);
                        }
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
                  className="bg-white text-black w-full max-w-md rounded-3xl shadow-2xl p-8 pointer-events-auto"
                  dir="rtl"
                  style={{ willChange: "transform, opacity" }}
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                      <Utensils size={36} className="text-primary" />
                    </div>
                    <h3 className={`font-black mb-3 ${isKiosk ? "text-[26px]" : "text-xl"}`}>לשדרג לארוחה עסקית?</h3>
                    <p className={`text-primary font-black mb-1 ${isKiosk ? "text-[22px]" : "text-lg"}`}>+₪{mealUpgrade.price}</p>
                    <p className={`text-gray-500 mb-8 ${isKiosk ? "text-[18px]" : "text-sm"}`}>המבורגר + צ׳יפס + שתייה</p>

                    <div className="w-full space-y-3">
                      <button
                        onClick={() => goToSideSelect()}
                        className={`w-full bg-primary text-primary-foreground font-black rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform ${isKiosk ? "py-5 text-[22px]" : "py-4 text-lg"}`}
                      >
                        שדרגו לי! 🍟🥤
                      </button>
                      <button
                        onClick={() => handleFinish(false)}
                        className={`w-full bg-gray-100 text-gray-500 font-bold rounded-xl active:scale-[0.98] transition-transform ${isKiosk ? "py-5 text-[20px]" : "py-4 text-base"}`}
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

      {/* Alcohol-consent gate for beer chosen as a meal-deal drink.
          Rendered OUTSIDE the conditional <>…</> so AnimatePresence does not
          try to forward a ref to a plain function component. */}
      <AlcoholConsentModal
        open={alcoholConsent.consentOpen}
        isKiosk={isKiosk}
        onConfirm={alcoholConsent.confirm}
        onCancel={alcoholConsent.cancel}
      />
    </AnimatePresence>
  );
};

export default ItemCustomizer;
