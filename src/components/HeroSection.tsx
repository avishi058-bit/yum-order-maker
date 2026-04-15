import { motion } from "framer-motion";
import heroBurger from "@/assets/hero-burger.jpg";
import logo from "@/assets/logo.png";

interface HeroSectionProps {
  onDineInChoice?: (dineIn: boolean) => void;
  dineIn: boolean | null;
}

const HeroSection = ({ onDineInChoice, dineIn }: HeroSectionProps) => {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Kosher badge */}
      <div className="absolute top-4 right-4 z-20 bg-card/80 backdrop-blur-sm border border-primary/50 rounded-xl px-3 py-2 shadow-lg">
        <span className="text-xs font-bold text-foreground">כשר</span>
      </div>

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
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, type: "spring", stiffness: 200 }}
          className="w-36 h-36 mx-auto mb-6"
        >
          <img
            src={logo}
            alt="הבקתה - לוגו"
            className="w-full h-full object-contain drop-shadow-2xl"
          />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-5xl md:text-7xl font-black mb-2 tracking-tight"
        >
          הַבִּקְתָּה
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="text-xl md:text-2xl text-primary font-bold mb-2"
        >
          המבורגר של מושבניקים
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="text-lg text-muted-foreground mb-8 max-w-md mx-auto"
        >
          כשר בהשגחת הרבנות המקומית-שדות נגב
        </motion.p>

        {onDineInChoice ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="flex flex-col items-center gap-4"
          >
            
            <div className="bg-secondary/80 backdrop-blur-sm rounded-full p-1.5 flex gap-1">
              <button
                onClick={() => onDineInChoice(true)}
                className={`px-8 py-3.5 rounded-full text-base font-bold transition-all ${
                  dineIn === true ? "bg-primary text-primary-foreground shadow-lg scale-105" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                🪑 לשבת
              </button>
              <button
                onClick={() => onDineInChoice(false)}
                className={`px-8 py-3.5 rounded-full text-base font-bold transition-all ${
                  dineIn === false ? "bg-primary text-primary-foreground shadow-lg scale-105" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                🥡 לקחת
              </button>
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
