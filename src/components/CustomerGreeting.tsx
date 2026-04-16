import { motion, AnimatePresence } from "framer-motion";
import { LogOut, User } from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useState } from "react";

const CustomerGreeting = () => {
  const { customer, isLoggedIn, logout } = useCustomerAuth();
  const [showMenu, setShowMenu] = useState(false);

  if (!isLoggedIn || !customer) return null;

  const firstName = customer.name.split(" ")[0];

  return (
    <div className="relative" dir="rtl">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      >
        <User size={16} />
        <span className="text-sm font-semibold">שלום {firstName} 😊</span>
      </button>

      <AnimatePresence>
        {showMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -5 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden min-w-[180px]"
            >
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-bold text-foreground">{customer.name}</p>
                <p className="text-xs text-muted-foreground">{customer.phone}</p>
                {customer.isReturning && (
                  <p className="text-xs text-muted-foreground mt-1">
                    כניסה #{customer.loginCount}
                  </p>
                )}
              </div>
              <button
                onClick={() => { logout(); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut size={14} />
                התנתקות
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomerGreeting;
