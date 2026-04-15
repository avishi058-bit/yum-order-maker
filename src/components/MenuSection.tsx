import { useState, useCallback } from "react";
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
      className={`bg-card group relative overflow-hidden cursor-pointer active:bg-secondary/50 transition-colors ${
        isKiosk 
          ? "flex flex-col items-center text-center border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow" 
          : "border-b border-border py-4 px-2 flex items-center gap-4"
      }`}
      dir="rtl"
    >
      {/* Text content - right side */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {item.badge && <span className="text-lg">{item.badge}</span>}
          <h3 className="text-base font-bold">{item.name}</h3>
          {item.weight && (
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              {item.weight}
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-sm mb-2 leading-relaxed line-clamp-2">{item.description}</p>
        <span className="text-primary font-bold text-lg">₪{item.price}</span>
      </div>

      {/* Image - left side */}
      {image && (
        <div className="relative w-28 h-28 flex-shrink-0">
          <div className="w-full h-full rounded-xl overflow-hidden">
            <img
              src={image}
              alt={item.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          {item.popular && (
            <span className="absolute -right-3 top-2 inline-flex items-center gap-1 text-[10px] font-bold bg-green-500 text-white px-2 py-0.5 rounded-full shadow-md z-10">
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
            className="absolute left-2 top-2 bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg z-10 pointer-events-none"
          >
            <ShoppingBag size={12} />
            נוסף לסל!
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const MenuSection = ({ onAddItem, dineIn, onDineInChange, isAvailable, isKiosk = false }: { onAddItem: (item: MenuItem) => void; dineIn: boolean; onDineInChange: (val: boolean) => void; isAvailable: (id: string) => boolean; isKiosk?: boolean }) => {
  return (
    <section id="menu" className={`py-16 px-4 mx-auto ${isKiosk ? 'max-w-6xl' : 'max-w-2xl'}`}>
      {/* Dine-in / Takeaway toggle */}
      <div className="flex justify-center mb-10">
        <div className="bg-secondary rounded-full p-1 flex gap-1">
          <button
            onClick={() => onDineInChange(true)}
            className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${
              dineIn ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground"
            }`}
          >
            🪑 לשבת
          </button>
          <button
            onClick={() => onDineInChange(false)}
            className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${
              !dineIn ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground"
            }`}
          >
            🥡 לקחת
          </button>
        </div>
      </div>
      {categories.map((cat) => {
        const items = menuItems.filter((i) => i.category === cat.key && isAvailable(i.id));
        if (items.length === 0) return null;
        return (
          <div key={cat.key} className="mb-10">
            <h3 className="text-2xl font-bold mb-3 text-primary text-right">{cat.label}</h3>
            <div className={isKiosk ? "grid grid-cols-2 lg:grid-cols-3 gap-4" : "divide-y divide-border"}>
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
