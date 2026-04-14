import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Check, ShoppingBag } from "lucide-react";
import { menuItems, MenuItem } from "@/data/menu";
import { menuImages } from "@/data/menuImages";

const categories = [
  { key: "burger" as const, label: "🍔 ההמבורגרים שלנו" },
  { key: "side" as const, label: "🍟 צ׳יפס אחי!" },
  { key: "drink" as const, label: "🍺 מה את שותה?" },
  { key: "deal" as const, label: "🤝 עשינו עסק" },
];

const needsCustomization = (item: MenuItem) =>
  item.category === "burger" || item.id === "friends-deal";

const MenuCard = ({ item, onAdd }: { item: MenuItem; onAdd: (item: MenuItem) => void }) => {
  const image = menuImages[item.id];
  const [justAdded, setJustAdded] = useState(false);
  const [flyingItem, setFlyingItem] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleAdd = () => {
    onAdd(item);
    if (!needsCustomization(item)) {
      setFlyingItem(true);
      setJustAdded(true);

      setTimeout(() => setFlyingItem(false), 600);
      setTimeout(() => setJustAdded(false), 1400);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-card border-b border-border py-4 px-2 flex items-center gap-4 group relative overflow-visible"
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
        <div className="flex items-center justify-between">
          <span className="text-primary font-bold text-lg">₪{item.price}</span>
          <motion.button
            ref={buttonRef}
            whileTap={{ scale: 0.85 }}
            onClick={handleAdd}
            className={`w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-colors duration-300 ${
              justAdded
                ? "bg-green-500 shadow-green-500/20"
                : "bg-primary shadow-primary/20 opacity-80 group-hover:opacity-100"
            }`}
          >
            <AnimatePresence mode="wait">
              {justAdded ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                >
                  <Check size={18} className="text-white" />
                </motion.div>
              ) : (
                <motion.div
                  key="plus"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Plus size={18} className="text-primary-foreground" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      {/* Image - left side */}
      {image && (
        <div className="w-28 h-28 rounded-xl overflow-hidden flex-shrink-0">
          <img
            src={image}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Flying item animation */}
      <AnimatePresence>
        {flyingItem && (
          <motion.div
            initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            animate={{
              opacity: 0,
              scale: 0.2,
              x: -120,
              y: 200,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.32, 0, 0.67, 0] }}
            className="absolute left-8 top-1/2 -translate-y-1/2 z-20 pointer-events-none"
          >
            <div className="bg-primary text-primary-foreground rounded-full w-12 h-12 flex items-center justify-center shadow-xl">
              <ShoppingBag size={20} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast notification */}
      <AnimatePresence>
        {justAdded && !flyingItem && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="absolute left-2 top-2 bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg z-10"
          >
            <ShoppingBag size={12} />
            נוסף לסל!
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const MenuSection = ({ onAddItem }: { onAddItem: (item: MenuItem) => void }) => {
  return (
    <section id="menu" className="py-16 px-4 max-w-2xl mx-auto">
      <h2 className="text-4xl font-black text-center mb-4">התפריט שלנו</h2>
      <p className="text-center text-primary text-sm font-medium mb-12">
        🎉 בעונתינו: התוספת הרביעית עלינו! (הזולה מביניהם)
      </p>
      {categories.map((cat) => {
        const items = menuItems.filter((i) => i.category === cat.key);
        if (items.length === 0) return null;
        return (
          <div key={cat.key} className="mb-10">
            <h3 className="text-2xl font-bold mb-3 text-primary text-right">{cat.label}</h3>
            <div className="divide-y divide-border">
              {items.map((item) => (
                <MenuCard key={item.id} item={item} onAdd={onAddItem} />
              ))}
            </div>
          </div>
        );
      })}

      <div className="mt-10 bg-card border border-primary/30 rounded-xl p-6 text-center">
        <h3 className="text-xl font-bold text-primary mb-2">🍽️ שדרוג לארוחה עסקית</h3>
        <p className="text-muted-foreground">המבורגר + צ׳יפס + שתייה — רק <span className="text-primary font-bold">+₪23</span></p>
      </div>
    </section>
  );
};

export default MenuSection;
