import { motion } from "framer-motion";
import logo from "@/assets/logo.png";
import heroBurger from "@/assets/hero-burger.jpg";

const KioskWelcome = ({ onStart }: { onStart: () => void }) => {
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

        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ 
            opacity: 1, 
            scale: [1, 1.06, 1],
          }}
          transition={{ 
            opacity: { duration: 0.6, delay: 0.8 },
            scale: { duration: 1.5, delay: 1.5, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" },
          }}
          whileTap={{ scale: 0.95 }}
          onClick={onStart}
          className="bg-orange-500 text-white font-black text-3xl md:text-4xl px-20 py-8 rounded-full shadow-2xl shadow-orange-500/50 hover:shadow-orange-500/70 transition-shadow"
        >
          לחץ להתחיל הזמנה 👆
        </motion.button>
      </div>
    </div>
  );
};

export default KioskWelcome;
