import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, Star, Trash2, Pencil, Check, Plus, ShoppingBag, ArrowRight, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useAvailability } from "@/hooks/useAvailability";
import {
  menuItems,
  type MenuItem,
  ingredients as menuIngredients,
  removalDisplayNames,
  donenessOptions,
  smashBurgerIds,
  mealSideOptions,
  mealDrinkOptions,
  drinkToAvailabilityId,
} from "@/data/menu";
import { findTopping, getAllToppings } from "@/lib/toppingsLookup";
import type { CartItem } from "@/components/CartDrawer";
import type { ItemCustomizerInitialState } from "@/components/ItemCustomizer";
import { toast } from "@/hooks/use-toast";

/** Result returned by the parent's customizer bridge. */
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

interface Props {
  open: boolean;
  onClose: () => void;
  /** Adds items into the live cart. */
  onUseFavorite: (items: CartItem[], mode: "cart" | "checkout") => void;
  /** Snapshot of the current cart (used for "save current cart as favorite"). */
  currentCart: CartItem[];
  /** Force the modal to open directly in setup mode. */
  startInSetup?: boolean;
  /**
   * Bridge: opens the parent's ItemCustomizer for `menuItem` and resolves with
   * the user's selections (or null if cancelled). Reuses the same toppings /
   * removals / meal UI as the regular ordering flow — so the user can pick
   * vegetables, doneness, and extras when defining or tweaking the favorite.
   */
  customizeMenuItem: (
    menuItem: MenuItem,
    initialState?: ItemCustomizerInitialState,
  ) => Promise<CustomizerResult | null>;
}

interface HistoryItem {
  item_id: string | null;
  item_name: string;
  price: number;
  quantity: number;
  toppings: string[] | null;
  removals: string[] | null;
  with_meal: boolean | null;
  meal_side: string | null;
  meal_drink: string | null;
  deal_burgers: any;
  deal_drinks: any;
}
interface HistoryOrder {
  id: string;
  order_number: number;
  created_at: string;
  total: number;
  items: HistoryItem[];
}

/** Items the customizer can handle: same rule used in Index.openItemFlow. */
const CUSTOMIZABLE = menuItems.filter((m) => m.category === "burger" || m.category === "meal");
/** Simple items that are added directly (no customization): sides + drinks. */
const SIMPLE_ITEMS = menuItems.filter((m) => m.category === "side" || m.category === "drink");

/** Build a CartItem for a simple (non-customizable) menu item. */
const simpleToCartItem = (m: MenuItem): CartItem => ({
  id: `${m.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  menuItemId: m.id,
  name: m.name,
  price: m.price,
  quantity: 1,
  toppings: [],
  removals: [],
  withMeal: false,
});

/** Convert a saved order's items into fresh CartItems. */
const orderItemsToCart = (items: HistoryItem[]): CartItem[] => {
  const out: CartItem[] = [];
  for (const it of items) {
    if (!it.item_id) continue;
    if (it.item_name === "רטבים") continue;
    const menuItem: MenuItem | undefined = menuItems.find((m) => m.id === it.item_id);
    if (!menuItem) continue;
    out.push({
      id: `${it.item_id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      menuItemId: it.item_id,
      name: menuItem.name,
      price: menuItem.price,
      quantity: it.quantity || 1,
      toppings: Array.isArray(it.toppings) ? it.toppings : [],
      removals: Array.isArray(it.removals) ? it.removals.filter((r) => !r.startsWith("__OWNER__")) : [],
      withMeal: !!it.with_meal,
      mealSideId: it.meal_side ?? undefined,
      mealDrinkId: it.meal_drink ?? undefined,
      dealBurgers: it.deal_burgers ?? undefined,
      dealDrinks: it.deal_drinks ?? undefined,
    });
  }
  return out;
};

/** Re-issue fresh ids for a stored favorite before pushing into the live cart. */
const refreshIds = (items: CartItem[]): CartItem[] =>
  items.map((it) => ({
    ...it,
    id: `${it.menuItemId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  }));

/** Map a customizer result back into a CartItem entry. */
const resultToCartItem = (r: CustomizerResult): CartItem => ({
  id: `${r.item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  menuItemId: r.item.id,
  name: r.item.name,
  price: r.item.price,
  quantity: r.quantity,
  toppings: r.selectedToppings,
  removals: r.selectedRemovals,
  withMeal: r.withMeal,
  mealSideId: r.mealSideId,
  mealDrinkId: r.mealDrinkId,
  ownerName: r.ownerName,
});

/** Build a detailed, human-readable summary of a CartItem (doneness, vegetables,
 *  bun, toppings, meal upgrade, owner name) — so the customer sees exactly
 *  what's in their favorite. */
const describeCartItem = (it: CartItem): {
  donenessLabel?: string;
  vegetablesLine: string;
  toppingsLine?: string;
  mealLine?: string;
  ownerLine?: string;
} => {
  const menuItem = menuItems.find((m) => m.id === it.menuItemId);
  const isBurger = menuItem?.category === "burger" || menuItem?.category === "meal";
  const isSmash = it.menuItemId ? smashBurgerIds.includes(it.menuItemId) : false;

  // Doneness
  const donenessId = it.removals.find((r) => r.startsWith("doneness-"));
  const donenessLabel = donenessId
    ? donenessOptions.find((d) => d.id === donenessId)?.label
    : undefined;

  // Vegetables / sauces (ingredients): figure out the final ON list based on defaults +/- removals/adds.
  const removalsClean = it.removals.filter((r) => !r.startsWith("doneness-") && !r.startsWith("__OWNER__"));
  let vegetablesLine = "";
  if (isBurger) {
    const present: string[] = [];
    const removed: string[] = [];
    for (const ing of menuIngredients) {
      const defaultOn = isSmash ? ing.defaultSmash : ing.defaultRegular;
      const wasRemoved = removalsClean.includes(ing.removalId);
      const wasAdded = ing.addId ? removalsClean.includes(ing.addId) : false;
      const finalOn = (defaultOn && !wasRemoved) || (!defaultOn && wasAdded);
      if (finalOn) present.push(ing.name);
      else if (defaultOn && wasRemoved) removed.push(ing.name);
    }
    if (removalsClean.includes("dry")) {
      vegetablesLine = "יבש — ללא ירקות ורטבים";
    } else if (removed.length === 0) {
      vegetablesLine = present.length ? `כל הירקות (${present.join(", ")})` : "ללא ירקות";
    } else {
      const parts: string[] = [];
      parts.push(`בלי: ${removed.join(", ")}`);
      if (present.length) parts.push(`עם: ${present.join(", ")}`);
      vegetablesLine = parts.join(" · ");
    }
  }

  // Toppings (paid extras + special bun)
  const toppingNames = it.toppings
    .map((tId) => {
      if (tId === "gluten-free-bun") return "לחמנייה ללא גלוטן";
      return findTopping(tId)?.name;
    })
    .filter(Boolean) as string[];
  // Other "add" removals not part of ingredients defaults (e.g., add-tomato when not default)
  const extraAdditions = removalsClean
    .filter((r) => r.startsWith("add-"))
    .map((r) => removalDisplayNames[r])
    .filter(Boolean);
  const allExtras = [...toppingNames, ...extraAdditions];
  const toppingsLine = allExtras.length ? `תוספות: ${allExtras.join(", ")}` : undefined;

  // Meal upgrade
  let mealLine: string | undefined;
  if (it.withMeal) {
    const sideName = it.mealSideId
      ? mealSideOptions.find((s) => s.id === it.mealSideId)?.name
      : undefined;
    const drinkName = it.mealDrinkId
      ? mealDrinkOptions.find((d) => d.id === it.mealDrinkId)?.name
      : undefined;
    const parts = [sideName, drinkName].filter(Boolean) as string[];
    mealLine = parts.length ? `שדרוג עסקית: ${parts.join(" + ")}` : "שדרוג עסקית";
  }

  const ownerLine = it.ownerName ? `על השם: ${it.ownerName}` : undefined;

  return { donenessLabel, vegetablesLine, toppingsLine, mealLine, ownerLine };
};

/** Editable list with edit / remove buttons per row. */
const EditableList = ({
  items,
  onEdit,
  onRemove,
  selectable,
  selectedIds,
  onToggleSelect,
}: {
  items: CartItem[];
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) => (
  <ul className="space-y-2">
    {items.map((it, idx) => {
      const desc = describeCartItem(it);
      const isSelected = selectable ? selectedIds?.has(it.id) ?? false : false;
      return (
        <li
          key={it.id}
          onClick={selectable ? () => onToggleSelect?.(it.id) : undefined}
          className={`relative rounded-xl p-3 bg-card transition-all ${
            selectable
              ? isSelected
                ? "border-2 border-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.2)] cursor-pointer"
                : "border border-border opacity-60 cursor-pointer hover:opacity-80"
              : "border border-border"
          }`}
        >
          {selectable && (
            <div
              className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white ${
                isSelected ? "bg-green-500" : "bg-muted border border-border"
              }`}
            >
              {isSelected && <Check size={12} strokeWidth={3} />}
            </div>
          )}
          <div className={`flex items-start justify-between gap-2 ${selectable ? "pr-6" : ""}`}>
            <div className="text-right flex-1 min-w-0 space-y-0.5">
              <p className="font-bold text-foreground text-sm">
                {it.quantity > 1 ? `${it.quantity}× ` : ""}
                {it.name}
              </p>
              {desc.donenessLabel && (
                <p className="text-xs text-muted-foreground">מידת עשייה: {desc.donenessLabel}</p>
              )}
              {desc.vegetablesLine && (
                <p className="text-xs text-muted-foreground">{desc.vegetablesLine}</p>
              )}
              {desc.toppingsLine && (
                <p className="text-xs text-muted-foreground">{desc.toppingsLine}</p>
              )}
              {desc.mealLine && (
                <p className="text-xs text-primary font-semibold">{desc.mealLine}</p>
              )}
              {desc.ownerLine && (
                <p className="text-xs text-muted-foreground">{desc.ownerLine}</p>
              )}
            </div>
            <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onEdit(idx)}
                className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
                aria-label="ערוך"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => onRemove(idx)}
                className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20"
                aria-label="הסר"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </li>
      );
    })}
  </ul>
);


/** Map mealSide id → menu_availability item_id (mirrors ItemCustomizer). */
const sideToAvailability: Record<string, string> = {
  "side-fries": "fries",
  "side-sweet-potato": "sweet-potato-fries",
  "side-onion-rings": "onion-rings",
  "side-tempura": "tempura-onion",
};

/** Convert a meal-drink id to a standalone drink menuItem (used when the meal
 *  upgrade is broken because the side is gone — we keep the drink at full
 *  price as a separate cart line). */
const mealDrinkToStandalone = (drinkId: string): { menuItem: MenuItem; label: string } | null => {
  const drink = mealDrinkOptions.find((d) => d.id === drinkId);
  if (!drink) return null;
  let standaloneId: string;
  if (drink.category === "soft") standaloneId = "can";
  else if (drink.price >= 15) standaloneId = "beer-weiss";
  else if (drink.price >= 12) standaloneId = "beer-premium";
  else standaloneId = "beer-regular";
  const menuItem = menuItems.find((m) => m.id === standaloneId);
  if (!menuItem) return null;
  return { menuItem, label: `${menuItem.name} (${drink.name}) — ₪${menuItem.price}` };
};

/** What's broken in a single line item right now. */
type LineIssue =
  | { kind: "main"; missingId: string; missingName: string; alternatives: MenuItem[] }
  | { kind: "topping"; missingId: string; missingName: string; alternatives: { id: string; name: string; price: number }[] }
  | { kind: "side"; missingId: string; missingName: string; alternatives: typeof mealSideOptions; keepDrink?: { menuItem: MenuItem; label: string } | null }
  | { kind: "drink"; missingId: string; missingName: string; alternatives: typeof mealDrinkOptions };

const FavoriteOrderModal = ({ open, onClose, onUseFavorite, currentCart, startInSetup, customizeMenuItem }: Props) => {
  useBodyScrollLock(open);
  const { favoriteItems, setFavoriteItems, isLoggedIn } = useCustomerAuth();
  const [view, setView] = useState<"confirm" | "setup">("confirm");
  /** Working draft used by setup view (what we'll save as the favorite). */
  const [draft, setDraft] = useState<CartItem[]>([]);
  /** Working copy used by confirm view (per-order tweaks; doesn't replace saved favorite). */
  const [usingDraft, setUsingDraft] = useState<CartItem[]>([]);
  /** Selected line ids in confirm view — only these go to checkout/cart. */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** True while the customizer is open in front of us. */
  const [customizing, setCustomizing] = useState(false);
  /** Picker for "add new dish": which menu item to customize. */
  const [pickerOpen, setPickerOpen] = useState(false);
  /** Pending dish awaiting a required owner name (for additional favorite dishes). */
  const [pendingNameDish, setPendingNameDish] = useState<{ item: CartItem; target: "draft" | "using" } | null>(null);
  const [pendingNameValue, setPendingNameValue] = useState("");
  const [orders, setOrders] = useState<HistoryOrder[] | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [saving, setSaving] = useState(false);
  const { isAvailable } = useAvailability();

  const hasFavorite = !!(favoriteItems && favoriteItems.length > 0);

  /** Compute availability issues for each line in usingDraft. */
  const issuesByIndex = useMemo<Record<number, LineIssue[]>>(() => {
    const out: Record<number, LineIssue[]> = {};
    if (view !== "confirm") return out;
    usingDraft.forEach((it, idx) => {
      const lineIssues: LineIssue[] = [];
      const mainId = it.menuItemId;
      const mainMenu = menuItems.find((m) => m.id === mainId);
      if (mainId && mainMenu && !isAvailable(mainId)) {
        const alternatives = menuItems
          .filter((m) => m.category === mainMenu.category && m.id !== mainId && isAvailable(m.id))
          .slice(0, 6);
        lineIssues.push({ kind: "main", missingId: mainId, missingName: mainMenu.name, alternatives });
      }
      it.toppings.forEach((tId) => {
        if (!isAvailable(tId)) {
          const t = findTopping(tId);
          const alternatives = getAllToppings()
            .filter((x) => x.id !== tId && isAvailable(x.id) && !it.toppings.includes(x.id))
            .map((x) => ({ id: x.id, name: x.name, price: x.price }))
            .slice(0, 8);
          lineIssues.push({ kind: "topping", missingId: tId, missingName: t?.name ?? tId, alternatives });
        }
      });
      if (it.withMeal && it.mealSideId) {
        const availId = sideToAvailability[it.mealSideId];
        if (availId && !isAvailable(availId)) {
          const sideOpt = mealSideOptions.find((s) => s.id === it.mealSideId);
          const alternatives = mealSideOptions.filter(
            (s) => s.id !== it.mealSideId && isAvailable(sideToAvailability[s.id] ?? s.id),
          );
          const keepDrink = it.mealDrinkId ? mealDrinkToStandalone(it.mealDrinkId) : null;
          lineIssues.push({
            kind: "side",
            missingId: it.mealSideId,
            missingName: sideOpt?.name ?? it.mealSideId,
            alternatives,
            keepDrink,
          });
        }
      }
      if (it.withMeal && it.mealDrinkId) {
        const availId = drinkToAvailabilityId[it.mealDrinkId];
        if (availId && !isAvailable(availId)) {
          const drinkOpt = mealDrinkOptions.find((d) => d.id === it.mealDrinkId);
          const alternatives = mealDrinkOptions.filter(
            (d) =>
              d.id !== it.mealDrinkId &&
              d.category === drinkOpt?.category &&
              isAvailable(drinkToAvailabilityId[d.id] ?? d.id),
          );
          lineIssues.push({
            kind: "drink",
            missingId: it.mealDrinkId,
            missingName: drinkOpt?.name ?? it.mealDrinkId,
            alternatives,
          });
        }
      }
      if (lineIssues.length) out[idx] = lineIssues;
    });
    return out;
  }, [usingDraft, isAvailable, view]);

  const hasAnyIssues = Object.keys(issuesByIndex).length > 0;

  // ---- Issue resolution helpers (operate on usingDraft) ----
  const updateLine = (idx: number, updater: (it: CartItem) => CartItem) =>
    setUsingDraft((prev) => prev.map((it, i) => (i === idx ? updater(it) : it)));

  const replaceMain = (idx: number, newMenuItem: MenuItem) => {
    updateLine(idx, (it) => ({
      ...it,
      menuItemId: newMenuItem.id,
      name: newMenuItem.name,
      price: newMenuItem.price,
    }));
    toast({ title: `הוחלף ל${newMenuItem.name}` });
  };

  const removeLine = (idx: number) => {
    setUsingDraft((prev) => prev.filter((_, i) => i !== idx));
    toast({ title: "המנה הוסרה מההזמנה הזאת" });
  };

  const replaceTopping = (idx: number, oldId: string, newId: string, newName: string) => {
    updateLine(idx, (it) => ({
      ...it,
      toppings: it.toppings.map((t) => (t === oldId ? newId : t)),
    }));
    toast({ title: `הוחלף ל${newName}` });
  };

  const removeTopping = (idx: number, oldId: string) => {
    updateLine(idx, (it) => ({ ...it, toppings: it.toppings.filter((t) => t !== oldId) }));
    toast({ title: "התוספת הוסרה" });
  };

  const replaceSide = (idx: number, newSideId: string, newName: string) => {
    updateLine(idx, (it) => ({ ...it, mealSideId: newSideId }));
    toast({ title: `הצד הוחלף ל${newName}` });
  };

  /** Drop the meal-deal but keep the drink as a separate cart line (full price). */
  const dropSideKeepDrink = (idx: number) => {
    setUsingDraft((prev) => {
      const target = prev[idx];
      if (!target || !target.mealDrinkId) return prev;
      const standalone = mealDrinkToStandalone(target.mealDrinkId);
      const updatedTarget: CartItem = {
        ...target,
        withMeal: false,
        mealSideId: undefined,
        mealDrinkId: undefined,
      };
      const out = [...prev];
      out[idx] = updatedTarget;
      if (standalone) {
        out.push({
          id: `${standalone.menuItem.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          menuItemId: standalone.menuItem.id,
          name: standalone.menuItem.name,
          price: standalone.menuItem.price,
          quantity: target.quantity,
          toppings: [],
          removals: [],
          withMeal: false,
        });
      }
      return out;
    });
    toast({ title: "העסקית בוטלה — השתייה נשארה במחיר מלא" });
  };

  /** Drop the entire meal upgrade (no side, no drink). */
  const dropMealEntirely = (idx: number) => {
    updateLine(idx, (it) => ({
      ...it,
      withMeal: false,
      mealSideId: undefined,
      mealDrinkId: undefined,
    }));
    toast({ title: "השדרוג לעסקית בוטל" });
  };

  const replaceDrink = (idx: number, newDrinkId: string, newName: string) => {
    updateLine(idx, (it) => ({ ...it, mealDrinkId: newDrinkId }));
    toast({ title: `השתייה הוחלפה ל${newName}` });
  };

  // Reset state every time the modal opens.
  useEffect(() => {
    if (!open) return;
    const goSetup = startInSetup || !hasFavorite;
    setView(goSetup ? "setup" : "confirm");
    const refreshed = hasFavorite ? refreshIds(favoriteItems!) : [];
    setDraft(refreshed);
    setUsingDraft(refreshed);
    setSelectedIds(new Set(refreshed.map((i) => i.id)));
    setPickerOpen(false);
  }, [open, startInSetup, hasFavorite, favoriteItems]);

  // Lazy-load past orders only the first time the user enters setup view.
  useEffect(() => {
    if (!open || view !== "setup" || orders !== null) return;
    const deviceToken = localStorage.getItem("habakta_device_token");
    if (!deviceToken) {
      setOrders([]);
      return;
    }
    setLoadingOrders(true);
    supabase.functions
      .invoke("get-customer-orders", { body: { deviceToken } })
      .then(({ data, error }) => {
        if (error) setOrders([]);
        else setOrders((data?.orders as HistoryOrder[]) ?? []);
      })
      .finally(() => setLoadingOrders(false));
  }, [open, view, orders]);

  const usableOrders = useMemo(
    () => (orders ?? []).filter((o) => orderItemsToCart(o.items).length > 0).slice(0, 10),
    [orders],
  );

  /** Open the parent customizer; while open, hide our modal so the customizer is on top. */
  const runCustomizer = async (
    menuItem: MenuItem,
    initialState?: ItemCustomizerInitialState,
  ): Promise<CartItem | null> => {
    setCustomizing(true);
    try {
      const result = await customizeMenuItem(menuItem, initialState);
      if (!result) return null;
      return resultToCartItem(result);
    } finally {
      setCustomizing(false);
    }
  };

  const cartItemToInitial = (it: CartItem): ItemCustomizerInitialState => ({
    quantity: it.quantity,
    selectedToppings: it.toppings,
    selectedRemovals: it.removals,
    withMeal: it.withMeal,
    mealSideId: it.mealSideId,
    mealDrinkId: it.mealDrinkId,
    ownerName: it.ownerName,
  });

  // ----- Confirm-view actions (per-order edits, not persisted) -----

  const handleEditUsing = async (idx: number) => {
    const target = usingDraft[idx];
    const menuItem = menuItems.find((m) => m.id === target.menuItemId);
    if (!menuItem) return;
    if (menuItem.category !== "burger" && menuItem.category !== "meal") {
      toast({ title: "פריט זה לא ניתן לעריכה — אפשר להסיר ולהוסיף מחדש" });
      return;
    }
    const updated = await runCustomizer(menuItem, cartItemToInitial(target));
    if (!updated) return;
    setUsingDraft((prev) => prev.map((it, i) => (i === idx ? { ...updated, id: it.id } : it)));
  };

  const handleRemoveUsing = (idx: number) => {
    setUsingDraft((prev) => {
      const removed = prev[idx];
      if (removed) {
        setSelectedIds((s) => {
          const next = new Set(s);
          next.delete(removed.id);
          return next;
        });
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddOnceForOrder = async (menuItem: MenuItem) => {
    setPickerOpen(false);
    const added = await runCustomizer(menuItem);
    if (!added) return;
    if (usingDraft.length >= 1 && !added.ownerName?.trim()) {
      setPendingNameValue("");
      setPendingNameDish({ item: added, target: "using" });
      return;
    }
    setUsingDraft((prev) => [...prev, added]);
    setSelectedIds((s) => new Set(s).add(added.id));
  };

  const handleConfirmUse = (mode: "cart" | "checkout") => {
    const chosen = usingDraft.filter((it) => selectedIds.has(it.id));
    if (chosen.length === 0) {
      toast({ title: "בחר לפחות מנה אחת להמשך", variant: "destructive" });
      return;
    }
    onUseFavorite(refreshIds(chosen), mode);
    onClose();
    toast({
      title: mode === "checkout"
        ? "מעבירים אותך לתשלום ❤️"
        : "ההזמנה הקבועה שלך נוספה לעגלה ❤️",
    });
  };

  // ----- Setup-view actions (persists to favoriteItems) -----

  const handleEditDraft = async (idx: number) => {
    const target = draft[idx];
    const menuItem = menuItems.find((m) => m.id === target.menuItemId);
    if (!menuItem) return;
    if (menuItem.category !== "burger" && menuItem.category !== "meal") {
      toast({ title: "פריט זה לא ניתן לעריכה — אפשר להסיר ולהוסיף מחדש" });
      return;
    }
    const updated = await runCustomizer(menuItem, cartItemToInitial(target));
    if (!updated) return;
    setDraft((prev) => prev.map((it, i) => (i === idx ? { ...updated, id: it.id } : it)));
  };

  const handleRemoveDraft = (idx: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddDishToDraft = async (menuItem: MenuItem) => {
    setPickerOpen(false);
    const added = await runCustomizer(menuItem);
    if (!added) return;
    if (draft.length >= 1 && !added.ownerName?.trim()) {
      setPendingNameValue("");
      setPendingNameDish({ item: added, target: "draft" });
      return;
    }
    setDraft((prev) => [...prev, added]);
  };

  const confirmPendingName = () => {
    const trimmed = pendingNameValue.trim();
    if (!trimmed || !pendingNameDish) return;
    const withName: CartItem = { ...pendingNameDish.item, ownerName: trimmed };
    if (pendingNameDish.target === "draft") {
      setDraft((prev) => [...prev, withName]);
    } else {
      setUsingDraft((prev) => [...prev, withName]);
      setSelectedIds((s) => new Set(s).add(withName.id));
    }
    setPendingNameDish(null);
    setPendingNameValue("");
  };

  const cancelPendingName = () => {
    setPendingNameDish(null);
    setPendingNameValue("");
  };

  const handleSaveDraft = async () => {
    if (draft.length === 0) {
      toast({ title: "צריך לבחור לפחות מנה אחת", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await setFavoriteItems(draft);
      toast({ title: "ההזמנה הקבועה נשמרה ⭐" });
      setUsingDraft(refreshIds(draft));
      setView("confirm");
    } catch {
      toast({ title: "שגיאה בשמירה", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLoadFromOrder = (order: HistoryOrder) => {
    const items = orderItemsToCart(order.items);
    if (items.length === 0) {
      toast({ title: "לא ניתן לטעון הזמנה זו", variant: "destructive" });
      return;
    }
    setDraft(items);
    toast({ title: "ההזמנה נטענה — אפשר לערוך לפני שמירה" });
  };

  const handleLoadFromCart = () => {
    if (currentCart.length === 0) return;
    setDraft(refreshIds(currentCart));
    toast({ title: "העגלה נטענה — אפשר לערוך לפני שמירה" });
  };

  const handleClearFavorite = async () => {
    setSaving(true);
    try {
      await setFavoriteItems(null);
      setDraft([]);
      setUsingDraft([]);
      toast({ title: "ההזמנה הקבועה נמחקה" });
      setView("setup");
    } finally {
      setSaving(false);
    }
  };

  if (!isLoggedIn) return null;

  // While the parent customizer is open, hide our backdrop+sheet so it's on top.
  const visuallyHidden = customizing;

  return (
    <AnimatePresence>
      {open && (
        <>
          {!visuallyHidden && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[80]"
              onClick={onClose}
            />
          )}
          {!visuallyHidden && (
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.92 }}
              transition={{ type: "spring", damping: 22, stiffness: 260 }}
              dir="rtl"
              className="fixed left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-[calc(100%-1.5rem)] max-w-md max-h-[88vh] bg-gradient-to-b from-card via-card to-card/95 border border-green-500/30 rounded-3xl shadow-[0_25px_60px_-15px_rgba(34,197,94,0.45),0_0_0_1px_rgba(34,197,94,0.1)] z-[90] flex flex-col overflow-hidden ring-1 ring-green-500/20"
            >
              <div className="relative flex items-center justify-between px-5 py-4 border-b border-border/60 bg-gradient-to-l from-green-500/10 via-transparent to-transparent">
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Heart size={22} className="text-green-500 fill-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                  </motion.div>
                  <h2 className="text-lg font-bold text-foreground">
                    {pickerOpen
                      ? "בחר מנה"
                      : view === "confirm"
                      ? "המנה הקבועה שלך"
                      : hasFavorite
                      ? "עדכון הקבוע"
                      : "הגדרת הזמנה קבועה"}
                  </h2>
                </div>
                <button
                  onClick={pickerOpen ? () => setPickerOpen(false) : onClose}
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground"
                  aria-label="סגור"
                >
                  {pickerOpen ? <ArrowRight size={18} /> : <X size={18} />}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* DISH PICKER (overlay-like view inside the sheet) */}
                {pickerOpen && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      בחר מנה, צד או שתייה להוסיף לקבוע.
                    </p>
                    <p className="text-xs font-bold text-foreground mt-2">המבורגרים ומנות</p>
                    <div className="grid grid-cols-1 gap-2">
                      {CUSTOMIZABLE.map((m) => (
                        <button
                          key={m.id}
                          onClick={() =>
                            view === "confirm" ? handleAddOnceForOrder(m) : handleAddDishToDraft(m)
                          }
                          className="text-right border border-border rounded-xl p-3 hover:bg-muted/50 transition-colors"
                        >
                          <p className="font-bold text-foreground text-sm">{m.name}</p>
                          {m.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{m.description}</p>
                          )}
                          <p className="text-xs text-primary font-bold mt-1">₪{m.price}</p>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs font-bold text-foreground mt-3">תוספות ושתייה</p>
                    <div className="grid grid-cols-2 gap-2">
                      {SIMPLE_ITEMS.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            const ci = simpleToCartItem(m);
                            if (view === "confirm") {
                              setUsingDraft((prev) => [...prev, ci]);
                              setSelectedIds((s) => new Set(s).add(ci.id));
                            } else {
                              setDraft((prev) => [...prev, ci]);
                            }
                            setPickerOpen(false);
                            toast({ title: `${m.name} נוסף` });
                          }}
                          className="text-right border border-border rounded-xl p-2.5 hover:bg-muted/50 transition-colors"
                        >
                          <p className="font-bold text-foreground text-xs">{m.name}</p>
                          <p className="text-xs text-primary font-bold mt-0.5">₪{m.price}</p>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* CONFIRM view — use favorite, with per-order edits */}
                {!pickerOpen && view === "confirm" && (
                  <>
                    {hasAnyIssues && (
                      <div className="rounded-xl border-2 border-amber-500/60 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-3">
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                          <AlertTriangle size={18} />
                          <p className="font-bold text-sm">חלק מהפריטים בקבוע לא זמינים כעת</p>
                        </div>
                        <p className="text-xs text-amber-700/90 dark:text-amber-200/90">
                          בחר חלופה או הסר לפני שממשיכים:
                        </p>
                        <div className="space-y-3">
                          {Object.entries(issuesByIndex).map(([idxStr, lineIssues]) => {
                            const idx = Number(idxStr);
                            const it = usingDraft[idx];
                            return (
                              <div key={idx} className="bg-card border border-border rounded-lg p-2.5 space-y-2.5">
                                <p className="text-xs font-bold text-foreground">
                                  במנה: {it?.name}
                                </p>
                                {lineIssues.map((iss, j) => (
                                  <div key={j} className="space-y-1.5 border-r-2 border-amber-400 pr-2">
                                    <p className="text-xs text-foreground">
                                      {iss.kind === "main" && <>חסר במלאי: <b>{iss.missingName}</b> (המנה הראשית)</>}
                                      {iss.kind === "topping" && <>תוספת חסרה: <b>{iss.missingName}</b></>}
                                      {iss.kind === "side" && <>הצד חסר: <b>{iss.missingName}</b></>}
                                      {iss.kind === "drink" && <>השתייה חסרה: <b>{iss.missingName}</b></>}
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {iss.kind === "main" && iss.alternatives.map((alt) => (
                                        <button
                                          key={alt.id}
                                          onClick={() => replaceMain(idx, alt)}
                                          className="text-[11px] px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 font-semibold"
                                        >
                                          החלף ל{alt.name} (₪{alt.price})
                                        </button>
                                      ))}
                                      {iss.kind === "main" && (
                                        <button
                                          onClick={() => removeLine(idx)}
                                          className="text-[11px] px-2 py-1 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 font-semibold"
                                        >
                                          הסר מההזמנה
                                        </button>
                                      )}
                                      {iss.kind === "topping" && iss.alternatives.map((alt) => (
                                        <button
                                          key={alt.id}
                                          onClick={() => replaceTopping(idx, iss.missingId, alt.id, alt.name)}
                                          className="text-[11px] px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 font-semibold"
                                        >
                                          החלף ל{alt.name}{alt.price ? ` (+₪${alt.price})` : ""}
                                        </button>
                                      ))}
                                      {iss.kind === "topping" && (
                                        <button
                                          onClick={() => removeTopping(idx, iss.missingId)}
                                          className="text-[11px] px-2 py-1 rounded-full bg-muted text-foreground hover:bg-muted/70 font-semibold"
                                        >
                                          לא צריך את {iss.missingName}
                                        </button>
                                      )}
                                      {iss.kind === "side" && iss.alternatives.map((alt) => (
                                        <button
                                          key={alt.id}
                                          onClick={() => replaceSide(idx, alt.id, alt.name)}
                                          className="text-[11px] px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 font-semibold"
                                        >
                                          החלף ל{alt.name}{alt.price ? ` (+₪${alt.price})` : ""}
                                        </button>
                                      ))}
                                      {iss.kind === "side" && iss.keepDrink && (
                                        <button
                                          onClick={() => dropSideKeepDrink(idx)}
                                          className="text-[11px] px-2 py-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-200 hover:bg-amber-500/25 font-semibold"
                                        >
                                          בטל עסקית, השאר שתייה: {iss.keepDrink.label}
                                        </button>
                                      )}
                                      {iss.kind === "side" && (
                                        <button
                                          onClick={() => dropMealEntirely(idx)}
                                          className="text-[11px] px-2 py-1 rounded-full bg-muted text-foreground hover:bg-muted/70 font-semibold"
                                        >
                                          לא צריך צד, גם בלי שתייה
                                        </button>
                                      )}
                                      {iss.kind === "drink" && iss.alternatives.map((alt) => (
                                        <button
                                          key={alt.id}
                                          onClick={() => replaceDrink(idx, alt.id, alt.name)}
                                          className="text-[11px] px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 font-semibold"
                                        >
                                          החלף ל{alt.name}{alt.price ? ` (+₪${alt.price})` : ""}
                                        </button>
                                      ))}
                                      {iss.kind === "drink" && (
                                        <button
                                          onClick={() => dropMealEntirely(idx)}
                                          className="text-[11px] px-2 py-1 rounded-full bg-muted text-foreground hover:bg-muted/70 font-semibold"
                                        >
                                          בטל את שדרוג העסקית
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      רוצה לערוך משהו רק להזמנה הזאת לפני שממשיכים?
                    </p>
                    {usingDraft.length === 0 ? (
                      <div className="text-center text-muted-foreground py-6 text-sm border border-dashed border-border rounded-xl">
                        אין מנות בקבוע — הוסף מנה למטה.
                      </div>
                    ) : (
                      <EditableList
                        items={usingDraft}
                        onEdit={handleEditUsing}
                        onRemove={handleRemoveUsing}
                      />
                    )}
                    <button
                      onClick={() => setPickerOpen(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-primary/40 text-primary hover:bg-primary/5 font-semibold text-sm"
                    >
                      <Plus size={16} />
                      הוסף מנה לפעם הזאת
                    </button>
                    <div className="flex flex-col gap-2 pt-2">
                      <motion.button
                        onClick={() => handleConfirmUse("checkout")}
                        disabled={hasAnyIssues}
                        animate={hasAnyIssues ? {} : {
                          scale: [1, 1.04, 1, 1.04, 1],
                          rotate: [0, -1.2, 0, 1.2, 0],
                        }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                        whileTap={{ scale: 0.96 }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-full bg-gradient-to-l from-green-500 via-green-600 to-green-500 hover:from-green-600 hover:to-green-600 text-white font-bold text-base transition-colors shadow-[0_10px_30px_-5px_rgba(34,197,94,0.6)] ring-2 ring-green-400/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:animate-none"
                      >
                        <Check size={20} />
                        {hasAnyIssues ? "פתור קודם את הפריטים החסרים" : "המשך לתשלום עם הקבוע שלי"}
                      </motion.button>
                      <button
                        onClick={() => handleConfirmUse("cart")}
                        disabled={hasAnyIssues}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ShoppingBag size={15} />
                        הוסף לעגלה והמשך לקנות
                      </button>
                      <button
                        onClick={() => setView("setup")}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full border border-border text-foreground hover:bg-muted font-semibold text-sm"
                      >
                        <Pencil size={15} />
                        ערוך / שנה את הקבוע השמור
                      </button>
                      <button
                        onClick={handleClearFavorite}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs text-destructive/80 hover:text-destructive transition-colors"
                      >
                        <Trash2 size={13} />
                        מחק את ההזמנה הקבועה
                      </button>
                    </div>
                  </>
                )}

                {/* SETUP view — build/edit the saved favorite */}
                {!pickerOpen && view === "setup" && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      בנה את ההזמנה הקבועה שלך — לכל מנה אפשר לבחור ירקות, מידת עשייה ותוספות.
                    </p>

                    {draft.length === 0 ? (
                      <div className="text-center text-muted-foreground py-6 text-sm border border-dashed border-border rounded-xl">
                        עדיין אין מנות בקבוע. הוסף מנה ראשונה למטה.
                      </div>
                    ) : (
                      <EditableList items={draft} onEdit={handleEditDraft} onRemove={handleRemoveDraft} />
                    )}

                    <button
                      onClick={() => setPickerOpen(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-primary/40 text-primary hover:bg-primary/5 font-semibold text-sm"
                    >
                      <Plus size={16} />
                      הוסף מנה לקבוע
                    </button>

                    <button
                      onClick={handleSaveDraft}
                      disabled={saving || draft.length === 0}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-green-600 hover:bg-green-700 text-white font-bold text-base transition-colors shadow-lg shadow-green-600/30 disabled:opacity-60"
                    >
                      <Star size={16} />
                      שמור כהזמנה הקבועה שלי
                    </button>

                    {/* Quick fill helpers */}
                    <details className="group">
                      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground select-none flex items-center gap-1">
                        <span>טעינה מהירה (אופציונלי)</span>
                      </summary>
                      <div className="mt-3 space-y-3">
                        {currentCart.length > 0 && (
                          <button
                            onClick={handleLoadFromCart}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-border hover:bg-muted/50 text-sm"
                          >
                            <span className="flex items-center gap-2 text-foreground font-semibold">
                              <ShoppingBag size={14} />
                              טען מהעגלה הנוכחית
                            </span>
                            <span className="text-xs text-muted-foreground">{currentCart.length} פריטים</span>
                          </button>
                        )}
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground">או מתוך הזמנות קודמות:</p>
                          {loadingOrders && <p className="text-xs text-muted-foreground">טוען…</p>}
                          {!loadingOrders && usableOrders.length === 0 && (
                            <p className="text-xs text-muted-foreground">אין הזמנות קודמות.</p>
                          )}
                          {usableOrders.map((order) => {
                            const items = orderItemsToCart(order.items);
                            return (
                              <button
                                key={order.id}
                                onClick={() => handleLoadFromOrder(order)}
                                className="w-full text-right border border-border rounded-xl p-2.5 hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex justify-between mb-0.5">
                                  <span className="text-xs font-bold text-foreground">#{order.order_number}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(order.created_at).toLocaleDateString("he-IL")} · ₪{Number(order.total).toFixed(0)}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {items.map((i) => `${i.quantity > 1 ? i.quantity + "× " : ""}${i.name}`).join(" · ")}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </details>

                    {hasFavorite && (
                      <button
                        onClick={() => setView("confirm")}
                        className="w-full text-sm text-muted-foreground hover:text-foreground underline pt-2"
                      >
                        חזור לקבוע הנוכחי
                      </button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* Required-name prompt for additional favorite dishes */}
          {pendingNameDish && !visuallyHidden && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
              onClick={cancelPendingName}
              dir="rtl"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm bg-card border border-green-500/40 rounded-2xl shadow-[0_25px_60px_-15px_rgba(34,197,94,0.5)] p-5 space-y-4"
              >
                <div className="space-y-1">
                  <h3 className="font-bold text-foreground text-base">למי המנה הזאת?</h3>
                  <p className="text-xs text-muted-foreground">
                    כדי להבדיל בין המנות בקבוע — חובה להוסיף שם למנה הנוספת ({pendingNameDish.item.name}).
                  </p>
                </div>
                <input
                  type="text"
                  autoFocus
                  value={pendingNameValue}
                  onChange={(e) => setPendingNameValue(e.target.value.slice(0, 30))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && pendingNameValue.trim()) confirmPendingName();
                    if (e.key === "Escape") cancelPendingName();
                  }}
                  placeholder="לדוגמה: של אבא, של דנה..."
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40"
                />
                <div className="flex gap-2">
                  <button
                    onClick={confirmPendingName}
                    disabled={!pendingNameValue.trim()}
                    className="flex-1 px-4 py-2.5 rounded-full bg-green-600 hover:bg-green-700 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    הוסף לקבוע
                  </button>
                  <button
                    onClick={cancelPendingName}
                    className="px-4 py-2.5 rounded-full border border-border text-foreground hover:bg-muted text-sm font-semibold"
                  >
                    ביטול
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
};

export default FavoriteOrderModal;
