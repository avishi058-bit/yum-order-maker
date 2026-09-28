import { memo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import heroBurger from "@/assets/hero-burger.webp";
import { Button } from "@/components/ui/button";
import { kioskSoldierFund, kioskWelcomeAnimations } from "@/config/uiConfig";

/**
 * Welcome screen for the kiosk. Wrapped in React.memo so background re-renders
 * of the parent <Kiosk> page (e.g. realtime updates from menu_availability or
 * site_settings) do NOT re-render this component or restart its animations.
 * The screen must stay perfectly stable until the user touches it.
 */
interface KioskWelcomeProps {
  onStart: (dineIn: boolean) => void;
  imagesReady?: boolean;
  soldierFundEnabled?: boolean;
  onSoldierFundClick?: () => void;
}

const KioskWelcomeImpl = ({ onStart, imagesReady = true, soldierFundEnabled = false, onSoldierFundClick }: KioskWelcomeProps) => {
  const [showChoices, setShowChoices] = useState(false);

  return (
    <main className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden" dir="rtl">
      <div className="absolute inset-0">
        <img
          src={heroBurger}
          alt="המבורגר הבקתה"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/45 to-foreground/15" />
      </div>

      <AnimatePresence mode="sync" initial={false}>
        {!showChoices ? (
          <motion.div
            key="intro"
            {...kioskWelcomeAnimations.intro}
            className="relative z-10 flex h-full w-full items-center justify-center"
          >
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowChoices(true)}
              aria-label="לחצו להתחלה"
              className="h-full w-full rounded-none bg-transparent p-8 text-foreground hover:bg-transparent focus-visible:ring-4 focus-visible:ring-primary"
            >
              <motion.span
                {...kioskWelcomeAnimations.brand}
                className="flex flex-col items-center text-center drop-shadow-lg"
              >
                <span className="mb-10 text-7xl font-black md:text-9xl">הבקתה</span>
                <motion.span
                  {...kioskWelcomeAnimations.tapPrompt}
                  className="text-3xl font-black md:text-5xl"
                >
                  {imagesReady ? "לחצו להתחלה" : "טוען תפריט…"}
                </motion.span>
              </motion.span>
            </Button>
          </motion.div>
        ) : (
          <motion.section
            key="choices"
            {...kioskWelcomeAnimations.choices}
            className="relative z-10 flex flex-col items-center px-8 text-center text-foreground drop-shadow-lg"
          >
            <h1 className="mb-4 text-6xl font-black md:text-8xl">ברוכים הבאים</h1>
            <p className="mb-12 text-3xl font-bold md:text-4xl">איך תרצו את ההזמנה?</p>
            <div className="flex flex-row-reverse items-center gap-8 md:gap-12">
              {[
                { label: "לשבת", dineIn: true },
                { label: "לקחת", dineIn: false },
              ].map((option, index) => (
                <motion.div key={option.label} {...kioskWelcomeAnimations.choiceButton(index)}>
                  <Button
                    type="button"
                    onClick={() => onStart(option.dineIn)}
                    className="h-40 w-72 rounded-full border border-border bg-kiosk-nav/95 text-4xl font-black text-kiosk-nav-foreground shadow-2xl backdrop-blur-sm md:h-48 md:w-96 md:text-5xl"
                  >
                    {option.label}
                  </Button>
                </motion.div>
              ))}
            </div>
            {soldierFundEnabled && onSoldierFundClick && (
              <motion.div {...kioskWelcomeAnimations.choiceButton(2)}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onSoldierFundClick}
                  className={kioskSoldierFund.welcomeButton}
                >
                  🫡 הזמן חייל/ת
                </Button>
                <p className={kioskSoldierFund.welcomeHint}>אפשר לתרום בלבד או להמשיך להזמנה</p>
              </motion.div>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
};

const KioskWelcome = memo(KioskWelcomeImpl);

export default KioskWelcome;
