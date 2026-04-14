import { motion } from "framer-motion";
import heroBurger from "@/assets/hero-burger.jpg";

const HeroSection = ({ onOrderClick }: { onOrderClick: () => void }) => {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={heroBurger}
          alt="המבורגר עסיסי"
          width={1920}
          height={1080}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
      </div>
      <div className="relative z-10 text-center px-4">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-5xl md:text-7xl font-black mb-4 tracking-tight"
        >
          <span className="text-primary animate-flame-flicker">🔥</span>{" "}
          בורגר מושלם
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-lg mx-auto"
        >
          בשר טרי על הגריל, תוספות לבחירתך, ישירות אליך
        </motion.p>
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onOrderClick}
          className="bg-primary text-primary-foreground font-bold text-lg px-10 py-4 rounded-full shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-shadow"
        >
          הזמינו עכשיו
        </motion.button>
      </div>
    </section>
  );
};

export default HeroSection;
