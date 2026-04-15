import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Star } from "lucide-react";
import { menuItems, MenuItem, drinkSubOptions } from "@/data/menu";
import { menuImages } from "@/data/menuImages";

const categories = [
  { key: "burger" as const, label: "🍔 ההמבורגרים שלנו" },
  { key: "meal" as const, label: "🍽️ ארוחות עסקיות" },
  { key: "side" as const, label: "🍟 צ׳יפס אחי!" },
  { key: "drink" as const, label: "🍺 מה את שותה?" },
  { key: "deal" as const, label: "🤝 עשינו עסק" },
];

const needsCustomization = (item: MenuItem) =>
  item.category === "burger" || item.category === "meal" || item.id === "friends-deal" || (item.category === "drink" && !!drinkSubOptions[item.id]);

const MenuCard = ({ item, onAdd, isKiosk = false }: { item: MenuItem; onAdd: (item: MenuItem) => void; isKiosk?: boolean }) => {
  const image = menuImages[item.id];
  const [justAdded, setJustAdded] = useState(false);

  const handleAdd = () => {
    onAdd(item);
    if (!needsCustomization(item)) {
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1200);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      layout={false}
      onClick={handleAdd}
      className={`bg-card group relative overflow-hidden cursor-pointer active:bg-secondary/50 transition-colors border-b border-border py-4 px-2 flex items-center gap-4 ${
        isKiosk ? "py-5 px-4 gap-5" : ""
      }`}
      dir="rtl"
    >
      {/* Text content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {item.badge && <span className={isKiosk ? "text-2xl" : "text-lg"}>{item.badge}</span>}
          <h3 className={`font-bold ${isKiosk ? "text-xl" : "text-base"}`}>{item.name}</h3>
          {item.weight && (
            <span className={`text-muted-foreground bg-secondary px-2 py-0.5 rounded-full ${isKiosk ? "text-sm" : "text-xs"}`}>
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
        <p className={`text-muted-foreground leading-relaxed line-clamp-2 ${isKiosk ? "text-base mb-2" : "text-sm mb-2"}`}>{item.description}</p>
        <span className={`text-primary font-bold ${isKiosk ? "text-xl" : "text-lg"}`}>₪{item.price}</span>
      </div>

      {/* Image */}
      {image && (
        <div className={`relative flex-shrink-0 ${isKiosk ? "w-36 h-36" : "w-28 h-28"}`}>
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

      {/* Toast notification */}
      <AnimatePresence>
        {justAdded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className={`absolute left-2 top-2 bg-green-500 text-white font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg z-10 pointer-events-none ${isKiosk ? "text-sm" : "text-xs"}`}
          >
            <ShoppingBag size={isKiosk ? 16 : 12} />
            נוסף לסל!
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const MenuSection = ({ onAddItem, dineIn, onDineInChange, isAvailable, isKiosk = false }: { onAddItem: (item: MenuItem) => void; dineIn: boolean | null; onDineInChange: (val: boolean) => void; isAvailable: (id: string) => boolean; isKiosk?: boolean }) => {
  const [activeCategory, setActiveCategory] = useState(categories[0].key);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const isScrollingToCategory = useRef(false);

  // Intersection observer for auto-highlighting active category
  useEffect(() => {
    if (!isKiosk) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingToCategory.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const key = entry.target.getAttribute("data-category");
            if (key) setActiveCategory(key);
          }
        }
      },
      { rootMargin: "-120px 0px -60% 0px", threshold: 0.1 }
    );

    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [isKiosk]);

  const scrollToCategory = useCallback((key: string) => {
    setActiveCategory(key);
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
    <section id="menu" className={`mx-auto ${isKiosk ? 'max-w-4xl px-4 pt-4 pb-16' : 'max-w-2xl px-4 py-16'}`}>
      {/* Dine-in / Takeaway toggle - only show for kiosk */}
      {isKiosk && (
        <div className="flex justify-center mb-6">
          <div className="bg-secondary rounded-full p-1 flex gap-1">
            <button
              onClick={() => onDineInChange(true)}
              className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${
                dineIn === true ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground"
              }`}
            >
              🪑 לשבת
            </button>
            <button
              onClick={() => onDineInChange(false)}
              className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${
                dineIn === false ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground"
              }`}
            >
              🥡 לקחת
            </button>
          </div>
        </div>
      )}

      {/* Sticky category tabs - kiosk only */}
      {isKiosk && (
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border pb-2 pt-3 mb-4 -mx-4 px-4">
          <div ref={tabsRef} className="flex gap-2 overflow-x-auto no-scrollbar" dir="rtl">
            {visibleCategories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => scrollToCategory(cat.key)}
                className={`relative whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all flex-shrink-0 ${
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
      )}

      {categories.map((cat) => {
        const items = menuItems.filter((i) => i.category === cat.key && isAvailable(i.id));
        if (items.length === 0) return null;
        return (
          <div
            key={cat.key}
            ref={(el) => { sectionRefs.current[cat.key] = el; }}
            data-category={cat.key}
            className="mb-10 scroll-mt-28"
          >
            <h3 className={`font-bold mb-3 text-primary text-right ${isKiosk ? "text-3xl" : "text-2xl"}`}>{cat.label}</h3>
            <div className="divide-y divide-border">
              {items.map((item) => (
                <MenuCard key={item.id} item={item} onAdd={onAddItem} isKiosk={isKiosk} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
};

export default MenuSection;
