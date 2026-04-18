import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Star } from "lucide-react";
import { menuItems, MenuItem, drinkSubOptions } from "@/data/menu";
import { menuImages } from "@/data/menuImages";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useFlyToCart } from "@/contexts/FlyToCartContext";

const categories = [
  { key: "burger" as const, label: "🍔 ההמבורגרים שלנו" },
  { key: "meal" as const, label: "🍽️ ארוחות עסקיות" },
  { key: "side" as const, label: "🍟 צ׳יפס אחי!" },
  { key: "drink" as const, label: "🍺 מה את שותה?" },
  { key: "deal" as const, label: "🤝 עשינו עסק" },
];

const needsCustomization = (item: MenuItem) =>
  item.category === "burger" || item.category === "meal" || item.id === "friends-deal" || (item.category === "drink" && !!drinkSubOptions[item.id]);

const MenuCard = ({ item, onAdd, isKiosk = false, fontScale = 1, nameOverride, descOverride }: { item: MenuItem; onAdd: (item: MenuItem) => void; isKiosk?: boolean; fontScale?: number; nameOverride?: string; descOverride?: string }) => {
  const image = menuImages[item.id];
  const displayName = nameOverride || item.name;
  const displayDesc = descOverride || item.description;
  const cardRef = useRef<HTMLDivElement>(null);
  const { flyToCart } = useFlyToCart();

  const handleAdd = () => {
    // For simple items (no customization step), the item is added directly to
    // the cart — fire the fly animation from the card's image rect so the user
    // sees the item "land" in the cart icon. Skipped for items that open a
    // modal first; those fire the animation on confirm via the parent page.
    if (!needsCustomization(item) && cardRef.current) {
      const imgEl = cardRef.current.querySelector("img");
      const sourceRect = (imgEl ?? cardRef.current).getBoundingClientRect();
      flyToCart({ sourceRect, imageUrl: image });
    }
    onAdd(item);
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      layout={false}
      onClick={handleAdd}
      className={`bg-card group relative overflow-hidden cursor-pointer active:bg-secondary/50 transition-colors border-b border-border flex items-center ${
        isKiosk ? "py-6 px-5 gap-6" : "py-4 px-2 gap-4"
      }`}
      dir="rtl"
    >
      {/* Text content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {item.badge && <span className={isKiosk ? "text-3xl" : "text-lg"}>{item.badge}</span>}
          <h3 className="font-bold" style={{ fontSize: `${(isKiosk ? 24 : 16) * fontScale}px` }}>{displayName}</h3>
          {item.weight && (
            <span className={`text-muted-foreground bg-secondary px-2 py-0.5 rounded-full ${isKiosk ? "text-base" : "text-xs"}`}>
              {item.weight}
            </span>
          )}
          {item.popular && !image && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
              <Star size={9} fill="currentColor" />
              פופולארי
            </span>
          )}
        </div>
        <p className="text-muted-foreground leading-relaxed line-clamp-2" style={{ fontSize: `${(isKiosk ? 18 : 14) * fontScale}px`, marginBottom: isKiosk ? 12 : 8 }}>{displayDesc}</p>
        <span className="text-primary font-bold" style={{ fontSize: `${(isKiosk ? 24 : 18) * fontScale}px` }}>₪{item.price}</span>
      </div>

      {/* Image */}
      {image && (
        <div className={`relative flex-shrink-0 ${isKiosk ? "w-44 h-44" : "w-28 h-28"}`}>
          <div className="w-full h-full rounded-xl overflow-hidden">
            <img src={image} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
          </div>
          {item.popular && (
            <span className="absolute -right-3 top-2 inline-flex items-center gap-1 text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full shadow-md z-10">
              <Star size={9} fill="currentColor" />
              פופולארי
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
};

const MenuSection = ({ onAddItem, dineIn, onDineInChange, isAvailable, isKiosk = false }: { onAddItem: (item: MenuItem) => void; dineIn: boolean | null; onDineInChange: (val: boolean) => void; isAvailable: (id: string) => boolean; isKiosk?: boolean }) => {
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

  // Intersection observer for auto-highlighting active category (kiosk + website)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingToCategory.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const key = entry.target.getAttribute("data-category");
            if (key) setActiveCategory(key as CategoryKey);
          }
        }
      },
      { rootMargin: "-120px 0px -60% 0px", threshold: 0.1 }
    );

    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
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
    (cat) => menuItems.some((i) => i.category === cat.key && isAvailable(i.id))
  );

  return (
    <section id="menu" className={`mx-auto ${isKiosk ? 'max-w-5xl px-6 pt-4 pb-16' : 'max-w-2xl px-4 py-16'}`}>
      {/* Dine-in / Takeaway toggle removed from kiosk - now at end of flow */}

      {/* Sticky category tabs - kiosk + website (different sizing) */}
      <div
        className={`sticky z-30 bg-background/90 backdrop-blur-md border-b border-border ${
          isKiosk
            ? "top-0 -mx-4 px-4 pt-3 pb-2 mb-4"
            : "top-0 -mx-4 px-4 pt-2 pb-2 mb-6"
        }`}
      >
        <div ref={tabsRef} className={`flex overflow-x-auto no-scrollbar ${isKiosk ? "gap-2" : "gap-1.5"}`} dir="rtl">
          {visibleCategories.map((cat) => (
            <button
              key={cat.key}
              ref={(el) => { tabRefs.current[cat.key] = el; }}
              onClick={() => scrollToCategory(cat.key)}
              className={`relative whitespace-nowrap rounded-full font-bold transition-all flex-shrink-0 ${
                isKiosk ? "px-6 py-3 text-base" : "px-4 py-1.5 text-sm"
              } ${
                activeCategory === cat.key
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {activeCategory === cat.key && (
                <motion.div
                  layoutId="activeCategoryTab"
                  className="absolute inset-0 bg-primary rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {categories.map((cat) => {
        let items = menuItems.filter((i) => i.category === cat.key && isAvailable(i.id));
        // Apply custom order if set
        if (settings.menu_order && settings.menu_order.length > 0) {
          items = [...items].sort((a, b) => {
            const idxA = settings.menu_order.indexOf(a.id);
            const idxB = settings.menu_order.indexOf(b.id);
            return (idxA === -1 ? 9999 : idxA) - (idxB === -1 ? 9999 : idxB);
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
            <h3 className={`font-bold mb-4 text-primary text-right`} style={{ fontSize: `${(isKiosk ? 36 : 24) * fontScale}px` }}>{cat.label}</h3>
            <div className="divide-y divide-border">
              {items.map((item) => (
                <MenuCard
                  key={item.id}
                  item={item}
                  onAdd={onAddItem}
                  isKiosk={isKiosk}
                  fontScale={fontScale}
                  nameOverride={settings.menu_item_overrides[item.id]?.name || undefined}
                  descOverride={settings.menu_item_overrides[item.id]?.description || undefined}
                />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
};

export default MenuSection;
