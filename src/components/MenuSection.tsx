import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Star, Plus } from "lucide-react";
import { menuItems, MenuItem, drinkSubOptions } from "@/data/menu";
import { menuImages } from "@/data/menuImages";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const categories = [
  { key: "burger" as const, label: "🍔 ההמבורגרים שלנו" },
  { key: "meal" as const, label: "🍽️ ארוחות עסקיות" },
  { key: "side" as const, label: "🍟 צ׳יפס אחי?" },
  { key: "drink" as const, label: "🥤 שתיה" },
  { key: "beer" as const, label: "🍺 בירות" },
  { key: "deal" as const, label: "🤝 עשינו עסק" },
];

const matchesCategory = (item: MenuItem, key: typeof categories[number]["key"]) => {
  if (key === "beer") return item.category === "drink" && item.id.startsWith("beer-");
  if (key === "drink") return item.category === "drink" && !item.id.startsWith("beer-");
  // Show the 3-quarters arayes also at the end of the burgers section.
  if (key === "burger") return item.category === "burger" || item.id === "arayes-special";
  return item.category === key;
};

// Some menu items use a different ID than the availability row in the DB.
const menuItemAvailabilityAlias: Record<string, string> = {
  "beer-weiss": "drink-weiss",
  "beer-shapira": "drink-shapira",
  "beer-maccabi": "drink-maccabi",
};
const availabilityIdFor = (id: string) => menuItemAvailabilityAlias[id] ?? id;

const needsCustomization = (item: MenuItem) =>
  item.category === "burger" || item.category === "meal" || item.id === "friends-deal" || (item.category === "drink" && !!drinkSubOptions[item.id]);

const MenuCard = ({ item, onAdd, isKiosk = false, fontScale = 1, nameOverride, descOverride, browseOnly = false }: { item: MenuItem; onAdd: (item: MenuItem) => void; isKiosk?: boolean; fontScale?: number; nameOverride?: string; descOverride?: string; browseOnly?: boolean }) => {
  const image = menuImages[item.id];
  const displayName = nameOverride || item.name;
  const displayDesc = descOverride || item.description;
  const cardRef = useRef<HTMLDivElement>(null);

  // Tapping a card only OPENS the item flow (preview / customizer).
  // No "added to cart" feedback here — the confirmation animation belongs to
  // the actual add action inside the preview/customizer modal.
  const handleAdd = () => {
    if (browseOnly) return;
    onAdd(item);
  };

  // Fixed kiosk card height — locks every row to identical dimensions so no
  // card can grow/shrink based on text length, font load, or image presence.
  // This is the root cause of scroll "jumping" when scrolling through smash
  // burgers (longer descriptions wrap differently than shorter items).
  const kioskMinHeight = "calc(var(--kiosk-card-img-size, 176px) + 48px)"; // image + py-6*2

  return (
    <div
      ref={cardRef}
      onClick={handleAdd}
      className={`group relative overflow-hidden transition-colors border-b flex items-center ${browseOnly ? "cursor-default" : "cursor-pointer"} ${
        isKiosk
          ? "bg-white text-gray-900 active:bg-gray-100 border-gray-200 py-6 px-5 gap-6"
          : "bg-card text-foreground active:bg-secondary/50 border-border py-4 px-2 gap-4"
      }`}
      dir="rtl"
      style={{
        // contain: layout prevents this card's internal reflows from affecting
        // the scroll position or sibling cards. content-visibility:auto lets
        // the browser skip rendering offscreen cards entirely.
        contain: "layout style",
        ...(isKiosk ? { minHeight: kioskMinHeight } : {}),
      }}
    >
      {/* Text content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {item.badge && <span className={`flex-shrink-0 ${isKiosk ? "text-3xl" : "text-lg"}`}>{item.badge}</span>}
          <h3 className="font-bold break-words" style={{ fontSize: `${(isKiosk ? 24 : 16) * fontScale}px` }}>{displayName}</h3>
          {item.weight && (
            <span className={`flex-shrink-0 px-2 py-0.5 rounded-full ${isKiosk ? "text-base bg-gray-200 text-gray-700" : "text-xs text-muted-foreground bg-secondary"}`}>
              {item.weight}
            </span>
          )}
          {item.special && !image && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
              <Star size={9} fill="currentColor" />
              ספיישל
            </span>
          )}
          {(item.popular || item.specialOfMonth) && !image && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
              <Star size={9} fill="currentColor" />
              {item.specialOfMonth ? "ספיישל החודש" : "פופולארי"}
            </span>
          )}
          {item.id === "arayes-special" && !image && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold bg-green-600 text-white px-2 py-0.5 rounded-full">
              <Star size={9} fill="currentColor" />
              מלאי מוגבל
            </span>
          )}
        </div>
        <p
          className={`leading-relaxed line-clamp-2 ${isKiosk ? "text-gray-600" : "text-muted-foreground"}`}
          style={{
            fontSize: `${(isKiosk ? 18 : 14) * fontScale}px`,
            marginBottom: isKiosk ? 12 : 8,
            // Reserve exactly 2 lines of vertical space so descriptions of
            // varying length don't change the card's height. 1.6 ≈ leading-relaxed.
            minHeight: `${(isKiosk ? 18 : 14) * fontScale * 1.6 * 2}px`,
          }}
        >
          {displayDesc}
        </p>
        <span className="text-primary font-bold" style={{ fontSize: `${(isKiosk ? 24 : 18) * fontScale}px` }}>₪{item.price}</span>
      </div>

      {/* Image — kiosk size is admin-controlled via CSS var.
          Container ALWAYS renders with FIXED dimensions (even when no image
          exists) so every card in the list has the same height — eliminates
          scroll jump caused by some items having images and others not. */}
      <div
        className={`relative flex-shrink-0 ${isKiosk ? "" : "w-28 h-28"}`}
        style={
          isKiosk
            ? { width: "var(--kiosk-card-img-size, 176px)", height: "var(--kiosk-card-img-size, 176px)" }
            : undefined
        }
      >
        <div className="w-full h-full rounded-xl overflow-hidden bg-muted flex items-center justify-center">
          {image ? (
            <img
              src={image}
              alt={item.name}
              width={isKiosk ? 176 : 112}
              height={isKiosk ? 176 : 112}
              className="w-full h-full object-cover"
              loading={isKiosk ? "eager" : "lazy"}
              decoding={isKiosk ? "sync" : "async"}
              // High fetch priority on kiosk so images aren't deprioritized
              // behind fonts / chunks when the menu first paints.
              {...(isKiosk ? { fetchpriority: "high" as const } : {})}
              // Stale PWA/browser caches can hold a dead asset URL — retry once
              // with a cache-busting query before giving up.
              onError={(e) => {
                const el = e.currentTarget;
                if (el.dataset.retried) return;
                el.dataset.retried = "1";
                el.src = `${image}${image.includes("?") ? "&" : "?"}v=${Date.now()}`;
              }}
              style={isKiosk ? { transform: "scale(var(--kiosk-image-scale, 1))", transformOrigin: "center" } : undefined}
            />

          ) : (
            // Placeholder keeps the same fixed footprint as a real image,
            // so cards without an image don't change the row height.
            <span className={`${isKiosk ? "text-gray-400/60 text-5xl" : "text-muted-foreground/60 text-3xl"}`} aria-hidden>
              {item.badge || "🍽️"}
            </span>
          )}
        </div>
        {item.special && image && (
          <span className="absolute -right-3 top-2 inline-flex items-center gap-1 text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full shadow-md z-10">
            <Star size={9} fill="currentColor" />
            ספיישל
          </span>
        )}
        {(item.popular || item.specialOfMonth) && image && (
          <span className="absolute -right-3 top-2 inline-flex items-center gap-1 text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full shadow-md z-10">
            <Star size={9} fill="currentColor" />
            {item.specialOfMonth ? "ספיישל החודש" : "פופולארי"}
          </span>
        )}
        {item.id === "arayes-special" && image && (
          <span className="absolute -right-3 top-2 inline-flex items-center gap-1 text-[10px] font-bold bg-green-600 text-white px-2 py-0.5 rounded-full shadow-md z-10">
            <Star size={9} fill="currentColor" />
            מלאי מוגבל
          </span>
        )}
      </div>

    </div>
  );
};

/**
 * Kiosk tile — the chosen direction: a square card whose photo fills the tile
 * width, the item name in bold under the photo, the dish's ingredients in
 * smaller (but still readable) text under the name, and the price + a "+"
 * affordance pinned to the bottom of the card.
 */
const KioskTile = ({ item, onAdd, fontScale = 1, nameOverride, descOverride, browseOnly = false }: { item: MenuItem; onAdd: (item: MenuItem) => void; fontScale?: number; nameOverride?: string; descOverride?: string; browseOnly?: boolean }) => {
  const image = menuImages[item.id];
  const displayName = nameOverride || item.name;
  const displayDesc = descOverride || item.description;
  const ingSize = 17 * fontScale;
  const isDrink = item.category === "drink";

  const handleAdd = () => {
    if (browseOnly) return;
    onAdd(item);
  };

  return (
    <div
      onClick={handleAdd}
      dir="rtl"
      className={`bg-white rounded-xl overflow-hidden border border-gray-100 flex flex-col shadow-sm transition-transform duration-150 active:scale-[0.98] active:shadow-md ${browseOnly ? "cursor-default" : "cursor-pointer"}`}
      style={{
        // keep this tile's internal reflows from moving the rest of the grid
        contain: "layout style",
      }}
    >
      {/* The source food photos are landscape. Keeping their native 16:9 ratio
          avoids enlarging and heavily cropping them, so they look sharper. */}
      <div className={`relative w-full aspect-video bg-muted overflow-hidden ${isDrink ? "p-3" : ""}`}>
        {image ? (
          <img
            src={image}
            alt={item.name}
            width={800}
            height={450}
            className={`w-full h-full ${isDrink ? "object-contain" : "object-cover"}`}
            loading="eager"
            decoding="sync"
            {...{ fetchpriority: "high" as const }}
            // Stale PWA/browser caches can hold a dead asset URL — retry once
            // with a cache-busting query before giving up.
            onError={(e) => {
              const el = e.currentTarget;
              if (el.dataset.retried) return;
              el.dataset.retried = "1";
              el.src = `${image}${image.includes("?") ? "&" : "?"}v=${Date.now()}`;
            }}
          />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-6xl text-gray-400/60" aria-hidden>
            {item.badge || "🍽️"}
          </span>
        )}

        {/* Status tags — kept small so they never compete with the photo */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          {item.special && (
            <span className="inline-flex items-center gap-1 bg-foreground text-background text-xs font-bold px-2.5 py-1 rounded-full">
              <Star size={11} fill="currentColor" />
              ספיישל
            </span>
          )}
          {(item.popular || item.specialOfMonth) && (
            <span className="inline-flex items-center gap-1 bg-primary text-primary-foreground text-xs font-bold px-2.5 py-1 rounded-full">
              <Star size={11} fill="currentColor" />
              {item.specialOfMonth ? "ספיישל החודש" : "פופולארי"}
            </span>
          )}
          {item.id === "arayes-special" && (
            <span className="inline-flex items-center gap-1 bg-green-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              <Star size={11} fill="currentColor" />
              מלאי מוגבל
            </span>
          )}
        </div>
        {item.badge && (
          <span className="absolute top-2 left-2 text-2xl drop-shadow-md" aria-hidden>
            {item.badge}
          </span>
        )}
      </div>

      {/* Text block: bold name, ingredients under it, price pinned to the bottom */}
      <div className="p-3.5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3
            className="font-extrabold text-gray-900 leading-tight line-clamp-2 break-words"
            style={{
              fontSize: `${23 * fontScale}px`,
              // Reserve exactly 2 lines so a one-word name doesn't shrink the tile
              minHeight: `${23 * fontScale * 1.25 * 2}px`,
            }}
          >
            {displayName}
          </h3>
          {item.weight && (
            <span className="flex-shrink-0 text-gray-400 font-semibold mt-1.5 whitespace-nowrap" style={{ fontSize: `${14 * fontScale}px` }}>
              {item.weight}
            </span>
          )}
        </div>
        <p
          className="text-gray-500 leading-relaxed line-clamp-2 mt-1.5"
          style={{
            fontSize: `${ingSize}px`,
            // Reserve exactly 2 lines so ingredient length never changes tile height
            minHeight: `${ingSize * 1.6 * 2}px`,
          }}
        >
          {displayDesc}
        </p>
        <div className="mt-auto pt-3 flex items-center justify-between">
          <span className="text-primary font-black" style={{ fontSize: `${25 * fontScale}px` }}>₪{item.price}</span>
          <span className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md flex-shrink-0" aria-hidden>
            <Plus size={20} strokeWidth={3} />
          </span>
        </div>
      </div>
    </div>
  );
};

const MenuSection = ({ onAddItem, dineIn, onDineInChange, isAvailable, isKiosk = false, browseOnly = false }: { onAddItem: (item: MenuItem) => void; dineIn: boolean | null; onDineInChange: (val: boolean) => void; isAvailable: (id: string) => boolean; isKiosk?: boolean; browseOnly?: boolean }) => {
  const { settings } = useSiteSettings();
  const fontScale = isKiosk ? settings.kiosk_font_scale : settings.website_font_scale;
  type CategoryKey = typeof categories[number]["key"];
  const [activeCategory, setActiveCategory] = useState<CategoryKey>(categories[0].key);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const isScrollingToCategory = useRef(false);

  // Keep the active tab visible inside the horizontally scrollable tabs strip
  useEffect(() => {
    const container = tabsRef.current;
    const btn = tabRefs.current[activeCategory];
    if (!container || !btn) return;
    const cRect = container.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    // Center the active button within the visible area of the strip
    const offset = (bRect.left + bRect.right) / 2 - (cRect.left + cRect.right) / 2;
    container.scrollBy({ left: offset, behavior: "smooth" });
  }, [activeCategory]);

  // Intersection observer for auto-highlighting active category.
  // Debounced via rAF + timeout so state updates don't fire mid-scroll —
  // setState during scroll forces React to reconcile the sticky tab bar
  // and was causing visible scroll "jumps" between menu sections.
  useEffect(() => {
    let pendingKey: string | null = null;
    let timeoutId: number | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingToCategory.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const key = entry.target.getAttribute("data-category");
            if (key) pendingKey = key;
          }
        }
        if (timeoutId) window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
          if (pendingKey) {
            setActiveCategory((prev) => (prev === pendingKey ? prev : (pendingKey as CategoryKey)));
          }
        }, 120);
      },
      { rootMargin: "-120px 0px -60% 0px", threshold: 0.1 }
    );

    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  const scrollToCategory = useCallback((key: string) => {
    setActiveCategory(key as CategoryKey);
    const el = sectionRefs.current[key];
    if (el) {
      isScrollingToCategory.current = true;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => {
        isScrollingToCategory.current = false;
      }, 800);
    }
  }, []);

  // Filter categories that have available items
  const visibleCategories = categories.filter(
    (cat) => menuItems.some((i) => matchesCategory(i, cat.key) && isAvailable(availabilityIdFor(i.id)))
  );

  return (
    <section id="menu" className={`${isKiosk ? 'w-full max-w-none px-2 pt-4 pb-32 bg-white' : 'mx-auto max-w-2xl px-4 py-16'}`}>
      {/* Dine-in / Takeaway toggle removed from kiosk - now at end of flow */}

      {/* Sticky category tabs - kiosk + website (different sizing).
          NOTE: backdrop-blur removed — it caused per-frame re-sampling of the
          scrolling content underneath, producing jitter on the kiosk. Solid
          background is cheaper and visually equivalent here. */}
      <div
        className={`sticky z-50 ${isKiosk ? "bg-white border-b border-gray-200" : "bg-background border-b border-border"} ${
          isKiosk
            ? "top-0 -mx-2 px-2 pt-4 pb-0 mb-6"
            : "top-0 -mx-4 px-4 pb-3 mb-6"
        }`}
        style={
          isKiosk
            ? undefined
            : { paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }
        }
      >
        <div ref={tabsRef} className={`flex overflow-x-auto no-scrollbar ${isKiosk ? "gap-8" : "gap-2"}`} dir="rtl">

          {visibleCategories.map((cat) => {
            const active = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                ref={(el) => { tabRefs.current[cat.key] = el; }}
                onClick={() => scrollToCategory(cat.key)}
                className={`relative whitespace-nowrap font-bold transition-all flex-shrink-0 ${
                  isKiosk
                    ? `px-1 pb-3 text-2xl border-b-4 ${
                        active ? "text-primary border-primary" : "text-gray-400 border-transparent"
                      }`
                    : `rounded-full px-5 py-2.5 text-base ${
                        active ? "text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                      }`
                }`}
              >
                {active && !isKiosk && (
                  <div className="absolute inset-0 bg-primary rounded-full" />
                )}
                <span className="relative z-10">{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {categories.map((cat) => {
        let items = menuItems.filter((i) => matchesCategory(i, cat.key) && isAvailable(availabilityIdFor(i.id)));
        // Apply custom order if set
        if (settings.menu_order && settings.menu_order.length > 0) {
          items = [...items].sort((a, b) => {
            const idxA = settings.menu_order.indexOf(a.id);
            const idxB = settings.menu_order.indexOf(b.id);
            return (idxA === -1 ? 9999 : idxA) - (idxB === -1 ? 9999 : idxB);
          });
        }
        // Always pin arayes-special to the END of the burgers section.
        if (cat.key === "burger") {
          items = [...items].sort((a, b) => {
            if (a.id === "arayes-special") return 1;
            if (b.id === "arayes-special") return -1;
            return 0;
          });
        }
        if (items.length === 0) return null;
        return (
          <div
            key={cat.key}
            ref={(el) => { sectionRefs.current[cat.key] = el; }}
            data-category={cat.key}
            className="mb-10 scroll-mt-28"
          >
            <h3 className={`font-bold mb-4 text-primary text-right`} style={{ fontSize: `${(isKiosk ? 28 : 24) * fontScale}px` }}>{cat.label}</h3>
            {isKiosk ? (
              /* Kiosk: equal 2-column grid of square photo tiles (chosen direction) */
              <div className="grid grid-cols-2 gap-3">
                {items.map((item) => (
                  <KioskTile
                    key={`${cat.key}-${item.id}`}
                    item={item}
                    onAdd={onAddItem}
                    browseOnly={browseOnly}
                    fontScale={fontScale}
                    nameOverride={settings.menu_item_overrides[item.id]?.name || undefined}
                    descOverride={settings.menu_item_overrides[item.id]?.description || undefined}
                  />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {items.map((item) => (
                  <MenuCard
                    key={`${cat.key}-${item.id}`}
                    item={item}
                    onAdd={onAddItem}
                    browseOnly={browseOnly}
                    fontScale={fontScale}
                    nameOverride={settings.menu_item_overrides[item.id]?.name || undefined}
                    descOverride={settings.menu_item_overrides[item.id]?.description || undefined}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
};

export default MenuSection;
