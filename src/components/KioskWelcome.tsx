import { memo } from "react";
import { motion } from "framer-motion";
import logo from "@/assets/logo.png";
import heroBurger from "@/assets/hero-burger.webp";

/**
 * Welcome screen for the kiosk. Wrapped in React.memo so background re-renders
 * of the parent <Kiosk> page (e.g. realtime updates from menu_availability or
 * site_settings) do NOT re-render this component or restart its animations.
 * The screen must stay perfectly stable until the user touches it.
 */
const KioskWelcomeImpl = ({ onStart, imagesReady = true }: { onStart: (dineIn: boolean) => void; imagesReady?: boolean }) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden" dir="rtl">
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src={heroBurger}
          alt="המבורגר הבקתה"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, type: "spring", stiffness: 150 }}
          className="w-48 h-48 mb-8"
        >
          <img src={logo} alt="הבקתה לוגו" className="w-full h-full object-contain drop-shadow-2xl" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="text-6xl md:text-8xl font-black mb-4 tracking-tight text-foreground"
        >
          ברוכים הבאים
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="text-3xl md:text-4xl text-primary font-bold mb-2"
        >
          להמבורגר הַבִּקְתָּה 🐄
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.65 }}
          className="text-xl text-muted-foreground mb-12"
        >
          המבורגר של מושבניקים · כשר בהשגחת הרבנות
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.75 }}
          className="text-2xl md:text-3xl font-bold text-foreground mb-6"
        >
          {imagesReady ? "איך תרצו את ההזמנה?" : "טוען תפריט… ⏳"}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.85 }}
          className="flex flex-row-reverse items-center gap-6"
        >
          {[
            { label: "לשבת", dineIn: true },
            { label: "לקחת", dineIn: false },
          ].map((opt, i) => (
            <motion.button
              key={opt.label}
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 1.6, delay: 1.5 + i * 0.2, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onStart(opt.dineIn)}
              className="min-w-[14rem] md:min-w-[18rem] bg-card text-foreground font-bold text-5xl md:text-6xl px-14 py-12 rounded-full shadow-2xl transition-shadow hover:shadow-primary/30"
            >
              {opt.label}
            </motion.button>
          ))}

        </motion.div>
      </div>
    </div>
  );
};

const KioskWelcome = memo(KioskWelcomeImpl);

export default KioskWelcome;
