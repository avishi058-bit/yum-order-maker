import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { menuItems, MenuItem } from "@/data/menu";

const categories = [
  { key: "burger" as const, label: "🍔 המבורגרים" },
  { key: "side" as const, label: "🍟 תוספות" },
  { key: "drink" as const, label: "🥤 שתייה" },
];

const MenuCard = ({ item, onAdd }: { item: MenuItem; onAdd: (item: MenuItem) => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    whileHover={{ y: -4 }}
    className="bg-card rounded-xl p-5 border border-border hover:border-primary/40 transition-colors group"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">{item.image}</span>
          <h3 className="text-lg font-bold">{item.name}</h3>
        </div>
        <p className="text-muted-foreground text-sm mb-3">{item.description}</p>
        <span className="text-primary font-bold text-lg">₪{item.price}</span>
      </div>
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => onAdd(item)}
        className="mt-2 bg-primary text-primary-foreground w-10 h-10 rounded-full flex items-center justify-center shadow-md shadow-primary/20 opacity-80 group-hover:opacity-100 transition-opacity"
      >
        <Plus size={20} />
      </motion.button>
    </div>
  </motion.div>
);

const MenuSection = ({ onAddItem }: { onAddItem: (item: MenuItem) => void }) => {
  return (
    <section id="menu" className="py-16 px-4 max-w-5xl mx-auto">
      <h2 className="text-4xl font-black text-center mb-12">התפריט שלנו</h2>
      {categories.map((cat) => {
        const items = menuItems.filter((i) => i.category === cat.key);
        return (
          <div key={cat.key} className="mb-10">
            <h3 className="text-2xl font-bold mb-5 text-primary">{cat.label}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((item) => (
                <MenuCard key={item.id} item={item} onAdd={onAddItem} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
};

export default MenuSection;
