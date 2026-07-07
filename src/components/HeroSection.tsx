import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { heroAnimations } from "@/config/uiConfig";
import heroBurger from "@/assets/hero-burger.webp";
import logo from "@/assets/logo.png";
import kosherCertificate from "@/assets/kosher-certificate.jpeg";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface HeroSectionProps {
  onDineInChoice?: (dineIn: boolean) => void;
  onDeliveryChoice?: () => void;
  showDelivery?: boolean;
  dineIn: boolean | null;
}

const HeroSection = ({ onDineInChoice, onDeliveryChoice, showDelivery, dineIn }: HeroSectionProps) => {
  const [showKosher, setShowKosher] = useState(false);
  const [dance, setDance] = useState(false);
  useEffect(() => {
    if (dineIn !== null) {
      setDance(false);
      return;
    }
    const t = window.setTimeout(() => setDance(true), 5000);
    return () => window.clearTimeout(t);
  }, [dineIn]);
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
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
          className="w-36 h-36 mx-auto mb-6"
        >
          <img
            src={logo}
            alt="הבקתה - לוגו"
            className="w-full h-full object-contain drop-shadow-2xl"
          />
        </motion.div>
        <motion.h1
          {...heroAnimations.title}
          className="text-5xl md:text-7xl font-black mb-2 tracking-tight"
        >
          הַבִּקְתָּה
        </motion.h1>
        <motion.p
          {...heroAnimations.subtitle}
          className="text-xl md:text-2xl text-primary font-bold mb-2"
        >
          המבורגר של מושבניקים
        </motion.p>
        <motion.p
          {...heroAnimations.description}
          className="text-lg text-muted-foreground mb-8 max-w-md mx-auto"
        >
          כשר בהשגחת הרבנות המקומית-שדות נגב
        </motion.p>

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
            <div className="flex gap-3 flex-wrap justify-center max-w-md">
              <button
                onClick={() => onDineInChoice(true)}
                className={`flex flex-col items-center justify-center gap-1 w-24 h-24 rounded-2xl font-bold transition-all border-2 ${
                  dineIn === true
                    ? "bg-primary text-primary-foreground border-primary shadow-xl scale-105"
                    : "bg-secondary/80 backdrop-blur-sm text-foreground border-border/40 hover:border-primary/60 hover:scale-105"
                }`}
              >
                <span className="text-3xl">🪑</span>
                <span className="text-sm">לשבת</span>
              </button>
              <button
                onClick={() => onDineInChoice(false)}
                className={`flex flex-col items-center justify-center gap-1 w-24 h-24 rounded-2xl font-bold transition-all border-2 ${
                  dineIn === false
                    ? "bg-primary text-primary-foreground border-primary shadow-xl scale-105"
                    : "bg-secondary/80 backdrop-blur-sm text-foreground border-border/40 hover:border-primary/60 hover:scale-105"
                }`}
              >
                <span className="text-3xl">🥡</span>
                <span className="text-sm">לקחת</span>
              </button>
              {showDelivery && onDeliveryChoice && (
                <button
                  onClick={() => onDeliveryChoice()}
                  className="flex flex-col items-center justify-center gap-1 w-24 h-24 rounded-2xl font-bold transition-all border-2 bg-secondary/80 backdrop-blur-sm text-foreground border-border/40 hover:border-primary/60 hover:scale-105"
                >
                  <span className="text-3xl">🛵</span>
                  <span className="text-sm">משלוח</span>
                </button>
              )}
            </div>
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
      </div>
    </section>
  );
};

export default HeroSection;
