import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { heroAnimations } from "@/config/uiConfig";
import heroBurger from "@/assets/hero-burger.webp";
import logo from "@/assets/logo.webp";
import kosherCertificate from "@/assets/kosher-certificate.webp";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Phone, Users, Bus } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import SoldierFundHowItWorks from "@/components/SoldierFundHowItWorks";

const FUND_TERMS_KEY = "soldier-fund-terms-approved-v1";

interface HeroSectionProps {
  onDineInChoice?: (dineIn: boolean) => void;
  onDeliveryChoice?: () => void;
  /** Closed hours: main button opens the menu to build an order ahead. */
  onBuildOrderAhead?: () => void;
  /** Small link to the groups page under the main buttons. */
  showGroupsLink?: boolean;
  showDelivery?: boolean;
  dineIn: boolean | null;
  /** Kitchen on/off switch for "הזמן חייל/ת". */
  soldierFundEnabled?: boolean;
  onSoldierContinueOrder?: (amount: number, termsAt: string) => void;
  onSoldierDonateOnly?: (amount: number, termsAt: string) => void;
}

/** Tile link under the hero buttons (groups page, group order), two side by side. */
const HeroTileLink = ({ to, icon, title, note }: { to: string; icon: ReactNode; title: string; note: string }) => (
  <Link
    to={to}
    dir="rtl"
    className="group flex flex-col items-center gap-2 rounded-[1.5rem] border-2 border-primary/50 bg-gradient-to-b from-primary/20 via-primary/10 to-transparent px-2 py-4 text-center shadow-[0_8px_24px_hsl(32_95%_52%/0.18)] backdrop-blur-sm transition-all hover:border-primary hover:from-primary/30 active:scale-[0.98]"
  >
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-105">
      {icon}
    </span>
    <span className="text-base font-black leading-tight text-foreground">{title}</span>
    <span className="text-xs leading-snug text-muted-foreground">{note}</span>
  </Link>
);

const HeroSection = ({ onDineInChoice, onDeliveryChoice, onBuildOrderAhead, showGroupsLink = false, showDelivery, dineIn, soldierFundEnabled = true, onSoldierContinueOrder, onSoldierDonateOnly }: HeroSectionProps) => {
  const [showKosher, setShowKosher] = useState(false);
  const [dance, setDance] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);
  const [fundApproved, setFundApproved] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(FUND_TERMS_KEY) === "1"
  );
  useEffect(() => {
    if (dineIn !== null) {
      setDance(false);
      return;
    }
    const t = window.setTimeout(() => setDance(true), 5000);
    return () => window.clearTimeout(t);
  }, [dineIn]);
  const heroRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  // A light spring smooths the raw scroll steps (wheel ticks, touch momentum) so the photo glides instead of jumping.
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.35, restDelta: 0.0005 });
  const photoY = useTransform(smoothProgress, [0, 1], ["0%", "18%"]);
  const photoScale = useTransform(smoothProgress, [0, 1], [1.08, 1]);

  return (
    <section ref={heroRef} className="relative min-h-[80svh] flex items-center justify-center overflow-hidden">
      {/* Kosher badge */}
      <button
        type="button"
        onClick={() => setShowKosher(true)}
        aria-label="כשר - רבנות שדות נגב. לצפייה בתעודת הכשרות"
        className="absolute top-4 right-4 z-20 flex flex-col items-center rounded-2xl bg-primary px-3 py-1.5 leading-none text-primary-foreground shadow-[0_4px_14px_hsl(32_95%_52%/0.4)] transition-[filter,transform] hover:brightness-110 active:scale-[0.97]"
      >
        <span className="text-sm font-black">כשר</span>
        <span className="mt-0.5 text-[10px] font-bold opacity-80">לצפייה בתעודה</span>
      </button>


      <Dialog open={showKosher} onOpenChange={setShowKosher}>
        <DialogContent className="max-w-lg p-2">
          <DialogTitle className="sr-only">תעודת כשרות</DialogTitle>
          <DialogDescription className="sr-only">תעודת כשרות של הבקתה</DialogDescription>
          <img
            src={kosherCertificate}
            alt="תעודת כשרות הבקתה"
            className="w-full h-auto rounded-md"
          />
          <a
            href="tel:+972505880510"
            className="mt-3 flex items-center justify-center gap-2 w-full rounded-xl bg-primary/10 text-primary font-bold py-3 hover:bg-primary/20 transition-colors"
          >
            <Phone className="w-5 h-5" />
            <span>להתקשר למשגיח כשרות - מורדכי: 050-5880510</span>
          </a>
        </DialogContent>
      </Dialog>

      <div className="absolute inset-0">
        {/* Gentle parallax: the photo drifts down and eases out of its zoom as the page scrolls. */}
        <motion.img
          src={heroBurger}
          alt="המבורגר הבקתה"
          width={1920}
          height={1080}
          style={reduceMotion ? undefined : { y: photoY, scale: photoScale }}
          className="w-full h-full object-cover will-change-transform"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
      </div>
      <div className="relative z-10 text-center px-4">
        <motion.div
          {...heroAnimations.logo}
          className="w-56 h-56 md:w-64 md:h-64 mx-auto mb-8"
        >
          <img
            src={logo}
            alt="הבקתה - לוגו"
            className="w-full h-full object-contain drop-shadow-2xl"
          />
        </motion.div>
        {/* The logo already shows the name and tagline; the heading stays for screen readers and search engines. */}
        <h1 className="sr-only">המבורגר הבקתה - המבורגר של מושבניקים, כשר בהשגחת רבנות שדות נגב</h1>

        {onDineInChoice ? (
          <motion.div
            {...heroAnimations.cta}
            className="flex flex-col items-center gap-4"
          >
            <motion.p
              className="text-lg md:text-xl font-bold text-foreground"
              animate={dance ? { rotate: [0, -3, 3, -3, 3, 0], scale: [1, 1.03, 1.03, 1.03, 1.03, 1] } : { rotate: 0, scale: 1 }}
              transition={dance ? { duration: 1.4, repeat: Infinity, repeatDelay: 1.2, ease: "easeInOut" } : { duration: 0.2 }}
            >
              בחר כדי להתחיל בהזמנה👇🏽
            </motion.p>
            <div className="w-full max-w-md flex flex-col gap-3">
              <div className="relative flex w-full p-1.5 bg-muted rounded-2xl shadow-2xl select-none">
                <button
                  onClick={() => onDineInChoice(true)}
                  className={`relative z-10 flex-1 py-5 text-center font-black text-2xl transition-colors duration-200 ${
                    dineIn === true ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {dineIn === true && (
                    <motion.div
                      layoutId="dine-mode-active"
                      className="absolute inset-y-1.5 inset-x-1.5 bg-card rounded-xl shadow-sm border border-border/50 -z-10"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  לשבת
                </button>
                <button
                  onClick={() => onDineInChoice(false)}
                  className={`relative z-10 flex-1 py-5 text-center font-black text-2xl transition-colors duration-200 ${
                    dineIn === false ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {dineIn === false && (
                    <motion.div
                      layoutId="dine-mode-active"
                      className="absolute inset-y-1.5 inset-x-1.5 bg-card rounded-xl shadow-sm border border-border/50 -z-10"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  לקחת
                </button>
              </div>

              {showDelivery && onDeliveryChoice && (
                <button
                  onClick={() => onDeliveryChoice()}
                  className="w-full flex items-center justify-center gap-3 h-16 rounded-[2rem] font-black text-xl transition-all border-2 bg-secondary/80 backdrop-blur-sm text-foreground border-border/40 hover:border-primary/60"
                >
                  <span className="text-3xl">🛵</span>
                  <span>משלוח</span>
                </button>
              )}
            </div>

          </motion.div>
        ) : onBuildOrderAhead ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="w-full max-w-md mx-auto flex flex-col items-center gap-2"
          >
            <button
              type="button"
              onClick={onBuildOrderAhead}
              className="w-full h-16 rounded-[2rem] font-black text-xl bg-primary text-primary-foreground shadow-2xl hover:brightness-110 active:scale-[0.98] transition-all"
            >
              הרכיבו הזמנה מראש
            </button>
            <p className="text-sm text-muted-foreground">סגור כרגע להזמנות - שומרים עכשיו ושולחים כשנפתחים</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="bg-destructive/20 text-destructive font-bold text-lg px-10 py-4 rounded-full"
          >
            סגור להזמנות כרגע
          </motion.div>
        )}

        {showGroupsLink && (
          <div dir="rtl" className="mt-4 w-full max-w-md mx-auto grid grid-cols-2 gap-3">
            <HeroTileLink
              to="/groups"
              icon={<Bus size={24} aria-hidden />}
              title="קבוצות וסיורים"
              note="שולחן שוק בעוטף"
            />
            <HeroTileLink
              to="/group"
              icon={<Users size={24} aria-hidden />}
              title="הזמנה עם חברים"
              note="כל אחד משלם על עצמו"
            />
          </div>
        )}

        {/* "הזמן חייל/ת" - prominent entry buttons (hidden when switched off in the kitchen) */}
        {soldierFundEnabled && <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-6 w-full max-w-md mx-auto flex flex-col items-center gap-2"
        >
          <button
            type="button"
            onClick={() => setFundOpen(true)}
            className="w-full h-16 rounded-[2rem] font-black text-2xl bg-primary text-primary-foreground shadow-2xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            <span className="text-3xl">🫡</span>
            <span>הזמן חייל/ת</span>
          </button>
          <button
            type="button"
            onClick={() => setFundOpen(true)}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
          >
            איך זה עובד?
          </button>
        </motion.div>}
      </div>

      <SoldierFundHowItWorks
        open={fundOpen && soldierFundEnabled}
        onOpenChange={setFundOpen}
        approved={fundApproved}
        onApprove={(v) => {
          setFundApproved(v);
          try { v ? window.localStorage.setItem(FUND_TERMS_KEY, "1") : window.localStorage.removeItem(FUND_TERMS_KEY); } catch { /* ignore */ }
        }}
        donate={onSoldierDonateOnly ? {
          canOrder: !!onSoldierContinueOrder,
          onContinueOrder: (amount) => { setFundOpen(false); onSoldierContinueOrder?.(amount, new Date().toISOString()); },
          onDonateOnly: (amount) => { setFundOpen(false); onSoldierDonateOnly(amount, new Date().toISOString()); },
        } : undefined}
      />
    </section>
  );
};

export default HeroSection;
