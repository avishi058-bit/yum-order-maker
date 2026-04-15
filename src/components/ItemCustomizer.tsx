import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, Utensils } from "lucide-react";
import { MenuItem, toppings, Topping, removals, smashModifications, smashBurgerIds, mealUpgrade, mealSideOptions, mealDrinkOptions, drinkToAvailabilityId } from "@/data/menu";
import { menuImages } from "@/data/menuImages";

interface ItemCustomizerProps {
  item: MenuItem | null;
  onClose: () => void;
  onConfirm: (item: MenuItem, quantity: number, selectedToppings: string[], selectedRemovals: string[], withMeal: boolean, mealSideId?: string, mealDrinkId?: string) => void;
  isAvailable?: (id: string) => boolean;
}

type Step = "customize" | "meal-upgrade" | "side-select" | "drink-select";

const ItemCustomizer = ({ item, onClose, onConfirm, isAvailable }: ItemCustomizerProps) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [selectedRemovals, setSelectedRemovals] = useState<string[]>(["no-changes"]);
  const [step, setStep] = useState<Step>("customize");
  const [selectedSide, setSelectedSide] = useState<string>("side-fries");
  const [selectedDrink, setSelectedDrink] = useState<string>("drink-cola");
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const [sheetTranslateY, setSheetTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Lock body scroll when open
  useEffect(() => {
    if (item) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [item]);

  if (!item) return null;

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

  const softDrinks = mealDrinkOptions.filter(d => d.category === "soft");
  const beerDrinks = mealDrinkOptions.filter(d => d.category === "beer");

  const hasImage = !!menuImages[item.id];

  // Handle drag to dismiss - only allow when scrolled to top
  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 100 && info.velocity.y > 0) {
      handleClose();
    }
  };

  const handleDrag = (_: any, info: PanInfo) => {
    // Only allow dragging down when scroll is at top
    const el = scrollRef.current;
    if (el && el.scrollTop > 0 && info.offset.y > 0) {
      dragY.set(0);
    }
  };

  return (
    <AnimatePresence>
      {item && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black z-50"
          />
          <motion.div
            initial={step === "meal-upgrade" ? { opacity: 0, scale: 0.9 } : { y: "100%" }}
            animate={step === "meal-upgrade" ? { opacity: 1, scale: 1 } : { y: 0 }}
            exit={step === "meal-upgrade" ? { opacity: 0, scale: 0.9 } : { y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            drag={step !== "meal-upgrade" ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            style={{ y: step !== "meal-upgrade" ? dragY : undefined, opacity: step !== "meal-upgrade" ? sheetOpacity : 1 }}
            className={`fixed z-50 flex flex-col ${
              step === "meal-upgrade" 
                ? "inset-0 m-auto w-[90vw] max-w-lg h-fit rounded-3xl shadow-2xl bg-card text-card-foreground" 
                : "bottom-0 left-0 right-0 rounded-t-3xl max-h-[92vh] bg-card text-card-foreground"
            }`}
            dir="rtl"
          >
            {/* Drag handle */}
            {step !== "meal-upgrade" && (
              <div className="flex justify-center pt-3 pb-0 absolute top-0 left-0 right-0 z-20">
                <div className="w-10 h-1.5 rounded-full bg-foreground/20" />
              </div>
            )}

            {/* Scrollable content area */}
            <div 
              ref={scrollRef}
              className={`flex-1 overflow-y-auto overscroll-contain ${step !== "meal-upgrade" ? "rounded-t-3xl" : ""}`}
              style={{ touchAction: "pan-y" }}
              onTouchMove={(e) => e.stopPropagation()}
            >
              {/* Hero image with overlay close button */}
              {step !== "meal-upgrade" && hasImage && (
                <div className="relative w-full flex-shrink-0">
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 260, opacity: 1 }}
                    transition={{ type: "spring", damping: 25, stiffness: 200, delay: 0.05 }}
                    className="w-full overflow-hidden rounded-t-3xl"
                  >
                    <motion.img
                      src={menuImages[item.id]}
                      alt={item.name}
                      initial={{ scale: 1.15 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", damping: 20, stiffness: 150, delay: 0.1 }}
                      className="w-full h-[260px] object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-card to-transparent" />
                  </motion.div>
                  <button
                    onClick={handleClose}
                    className="absolute top-6 left-4 w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 shadow-lg"
                  >
                    <X size={18} className="text-foreground" />
                  </button>
                </div>
              )}

              {/* Close button when no image */}
              {step !== "meal-upgrade" && !hasImage && (
                <div className="relative pt-8">
                  <button
                    onClick={handleClose}
                    className="absolute top-3 left-4 w-9 h-9 rounded-full bg-secondary flex items-center justify-center z-10"
                  >
                    <X size={18} className="text-foreground" />
                  </button>
                </div>
              )}

              {/* Item info header */}
              {step !== "meal-upgrade" && (
                <div className="px-5 pt-2 pb-4">
                  <h2 className="text-3xl font-black text-foreground">{item.name}</h2>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-2xl font-black text-primary">₪{item.price.toFixed(2)}</span>
                    {item.weight && (
                      <span className="text-sm text-muted-foreground bg-secondary px-3 py-1 rounded-full font-medium">
                        {item.weight}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-muted-foreground text-base mt-2 leading-relaxed">{item.description}</p>
                  )}
                </div>
              )}

              {/* Divider */}
              {step !== "meal-upgrade" && (
                <div className="h-px bg-border mx-5" />
              )}

              <AnimatePresence mode="wait">
                {step === "customize" && (
                  <motion.div
                    key="customize"
                    initial={{ opacity: 0, x: 40, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -40, scale: 0.97 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  >
                    {isBurger && (
                      <>
                        <div className="px-5 py-5">
                          <h3 className="text-xl font-black text-foreground text-right mb-1">
                            {isSmash ? "שינויים" : "שינויים אפשריים"}
                          </h3>
                          <p className="text-sm text-muted-foreground text-right mb-4">
                            {isSmash ? "ברירת מחדל: חסה, חמוצים ואיולי" : "אפשר לבחור עד ל-5 פריטים"}
                          </p>
                          <div className="space-y-0">
                            {removalsList.map((r) => {
                              const ingredientUnavailable = getIngredientUnavailable(r.id);
                              const active = selectedRemovals.includes(r.id) || ingredientUnavailable;
                              const isLocked = ingredientUnavailable;
                              return (
                                <button
                                  key={r.id}
                                  onClick={() => !isLocked && toggleRemoval(r.id)}
                                  className={`w-full flex items-center justify-between py-4 border-b border-border/50 last:border-b-0 ${isLocked ? "opacity-70" : ""}`}
                                >
                                  <div
                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                      active ? "border-primary bg-primary" : "border-muted-foreground/40"
                                    }`}
                                  >
                                    {active && (
                                      <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="w-2.5 h-2.5 rounded-full bg-primary-foreground"
                                      />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-lg text-foreground">{r.name}</span>
                                    {isLocked && (
                                      <span className="text-xs text-destructive font-bold">(חסר במלאי כרגע)</span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="h-2 bg-secondary/50" />

                        <div className="px-5 py-5">
                          <h3 className="text-xl font-black text-foreground text-right mb-1">תוספות בתשלום</h3>
                          <p className="text-sm text-muted-foreground text-right mb-4">אפשר לבחור עד ל-9 פריטים</p>
                          <div className="space-y-0">
                            {toppings.filter((t: Topping) => !isAvailable || isAvailable(t.id)).map((t: Topping) => {
                              const active = selectedToppings.includes(t.id);
                              const showRecommended = t.recommended && (item.id === "smash-double-cheese" || item.baseBurgerId === "smash-double-cheese" || item.id === "meal-smash-double-cheese");
                              return (
                                <button
                                  key={t.id}
                                  onClick={() => toggleTopping(t.id)}
                                  className="w-full flex items-center justify-between py-4 border-b border-border/50 last:border-b-0"
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                        active ? "border-primary bg-primary" : "border-muted-foreground/40"
                                      }`}
                                    >
                                      {active && (
                                        <motion.div
                                          initial={{ scale: 0 }}
                                          animate={{ scale: 1 }}
                                          className="w-2.5 h-2.5 rounded-full bg-primary-foreground"
                                        />
                                      )}
                                    </div>
                                    <span className="text-sm text-muted-foreground font-medium">+ ₪{t.price}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-lg text-foreground">{t.name}</span>
                                    {showRecommended && (
                                      <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full whitespace-nowrap">
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
                      <div className="px-5 py-8 text-center">
                        <p className="text-muted-foreground text-base">{item.description}</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {step === "meal-upgrade" && (
                  <motion.div
                    key="meal-upgrade"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                    className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center"
                  >
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                      <Utensils size={36} className="text-primary" />
                    </div>
                    <h3 className="text-3xl font-black mb-3 text-foreground">לשדרג לארוחה עסקית?</h3>
                    <p className="text-primary font-black text-2xl mb-1">+₪{mealUpgrade.price}</p>
                    <p className="text-muted-foreground text-lg mb-8">המבורגר + צ׳יפס + שתייה</p>

                    <div className="w-full space-y-3">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => goToSideSelect()}
                        className="w-full bg-primary text-primary-foreground font-black py-5 rounded-xl text-xl shadow-lg shadow-primary/20"
                      >
                        שדרגו לי! 🍟🥤
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleFinish(false)}
                        className="w-full bg-secondary text-muted-foreground font-bold py-5 rounded-xl text-lg"
                      >
                        לא תודה
                      </motion.button>
                    </div>
                  </motion.div>
                )}

                {step === "side-select" && (
                  <motion.div
                    key="side-select"
                    initial={{ opacity: 0, x: 40, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -40, scale: 0.97 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    className="flex-1 px-6 py-8"
                  >
                    <h3 className="text-2xl font-black text-center mb-6 text-foreground">בחר סוג צ׳יפס לעסקית:</h3>
                    <div className="space-y-0">
                      {mealSideOptions.map((side) => {
                        const unavailable = isSideUnavailable(side.id);
                        const active = selectedSide === side.id && !unavailable;
                        return (
                          <button
                            key={side.id}
                            onClick={() => !unavailable && setSelectedSide(side.id)}
                            disabled={unavailable}
                            className={`w-full flex items-center justify-between py-4 border-b border-border/50 last:border-b-0 ${
                              unavailable ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                  active ? "border-primary bg-primary" : "border-muted-foreground/40"
                                }`}
                              >
                                {active && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="w-2.5 h-2.5 rounded-full bg-primary-foreground"
                                  />
                                )}
                              </div>
                              {side.price > 0 && !unavailable && (
                                <span className="text-sm text-muted-foreground font-medium">+₪{side.price}</span>
                              )}
                              {unavailable && (
                                <span className="text-sm font-bold text-destructive">(אזל מהמלאי כרגע)</span>
                              )}
                            </div>
                            <span className={`font-bold text-lg text-foreground ${unavailable ? "line-through text-muted-foreground" : ""}`}>{side.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        if (isDrinkUnavailable(selectedDrink)) {
                          const firstAvail = mealDrinkOptions.find((d) => !isDrinkUnavailable(d.id));
                          if (firstAvail) setSelectedDrink(firstAvail.id);
                        }
                        setStep("drink-select");
                      }}
                      className="w-full bg-primary text-primary-foreground font-black py-5 rounded-xl text-xl shadow-lg shadow-primary/20 mt-8"
                    >
                      המשך
                    </motion.button>
                  </motion.div>
                )}

                {step === "drink-select" && (
                  <motion.div
                    key="drink-select"
                    initial={{ opacity: 0, x: 40, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -40, scale: 0.97 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    className="flex-1 px-6 py-8"
                  >
                    <h3 className="text-2xl font-black text-center mb-6 text-foreground">בחר שתייה לעסקית:</h3>
                    
                    <div className="space-y-0">
                      {softDrinks.map((drink) => {
                        const active = selectedDrink === drink.id;
                        const unavailable = isDrinkUnavailable(drink.id);
                        return (
                          <button
                            key={drink.id}
                            disabled={unavailable}
                            onClick={() => !unavailable && setSelectedDrink(drink.id)}
                            className={`w-full flex items-center justify-between py-4 border-b border-border/50 last:border-b-0 ${unavailable ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                  unavailable ? "border-muted-foreground/20" : active ? "border-primary bg-primary" : "border-muted-foreground/40"
                                }`}
                              >
                                {active && !unavailable && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="w-2.5 h-2.5 rounded-full bg-primary-foreground"
                                  />
                                )}
                              </div>
                              {unavailable && <span className="text-sm text-destructive">(אזל מהמלאי)</span>}
                            </div>
                            <span className={`font-bold text-lg ${unavailable ? "line-through text-muted-foreground" : "text-foreground"}`}>{drink.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    <h4 className="text-xl font-black text-right mt-6 mb-3 text-foreground">בירות:</h4>
                    <div className="space-y-0">
                      {beerDrinks.map((drink) => {
                        const active = selectedDrink === drink.id;
                        const unavailable = isDrinkUnavailable(drink.id);
                        return (
                          <button
                            key={drink.id}
                            disabled={unavailable}
                            onClick={() => !unavailable && setSelectedDrink(drink.id)}
                            className={`w-full flex items-center justify-between py-4 border-b border-border/50 last:border-b-0 ${unavailable ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                  unavailable ? "border-muted-foreground/20" : active ? "border-primary bg-primary" : "border-muted-foreground/40"
                                }`}
                              >
                                {active && !unavailable && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="w-2.5 h-2.5 rounded-full bg-primary-foreground"
                                  />
                                )}
                              </div>
                              {unavailable && <span className="text-sm text-destructive">(אזל מהמלאי)</span>}
                              {!unavailable && <span className="text-sm text-muted-foreground font-medium">+₪{drink.price}</span>}
                            </div>
                            <span className={`font-bold text-lg ${unavailable ? "line-through text-muted-foreground" : "text-foreground"}`}>{drink.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleFinish(true, selectedSide, selectedDrink)}
                      className="w-full bg-primary text-primary-foreground font-black py-5 rounded-xl text-xl shadow-lg shadow-primary/20 mt-8 mb-4"
                    >
                      הוספה להזמנה 🍔
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom bar - only on customize step */}
            {step === "customize" && (
              <div className="px-5 py-5 border-t border-border flex items-center gap-3 bg-card safe-bottom flex-shrink-0">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleNext}
                  className="flex-1 bg-primary text-primary-foreground font-black py-4 rounded-xl text-xl shadow-lg shadow-primary/20"
                >
                  {isBurger ? "המשך" : `הוספה להזמנה · ₪${totalPrice}`}
                </motion.button>
                <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-foreground"
                  >
                    <Minus size={20} />
                  </button>
                  <span className="font-black text-xl w-8 text-center text-foreground">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-foreground"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ItemCustomizer;
