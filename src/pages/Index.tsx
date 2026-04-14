import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { ShoppingBag, Phone } from "lucide-react";
import HeroSection from "@/components/HeroSection";
import MenuSection from "@/components/MenuSection";
import CartDrawer, { CartItem } from "@/components/CartDrawer";
import CheckoutForm from "@/components/CheckoutForm";
import ItemCustomizer from "@/components/ItemCustomizer";
import { MenuItem, toppings } from "@/data/menu";

const Index = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customizerItem, setCustomizerItem] = useState<MenuItem | null>(null);

  const handleAddItem = useCallback((item: MenuItem) => {
    if (item.category === "burger") {
      setCustomizerItem(item);
    } else {
      setCart((prev) => {
        const existing = prev.find((c) => c.id === item.id);
        if (existing) {
          return prev.map((c) => (c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
        }
        return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1, toppings: [], removals: [], withMeal: false }];
      });
      setCartOpen(true);
    }
  }, []);

  const handleCustomizerConfirm = useCallback(
    (item: MenuItem, quantity: number, selectedToppings: string[], selectedRemovals: string[], withMeal: boolean, mealSideId?: string) => {
      const cartItemId = `${item.id}-${Date.now()}`;
      setCart((prev) => [
        ...prev,
        {
          id: cartItemId,
          name: item.name,
          price: item.price,
          quantity,
          toppings: selectedToppings,
          removals: selectedRemovals,
          withMeal,
          mealSideId,
        },
      ]);
      setCustomizerItem(null);
      setCartOpen(true);
    },
    []
  );

  const updateQuantity = useCallback((id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  }, []);

  const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);

  const getTotal = () => {
    return cart.reduce((sum, item) => {
      const toppingsCost = item.toppings.reduce((s, tId) => {
        const t = toppings.find((tp) => tp.id === tId);
        return s + (t?.price || 0);
      }, 0);
      const mealCost = item.withMeal ? 23 : 0;
      return sum + (item.price + toppingsCost + mealCost) * item.quantity;
    }, 0);
  };

  const scrollToMenu = () => {
    document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      {totalItems > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 left-6 z-30 bg-primary text-primary-foreground w-14 h-14 rounded-full flex items-center justify-center shadow-xl shadow-primary/30 hover:scale-105 transition-transform"
        >
          <ShoppingBag size={22} />
          <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
            {totalItems}
          </span>
        </button>
      )}

      <HeroSection onOrderClick={scrollToMenu} />
      <MenuSection onAddItem={handleAddItem} />

      <ItemCustomizer
        item={customizerItem}
        onClose={() => setCustomizerItem(null)}
        onConfirm={handleCustomizerConfirm}
      />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        onUpdateQuantity={updateQuantity}
        onCheckout={() => {
          setCartOpen(false);
          setCheckoutOpen(true);
        }}
      />

      <AnimatePresence>
        {checkoutOpen && (
          <CheckoutForm
            items={cart}
            total={getTotal()}
            onClose={() => setCheckoutOpen(false)}
            onSuccess={() => {
              setCheckoutOpen(false);
              setCart([]);
            }}
          />
        )}
      </AnimatePresence>

      <footer className="py-8 text-center border-t border-border space-y-2">
        <p className="text-foreground font-bold">הַבַּקְּתָה — המבורגר של מושבניקים 🐄</p>
        <p className="text-muted-foreground text-sm">כשר בהשגחת הרבנות · בשר שדות נגב</p>
        <a
          href="tel:058-4633-555"
          className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
        >
          <Phone size={14} />
          058-4633-555
        </a>
      </footer>
    </div>
  );
};

export default Index;
