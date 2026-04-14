import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Accessibility, Type, Sun, MousePointer, Link2, Pause, RotateCcw, ZoomIn, ZoomOut, Underline, AlignRight } from "lucide-react";

interface AccessibilityState {
  fontSize: number; // 0 = normal, 1 = large, 2 = larger
  highContrast: boolean;
  invertColors: boolean;
  highlightLinks: boolean;
  bigCursor: boolean;
  stopAnimations: boolean;
  readableFont: boolean;
  lineHeight: boolean;
  textSpacing: boolean;
}

const defaultState: AccessibilityState = {
  fontSize: 0,
  highContrast: false,
  invertColors: false,
  highlightLinks: false,
  bigCursor: false,
  stopAnimations: false,
  readableFont: false,
  lineHeight: false,
  textSpacing: false,
};

const AccessibilityWidget = () => {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<AccessibilityState>(() => {
    try {
      const saved = localStorage.getItem("accessibility");
      return saved ? { ...defaultState, ...JSON.parse(saved) } : defaultState;
    } catch {
      return defaultState;
    }
  });

  const applyStyles = useCallback((s: AccessibilityState) => {
    const root = document.documentElement;
    const body = document.body;

    // Font size
    const sizes = ["100%", "120%", "140%"];
    root.style.fontSize = sizes[s.fontSize];

    // High contrast
    if (s.highContrast) {
      body.classList.add("accessibility-high-contrast");
    } else {
      body.classList.remove("accessibility-high-contrast");
    }

    // Invert colors
    if (s.invertColors) {
      body.classList.add("accessibility-invert");
    } else {
      body.classList.remove("accessibility-invert");
    }

    // Highlight links
    if (s.highlightLinks) {
      body.classList.add("accessibility-highlight-links");
    } else {
      body.classList.remove("accessibility-highlight-links");
    }

    // Big cursor
    if (s.bigCursor) {
      body.classList.add("accessibility-big-cursor");
    } else {
      body.classList.remove("accessibility-big-cursor");
    }

    // Stop animations
    if (s.stopAnimations) {
      body.classList.add("accessibility-stop-animations");
    } else {
      body.classList.remove("accessibility-stop-animations");
    }

    // Readable font
    if (s.readableFont) {
      body.classList.add("accessibility-readable-font");
    } else {
      body.classList.remove("accessibility-readable-font");
    }

    // Line height
    if (s.lineHeight) {
      body.classList.add("accessibility-line-height");
    } else {
      body.classList.remove("accessibility-line-height");
    }

    // Text spacing
    if (s.textSpacing) {
      body.classList.add("accessibility-text-spacing");
    } else {
      body.classList.remove("accessibility-text-spacing");
    }
  }, []);

  useEffect(() => {
    applyStyles(state);
    try {
      localStorage.setItem("accessibility", JSON.stringify(state));
    } catch {}
  }, [state, applyStyles]);

  const toggle = (key: keyof AccessibilityState) => {
    if (key === "fontSize") {
      setState((prev) => ({ ...prev, fontSize: (prev.fontSize + 1) % 3 }));
    } else {
      setState((prev) => ({ ...prev, [key]: !prev[key] }));
    }
  };

  const reset = () => {
    setState(defaultState);
  };

  const buttons: { key: keyof AccessibilityState; label: string; icon: React.ReactNode; active: boolean }[] = [
    { key: "fontSize", label: state.fontSize === 0 ? "הגדלת טקסט" : state.fontSize === 1 ? "טקסט גדול" : "טקסט גדול מאוד", icon: <Type size={20} />, active: state.fontSize > 0 },
    { key: "highContrast", label: "ניגודיות גבוהה", icon: <Sun size={20} />, active: state.highContrast },
    { key: "invertColors", label: "היפוך צבעים", icon: <ZoomIn size={20} />, active: state.invertColors },
    { key: "highlightLinks", label: "הדגשת קישורים", icon: <Link2 size={20} />, active: state.highlightLinks },
    { key: "bigCursor", label: "סמן גדול", icon: <MousePointer size={20} />, active: state.bigCursor },
    { key: "stopAnimations", label: "עצירת אנימציות", icon: <Pause size={20} />, active: state.stopAnimations },
    { key: "readableFont", label: "גופן קריא", icon: <AlignRight size={20} />, active: state.readableFont },
    { key: "lineHeight", label: "מרווח שורות", icon: <ZoomOut size={20} />, active: state.lineHeight },
    { key: "textSpacing", label: "מרווח אותיות", icon: <Underline size={20} />, active: state.textSpacing },
  ];

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="פתח תפריט נגישות"
        className="fixed bottom-6 right-6 z-[60] w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
      >
        <Accessibility size={22} />
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black z-[70]"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-80 max-w-[90vw] z-[70] bg-card shadow-2xl flex flex-col"
              dir="rtl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Accessibility size={20} className="text-primary" />
                  <h2 className="text-lg font-bold">הצהרת נגישות</h2>
                </div>
                <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
                {buttons.map((btn) => (
                  <button
                    key={btn.key}
                    onClick={() => toggle(btn.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-right ${
                      btn.active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-foreground hover:bg-secondary"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      btn.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {btn.icon}
                    </div>
                    <span className="font-medium text-sm">{btn.label}</span>
                  </button>
                ))}
              </div>

              <div className="px-4 py-4 border-t border-border space-y-3">
                <button
                  onClick={reset}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-muted text-muted-foreground hover:bg-secondary transition-colors font-medium text-sm"
                >
                  <RotateCcw size={16} />
                  איפוס הגדרות
                </button>
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  אתר זה מונגש בהתאם לתקן הישראלי 5568 ולהנחיות WCAG 2.1 ברמה AA
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default AccessibilityWidget;
