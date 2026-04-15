import { useState, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, Utensils } from "lucide-react";
import { MenuItem, toppings, Topping, removals, smashModifications, smashBurgerIds, mealUpgrade, mealSideOptions, mealDrinkOptions, drinkToAvailabilityId } from "@/data/menu";

interface ItemCustomizerProps {
  item: MenuItem | null;
  onClose: () => void;
  onConfirm: (item: MenuItem, quantity: number, selectedToppings: string[], selectedRemovals: string[], withMeal: boolean, mealSideId?: string, mealDrinkId?: string) => void;
  isAvailable?: (id: string) => boolean;
}

type Step = "customize" | "meal-upgrade" | "side-select" | "drink-select";

const ItemCustomizer = ({ item, onClose, onConfirm, isAvailable }: ItemCustomizerProps) => {
  const location = useLocation();
  const isKiosk = location.pathname === "/kiosk";
  const [quantity, setQuantity] = useState(1);
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [selectedRemovals, setSelectedRemovals] = useState<string[]>(["no-changes"]);
  const [step, setStep] = useState<Step>("customize");
  const [selectedSide, setSelectedSide] = useState<string>("side-fries");
  const [selectedDrink, setSelectedDrink] = useState<string>("drink-cola");
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (scrollRef.current && scrollRef.current.scrollTop > 10 && !expanded) {
      setExpanded(true);
    }
  }, [expanded]);

  if (!item) return null;

  // Map removal IDs to ingredient availability IDs
  const removalToIngredient: Record<string, string> = {
    "no-lettuce": "lettuce",
    "no-tomato": "tomato",
    "no-pickles": "pickles",
    "no-aioli": "aioli",
    "no-onion": "onion",
  };

  // Map meal side option IDs to availability IDs
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

  // Check which ingredients are unavailable
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
    // Auto-select first available side if current selection is unavailable
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
    setExpanded(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const softDrinks = mealDrinkOptions.filter(d => d.category === "soft");
  const beerDrinks = mealDrinkOptions.filter(d => d.category === "beer");

  return (
    <AnimatePresence>
      {item && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black z-50"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={
              step === "meal-upgrade"
                ? { y: 0, height: "auto", top: "auto", bottom: 0 }
                : isKiosk
                ? { y: 0, height: "100%" }
                : expanded
                ? { y: 0, height: "100%" }
                : { y: 0, height: "60%" }
            }
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={`fixed left-0 right-0 bottom-0 z-50 bg-white text-black flex flex-col ${
              step === "meal-upgrade"
                ? "inset-0 m-auto w-[90vw] max-w-lg h-fit rounded-3xl shadow-2xl"
                : "rounded-t-3xl shadow-2xl"
            }`}
            dir="rtl"
          >
            {/* Handle */}
            {step !== "meal-upgrade" && (
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1.5 rounded-full bg-muted" />
              </div>
            )}

            {/* Header */}
            {step !== "meal-upgrade" && (
              <div className={`flex items-center justify-between px-5 pb-3 pt-2 border-b border-gray-200 ${isKiosk ? "px-8 pb-5 pt-4" : ""}`}>
                <button onClick={handleClose} className={`rounded-full bg-gray-100 flex items-center justify-center ${isKiosk ? "w-14 h-14" : "w-10 h-10"}`}>
                  <X size={isKiosk ? 28 : 20} />
                </button>
                <h2 className={`font-black flex-1 text-center ${isKiosk ? "text-[28px]" : "text-xl"}`}>{item.name}</h2>
                <div className={isKiosk ? "w-14" : "w-10"} />
              </div>
            )}

            <AnimatePresence mode="wait">
              {step === "customize" && (
                <motion.div
                  key="customize"
                  initial={{ opacity: 0, x: 40, scale: 0.97 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -40, scale: 0.97 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className="flex-1 overflow-y-auto"
                  ref={scrollRef}
                  onScroll={handleScroll}
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
                                  {active && (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      className="w-3 h-3 rounded-full bg-white"
                                    />
                                  )}
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
                                    {active && (
                                      <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="w-3 h-3 rounded-full bg-white"
                                      />
                                    )}
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
                      <p className="text-sm">{item.description}</p>
                      <p className="text-lg font-bold text-primary mt-3">₪{item.price}</p>
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
                   <h3 className="text-xl font-black mb-3">לשדרג לארוחה עסקית?</h3>
                   <p className="text-primary font-black text-lg mb-1">+₪{mealUpgrade.price}</p>
                   <p className="text-gray-500 text-sm mb-8">המבורגר + צ׳יפס + שתייה</p>

                  <div className="w-full space-y-3">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => goToSideSelect()}
                      className="w-full bg-primary text-primary-foreground font-black py-4 rounded-xl text-lg shadow-lg shadow-primary/20"
                    >
                      שדרגו לי! 🍟🥤
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleFinish(false)}
                      className="w-full bg-gray-100 text-gray-500 font-bold py-4 rounded-xl text-base"
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
                  className="flex-1 px-5 py-6"
                >
                   <h3 className="text-lg font-black text-center mb-4">בחר סוג צ׳יפס לעסקית:</h3>
                  <div className="space-y-0">
                    {mealSideOptions.map((side) => {
                      const unavailable = isSideUnavailable(side.id);
                      const active = selectedSide === side.id && !unavailable;
                      return (
                        <button
                          key={side.id}
                          onClick={() => !unavailable && setSelectedSide(side.id)}
                          disabled={unavailable}
                          className={`w-full flex items-center justify-between py-4 border-b border-gray-100 last:border-b-0 ${
                            unavailable ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                                active ? "border-primary bg-primary" : "border-gray-300"
                              }`}
                            >
                              {active && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="w-3 h-3 rounded-full bg-white"
                                />
                              )}
                            </div>
                            {side.price > 0 && !unavailable && (
                              <span className="text-base text-gray-500 font-medium">+₪{side.price}</span>
                            )}
                            {unavailable && (
                              <span className="text-sm font-bold text-destructive">(אזל מהמלאי כרגע)</span>
                            )}
                          </div>
                          <span className={`font-bold text-lg ${unavailable ? "line-through text-gray-400" : ""}`}>{side.name}</span>
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
                    className="w-full bg-primary text-primary-foreground font-black py-4 rounded-xl text-lg shadow-lg shadow-primary/20 mt-6"
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
                  className="flex-1 overflow-y-auto px-5 py-6"
                >
                   <h3 className="text-lg font-black text-center mb-4">בחר שתייה לעסקית:</h3>
                  
                  <div className="space-y-0">
                    {softDrinks.map((drink) => {
                      const active = selectedDrink === drink.id;
                      const unavailable = isDrinkUnavailable(drink.id);
                      return (
                        <button
                          key={drink.id}
                          disabled={unavailable}
                          onClick={() => !unavailable && setSelectedDrink(drink.id)}
                          className={`w-full flex items-center justify-between py-4 border-b border-gray-100 last:border-b-0 ${unavailable ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                                unavailable ? "border-gray-200" : active ? "border-primary bg-primary" : "border-gray-300"
                              }`}
                            >
                              {active && !unavailable && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="w-3 h-3 rounded-full bg-white"
                                />
                              )}
                            </div>
                            {unavailable && <span className="text-sm text-destructive">(אזל מהמלאי)</span>}
                          </div>
                          <span className={`font-bold text-lg ${unavailable ? "line-through text-gray-400" : ""}`}>{drink.name}</span>
                        </button>
                      );
                    })}
                  </div>

                   <h4 className="text-base font-black text-right mt-4 mb-2">בירות:</h4>
                  <div className="space-y-0">
                    {beerDrinks.map((drink) => {
                      const active = selectedDrink === drink.id;
                      const unavailable = isDrinkUnavailable(drink.id);
                      return (
                        <button
                          key={drink.id}
                          disabled={unavailable}
                          onClick={() => !unavailable && setSelectedDrink(drink.id)}
                          className={`w-full flex items-center justify-between py-4 border-b border-gray-100 last:border-b-0 ${unavailable ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                                unavailable ? "border-gray-200" : active ? "border-primary bg-primary" : "border-gray-300"
                              }`}
                            >
                              {active && !unavailable && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="w-3 h-3 rounded-full bg-white"
                                />
                              )}
                            </div>
                            {unavailable && <span className="text-sm text-destructive">(אזל מהמלאי)</span>}
                            {!unavailable && <span className="text-base text-gray-500 font-medium">+₪{drink.price}</span>}
                          </div>
                          <span className={`font-bold text-lg ${unavailable ? "line-through text-gray-400" : ""}`}>{drink.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleFinish(true, selectedSide, selectedDrink)}
                    className="w-full bg-primary text-primary-foreground font-black py-4 rounded-xl text-lg shadow-lg shadow-primary/20 mt-6"
                  >
                    הוספה להזמנה 🍔
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom bar - only on customize step */}
            {step === "customize" && (
              <div className="px-5 py-4 border-t border-gray-200 flex items-center gap-3 bg-white safe-bottom">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleNext}
                  className="flex-1 bg-primary text-primary-foreground font-black py-4 rounded-xl text-lg shadow-lg shadow-primary/20"
                >
                  {isBurger ? "המשך" : `הוספה להזמנה · ₪${totalPrice}`}
                </motion.button>
                <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-4 py-3">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    <Minus size={18} />
                  </button>
                  <span className="font-black text-lg w-8 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    <Plus size={18} />
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
