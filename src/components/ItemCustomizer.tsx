import { useState } from "react";
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
  const [quantity, setQuantity] = useState(1);
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [selectedRemovals, setSelectedRemovals] = useState<string[]>(["no-changes"]);
  const [step, setStep] = useState<Step>("customize");
  const [selectedSide, setSelectedSide] = useState<string>("side-fries");
  const [selectedDrink, setSelectedDrink] = useState<string>("drink-cola");

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
            initial={step === "meal-upgrade" ? { opacity: 0, scale: 0.9 } : { y: "100%" }}
            animate={step === "meal-upgrade" ? { opacity: 1, scale: 1 } : { y: 0 }}
            exit={step === "meal-upgrade" ? { opacity: 0, scale: 0.9 } : { y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={`fixed z-50 bg-white text-black flex flex-col ${
              step === "meal-upgrade" 
                ? "inset-0 m-auto w-[90vw] max-w-lg h-fit rounded-3xl shadow-2xl" 
                : "inset-0 rounded-none"
            }`}
            dir="rtl"
          >
            {/* Handle - hide on meal-upgrade centered modal */}
            {step !== "meal-upgrade" && (
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1.5 rounded-full bg-muted" />
              </div>
            )}

            {/* Header - hide on meal-upgrade centered modal */}
            {step !== "meal-upgrade" && (
              <div className="flex items-center justify-between px-6 pb-5 pt-4 border-b border-gray-200">
                <button onClick={handleClose} className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                  <X size={28} />
                </button>
                <h2 className="text-3xl font-black flex-1 text-center">{item.name}</h2>
                <div className="w-14" />
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
                >
                  {isBurger && (
                    <>
                      <div className="px-6 py-6 border-b border-gray-200">
                        <h3 className="text-3xl font-black text-right mb-2">{isSmash ? "שינויים" : "שינויים אפשריים"}</h3>
                        <p className="text-lg text-gray-500 text-right mb-5">{isSmash ? "ברירת מחדל: חסה, חמוצים ואיולי" : "אפשר לבחור עד ל-5 פריטים"}</p>
                        <div className="space-y-0">
                          {removalsList.map((r) => {
                            const ingredientUnavailable = getIngredientUnavailable(r.id);
                            const active = selectedRemovals.includes(r.id) || ingredientUnavailable;
                            const isLocked = ingredientUnavailable;
                            return (
                              <button
                                key={r.id}
                                onClick={() => !isLocked && toggleRemoval(r.id)}
                                className={`w-full flex items-center justify-between py-5 border-b border-gray-100 last:border-b-0 ${isLocked ? "opacity-70" : ""}`}
                              >
                                <div
                                  className={`w-10 h-10 rounded-full border-3 flex items-center justify-center transition-colors ${
                                    active ? "border-primary bg-primary" : "border-gray-300"
                                  }`}
                                >
                                  {active && (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      className="w-4 h-4 rounded-full bg-white"
                                    />
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-bold text-2xl">{r.name}</span>
                                  {isLocked && (
                                    <span className="text-sm font-bold text-destructive">(חסר במלאי כרגע)</span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="px-6 py-6">
                        <h3 className="text-3xl font-black text-right mb-2">תוספות בתשלום</h3>
                        <p className="text-lg text-gray-500 text-right mb-5">אפשר לבחור עד ל-9 פריטים</p>
                        <div className="space-y-0">
                          {toppings.filter((t: Topping) => !isAvailable || isAvailable(t.id)).map((t: Topping) => {
                            const active = selectedToppings.includes(t.id);
                            const showRecommended = t.recommended && (item.id === "smash-double-cheese" || item.baseBurgerId === "smash-double-cheese" || item.id === "meal-smash-double-cheese");
                            return (
                              <button
                                key={t.id}
                                onClick={() => toggleTopping(t.id)}
                                className="w-full flex items-center justify-between py-5 border-b border-gray-100 last:border-b-0"
                              >
                                <div className="flex items-center gap-4">
                                  <div
                                    className={`w-10 h-10 rounded-full border-3 flex items-center justify-center transition-colors ${
                                      active ? "border-primary bg-primary" : "border-gray-300"
                                    }`}
                                  >
                                    {active && (
                                      <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="w-4 h-4 rounded-full bg-white"
                                      />
                                    )}
                                  </div>
                                  <span className="text-xl text-gray-500 font-medium">+ ₪{t.price}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-bold text-2xl">{t.name}</span>
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
                      <p className="text-base">{item.description}</p>
                      <p className="text-2xl font-bold text-primary mt-3">₪{item.price}</p>
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
                   <h3 className="text-3xl font-black mb-3">לשדרג לארוחה עסקית?</h3>
                   <p className="text-primary font-black text-2xl mb-1">+₪{mealUpgrade.price}</p>
                   <p className="text-gray-500 text-lg mb-8">המבורגר + צ׳יפס + שתייה</p>

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
                      className="w-full bg-gray-100 text-gray-500 font-bold py-5 rounded-xl text-lg"
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
                   <h3 className="text-2xl font-black text-center mb-6">בחר סוג צ׳יפס לעסקית:</h3>
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
                  className="flex-1 overflow-y-auto px-6 py-8"
                >
                   <h3 className="text-2xl font-black text-center mb-6">בחר שתייה לעסקית:</h3>
                  
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

                   <h4 className="text-xl font-black text-right mt-6 mb-3">בירות:</h4>
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
                    className="w-full bg-primary text-primary-foreground font-black py-5 rounded-xl text-xl shadow-lg shadow-primary/20 mt-8"
                  >
                    הוספה להזמנה 🍔
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom bar - only on customize step */}
            {step === "customize" && (
              <div className="px-6 py-6 border-t border-gray-200 flex items-center gap-4 bg-white safe-bottom">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleNext}
                  className="flex-1 bg-primary text-primary-foreground font-black py-5 rounded-xl text-2xl shadow-lg shadow-primary/20"
                >
                  {isBurger ? "המשך" : `הוספה להזמנה · ₪${totalPrice}`}
                </motion.button>
                <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-4 py-3">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-12 h-12 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    <Minus size={24} />
                  </button>
                  <span className="font-black text-2xl w-10 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="w-12 h-12 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    <Plus size={24} />
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
