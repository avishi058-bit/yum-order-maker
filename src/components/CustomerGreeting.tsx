import { motion, AnimatePresence } from "framer-motion";
import { LogOut, User, Package, Pencil, Check, X, Loader2 } from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

interface CustomerGreetingProps {
  onOpenHistory?: () => void;
}

const CustomerGreeting = ({ onOpenHistory }: CustomerGreetingProps) => {
  const { customer, isLoggedIn, logout, updateName } = useCustomerAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isLoggedIn || !customer) return null;

  const firstName = customer.name.split(" ")[0];

  const startEdit = () => {
    setNameInput(customer.name);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setNameInput("");
  };

  const saveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      toast({ title: "שם לא יכול להיות ריק", variant: "destructive" });
      return;
    }
    if (trimmed === customer.name) {
      cancelEdit();
      return;
    }
    setSaving(true);
    try {
      await updateName(trimmed);
      toast({ title: "השם עודכן ✅" });
      setEditing(false);
    } catch (e: any) {
      toast({ title: e?.message || "שגיאה בעדכון השם", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative" dir="rtl">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          <User size={16} />
          <span className="text-sm font-semibold">שלום {firstName} 😊</span>
        </button>

        {onOpenHistory && (
          <button
            onClick={() => { onOpenHistory(); setShowMenu(false); cancelEdit(); }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors border border-border shadow-sm"
            aria-label="ההזמנות שלי"
          >
            <Package size={16} />
            <span className="text-sm font-bold">ההזמנות שלי</span>
          </button>
        )}
      </div>


      <AnimatePresence>
        {showMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => { setShowMenu(false); cancelEdit(); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -5 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden min-w-[240px]"
            >
              <div className="px-4 py-3 border-b border-border">
                {editing ? (
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-muted-foreground">השם שלך</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveName();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        autoFocus
                        disabled={saving}
                        className="flex-1 min-w-0 bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <button
                        onClick={saveName}
                        disabled={saving}
                        className="p-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                        aria-label="שמור"
                      >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        className="p-1.5 rounded-md bg-muted text-muted-foreground"
                        aria-label="ביטול"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">{customer.phone}</p>
                      {customer.isReturning && (
                        <p className="text-xs text-muted-foreground mt-1">
                          כניסה #{customer.loginCount}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={startEdit}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                      aria-label="ערוך שם"
                      title="ערוך שם"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                )}
              </div>
              {onOpenHistory && (
                <button
                  onClick={() => { onOpenHistory(); setShowMenu(false); cancelEdit(); }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors border-b border-border"
                >
                  <Package size={14} />
                  ההזמנות שלי
                </button>
              )}
              <button
                onClick={() => { logout(); setShowMenu(false); cancelEdit(); }}
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
