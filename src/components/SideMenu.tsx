import { useState } from "react";
import {
  Menu,
  LogIn,
  LogOut,
  Clock,
  MapPin,
  UtensilsCrossed,
  Wheat,
  AlertTriangle,
  ChevronLeft,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useBusinessHours, DAY_NAMES_HE } from "@/hooks/useBusinessHours";

interface SideMenuProps {
  onLoginClick: () => void;
}

type ModalKey = null | "hours" | "address" | "menu" | "gluten" | "allergens";

const SideMenu = ({ onLoginClick }: SideMenuProps) => {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<ModalKey>(null);
  const { isLoggedIn, customer, logout } = useCustomerAuth();
  const { hours } = useBusinessHours();

  const closeAll = () => {
    setOpen(false);
    setModal(null);
  };

  const handleAuthClick = () => {
    setOpen(false);
    if (isLoggedIn) {
      logout();
    } else {
      onLoginClick();
    }
  };

  const openModal = (key: Exclude<ModalKey, null>) => {
    setOpen(false);
    // small delay so the sheet finishes its exit before the dialog opens
    setTimeout(() => setModal(key), 150);
  };

  const scrollToMenu = () => {
    setOpen(false);
    setTimeout(() => {
      document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" });
    }, 200);
  };

  const items: { label: string; icon: React.ElementType; onClick: () => void }[] = [
    {
      label: isLoggedIn ? `התנתק${customer?.name ? ` (${customer.name})` : ""}` : "התחבר לאתר",
      icon: isLoggedIn ? LogOut : LogIn,
      onClick: handleAuthClick,
    },
    { label: "שעות פעילות", icon: Clock, onClick: () => openModal("hours") },
    { label: "כתובת", icon: MapPin, onClick: () => openModal("address") },
    { label: "תפריט", icon: UtensilsCrossed, onClick: scrollToMenu },
    { label: "ללא גלוטן", icon: Wheat, onClick: () => openModal("gluten") },
    { label: "מידע אלרגנים", icon: AlertTriangle, onClick: () => openModal("allergens") },
  ];

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="פתח תפריט"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
          >
            <Menu size={22} />
          </button>
        </SheetTrigger>

        <SheetContent side="right" className="w-[280px] sm:w-[320px] p-0" dir="rtl">
          <SheetHeader className="border-b border-border px-5 py-4 text-right">
            <SheetTitle className="text-lg font-black text-primary">הבקתה 🐄</SheetTitle>
            {isLoggedIn && customer?.name && (
              <p className="text-xs text-muted-foreground">שלום, {customer.name}</p>
            )}
          </SheetHeader>

          <nav className="flex flex-col py-2">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <SheetClose asChild key={item.label}>
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="flex items-center justify-between gap-3 px-5 py-3.5 text-right transition-colors hover:bg-accent/60 active:bg-accent"
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} className="text-primary" />
                      <span className="text-sm font-semibold text-foreground">{item.label}</span>
                    </div>
                    <ChevronLeft size={16} className="text-muted-foreground" />
                  </button>
                </SheetClose>
              );
            })}
          </nav>

          <div className="absolute bottom-4 left-0 right-0 px-5 text-center text-xs text-muted-foreground">
            <p>058-4633-555</p>
          </div>
        </SheetContent>
      </Sheet>

      {/* Info modals */}
      <Dialog open={modal !== null} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          {modal === "hours" && (
            <>
              <DialogHeader>
                <DialogTitle>שעות פעילות</DialogTitle>
              </DialogHeader>
              <ul className="divide-y divide-border">
                {DAY_NAMES_HE.map((name, idx) => {
                  const day = hours[String(idx)];
                  const isToday = new Date().getDay() === idx;
                  return (
                    <li
                      key={idx}
                      className={`flex items-center justify-between py-2.5 text-sm ${
                        isToday ? "font-bold text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <span>
                        {name}
                        {isToday && <span className="mr-2 text-xs text-primary">(היום)</span>}
                      </span>
                      <span>{day.open ? `${day.from} – ${day.to}` : "סגור"}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {modal === "address" && (
            <>
              <DialogHeader>
                <DialogTitle>כתובת</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="space-y-1">
                  <p className="font-bold text-foreground">📍 דרך ערבי נחל 23, תושיה</p>
                  <p className="text-muted-foreground">בואו לטעום את הסמאש של מושבניקים, ישר מהבקתה.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <a
                    href="https://waze.com/ul?q=דרך%20ערבי%20נחל%2023%20תושיה"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    <MapPin size={14} />
                    נווט עם Waze
                  </a>
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=דרך+ערבי+נחל+23+תושיה"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-accent"
                  >
                    <MapPin size={14} />
                    Google Maps
                  </a>
                </div>
              </div>
            </>
          )}

          {modal === "gluten" && (
            <>
              <DialogHeader>
                <DialogTitle>ללא גלוטן</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  ניתן להזמין כל המבורגר <strong className="text-foreground">ללא לחמנייה</strong> או
                  להחליף ללחמנייה ללא גלוטן (בכפוף לזמינות).
                </p>
                <p>
                  המטבח שלנו אינו ייעודי לנטולי גלוטן, ולכן ייתכן זיהום צולב. אנא יידעו את הצוות
                  לפני ההזמנה אם יש רגישות חמורה.
                </p>
              </div>
            </>
          )}

          {modal === "allergens" && (
            <>
              <DialogHeader>
                <DialogTitle>מידע אלרגנים</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>המנות שלנו עשויות להכיל את האלרגנים הבאים:</p>
                <ul className="grid grid-cols-2 gap-2 text-foreground">
                  <li>• גלוטן (חיטה)</li>
                  <li>• חלב</li>
                  <li>• ביצים</li>
                  <li>• שומשום</li>
                  <li>• סויה</li>
                  <li>• חרדל</li>
                </ul>
                <p>
                  לפרטים מדויקים על מנה ספציפית — אנא פנו לצוות לפני הזמנה. אנו עושים כל מאמץ
                  למנוע זיהום צולב, אך לא ניתן להבטיח סביבה נטולת אלרגנים מוחלטת.
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SideMenu;
