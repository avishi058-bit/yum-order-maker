import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import HeroSection from "@/components/HeroSection";
import MenuSection from "@/components/MenuSection";
import CartDrawer, { CartItem } from "@/components/CartDrawer";
import CheckoutForm from "@/components/CheckoutForm";
import { MenuItem, toppings } from "@/data/menu";

const Index = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const addItem = useCallback((item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) => (c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1, toppings: [] }];
    });
    setCartOpen(true);
  }, []);

  const updateQuantity = useCallback((id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  }, []);

  const toggleTopping = useCallback((itemId: string, toppingId: string) => {
    setCart((prev) =>
      prev.map((c) =>
        c.id === itemId
          ? {
              ...c,
              toppings: c.toppings.includes(toppingId)
                ? c.toppings.filter((t) => t !== toppingId)
                : [...c.toppings, toppingId],
            }
          : c
      )
    );
  }, []);

  const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);

  const getTotal = () => {
    return cart.reduce((sum, item) => {
      const toppingsCost = item.toppings.reduce((s, tId) => {
        const t = toppings.find((tp) => tp.id === tId);
        return s + (t?.price || 0);
      }, 0);
      return sum + (item.price + toppingsCost) * item.quantity;
    }, 0);
  };

  const scrollToMenu = () => {
    document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Floating cart button */}
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
      <MenuSection onAddItem={addItem} />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        onUpdateQuantity={updateQuantity}
        onToggleTopping={toggleTopping}
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

      <footer className="py-8 text-center text-muted-foreground text-sm border-t border-border">
        © 2026 בורגר מושלם. כל הזכויות שמורות.
      </footer>
    </div>
  );
};

export default Index;
