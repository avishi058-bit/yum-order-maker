import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { menuItems, MenuItem } from "@/data/menu";
import { menuImages } from "@/data/menuImages";

const categories = [
  { key: "burger" as const, label: "🍔 ההמבורגרים שלנו" },
  { key: "side" as const, label: "🍟 צ׳יפס אחי!" },
  { key: "drink" as const, label: "🍺 מה את שותה?" },
  { key: "deal" as const, label: "🤝 עשינו עסק" },
];

const MenuCard = ({ item, onAdd }: { item: MenuItem; onAdd: (item: MenuItem) => void }) => {
  const image = menuImages[item.id];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-card border-b border-border py-4 px-2 flex items-center gap-4 group"
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
            whileTap={{ scale: 0.9 }}
            onClick={() => onAdd(item)}
            className="bg-primary text-primary-foreground w-9 h-9 rounded-full flex items-center justify-center shadow-md shadow-primary/20 opacity-80 group-hover:opacity-100 transition-opacity"
          >
            <Plus size={18} />
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
