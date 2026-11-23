import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { heroAnimations } from "@/config/uiConfig";
import heroBurger from "@/assets/hero-burger.webp";
import logo from "@/assets/logo.webp";
import { RUNTIME_FLAGS } from "@/config/runtimeFlags";
import kosherCertificate from "@/assets/kosher-certificate.webp";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Phone } from "lucide-react";
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

const HeroSection = ({ onDineInChoice, onDeliveryChoice, onBuildOrderAhead, showGroupsLink = false, showDelivery, dineIn, soldierFundEnabled = true, onSoldierContinueOrder, onSoldierDonateOnly }: HeroSectionProps) => {
  // Compact home (runtime flag): short hero so the menu starts right below it.
  const compact = RUNTIME_FLAGS.COMPACT_HOME;
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
  return (
    <section className={`relative flex items-center justify-center overflow-hidden ${compact ? "pt-16 pb-6" : "min-h-[80vh]"}`}>
      {/* Kosher badge */}
      <button
        type="button"
        onClick={() => setShowKosher(true)}
        className="absolute top-4 right-4 z-20 bg-card/80 backdrop-blur-sm border border-primary/50 rounded-xl px-3 py-2 shadow-lg hover:bg-card transition-colors"
      >
        <span className="text-xs font-bold text-foreground">כשר </span>
        <span className="text-[9px] text-muted-foreground">(לצפייה)</span>
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
        <img
          src={heroBurger}
          alt="המבורגר הבקתה"
          width={1920}
          height={1080}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
      </div>
      <div className="relative z-10 text-center px-4">
        <motion.div
          {...heroAnimations.logo}
          className={compact ? "w-24 h-24 mx-auto mb-3" : "w-36 h-36 mx-auto mb-6"}
        >
          <img
            src={logo}
            alt="הבקתה - לוגו"
            className="w-full h-full object-contain drop-shadow-2xl"
          />
        </motion.div>
        <motion.h1
          {...heroAnimations.title}
          className={compact ? "text-4xl md:text-6xl font-black mb-1 tracking-tight" : "text-5xl md:text-7xl font-black mb-2 tracking-tight"}
        >
          הַבִּקְתָּה
        </motion.h1>
        <motion.p
          {...heroAnimations.subtitle}
          className={compact ? "text-lg md:text-xl text-primary font-bold mb-1" : "text-xl md:text-2xl text-primary font-bold mb-2"}
        >
          המבורגר של מושבניקים
        </motion.p>
        <motion.p
          {...heroAnimations.description}
          className={compact ? "text-sm text-muted-foreground mb-5 max-w-md mx-auto" : "text-lg text-muted-foreground mb-8 max-w-md mx-auto"}
        >
          כשר בהשגחת הרבנות המקומית-שדות נגב
        </motion.p>

        {onDineInChoice ? (
          <motion.div
            {...heroAnimations.cta}
            className="flex flex-col items-center gap-4"
          >
            {!compact && <motion.p
              className="text-lg md:text-xl font-bold text-foreground"
              animate={dance ? { rotate: [0, -3, 3, -3, 3, 0], scale: [1, 1.03, 1.03, 1.03, 1.03, 1] } : { rotate: 0, scale: 1 }}
              transition={dance ? { duration: 1.4, repeat: Infinity, repeatDelay: 1.2, ease: "easeInOut" } : { duration: 0.2 }}
            >
              בחר כדי להתחיל בהזמנה👇🏽
            </motion.p>}
            <div className="w-full max-w-md flex flex-col gap-3">
              {compact ? (
                <div className="flex w-full gap-3 select-none">
                  {([[true, "לשבת"], [false, "לקחת"]] as const).map(([v, label]) => (
                    <button key={label} type="button" onClick={() => onDineInChoice(v)} aria-pressed={dineIn === v}
                      className={`flex-1 py-4 rounded-2xl font-black text-xl transition-colors shadow-lg ${dineIn === v ? "bg-primary text-primary-foreground" : "bg-card/90 backdrop-blur-sm text-foreground border border-border"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
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
              )}

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
          <Link
            to="/groups"
            className="mt-4 inline-block text-base font-bold text-primary underline underline-offset-4 hover:brightness-110"
          >
            מגיעים בקבוצה? לחצו כאן
          </Link>
        )}

        {/* "הזמן חייל/ת" - prominent entry buttons (hidden when switched off in the kitchen) */}
        {soldierFundEnabled && <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className={`${compact ? "mt-4" : "mt-6"} w-full max-w-md mx-auto flex flex-col items-center gap-2`}
        >
          <button
            type="button"
            onClick={() => setFundOpen(true)}
            className={`w-full rounded-[2rem] font-black bg-primary text-primary-foreground shadow-2xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 ${compact ? "h-12 text-lg" : "h-16 text-2xl"}`}
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
