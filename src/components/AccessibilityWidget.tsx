import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Accessibility,
  Type,
  Sun,
  MousePointer,
  Link2,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Underline,
  AlignRight,
  Contrast,
  Droplet,
  Heading,
  Image as ImageIcon,
  Minus,
  Plus,
  Maximize2,
  Minimize2,
  MessageSquareWarning,
  Moon,
} from "lucide-react";
import { uiPositions, drawerAnimations, getSlideAnimation } from "@/config/uiConfig";

type ColorMode = "none" | "highContrast" | "invert" | "monochrome" | "sepia" | "blackYellow";

interface AccessibilityState {
  fontSize: number; // 0..4  (100% .. 180%)
  zoom: number; // 0..3    (100% .. 130%)
  colorMode: ColorMode;
  highlightLinks: boolean;
  bigCursor: boolean;
  stopAnimations: boolean;
  readableFont: boolean;
  lineHeight: boolean;
  textSpacing: boolean;
  headingEmphasis: boolean;
  imageDescriptions: boolean;
}

const defaultState: AccessibilityState = {
  fontSize: 0,
  zoom: 0,
  colorMode: "none",
  highlightLinks: false,
  bigCursor: false,
  stopAnimations: false,
  readableFont: false,
  lineHeight: false,
  textSpacing: false,
  headingEmphasis: false,
  imageDescriptions: false,
};

const FONT_SIZES = ["100%", "115%", "130%", "150%", "180%"];
const ZOOM_LEVELS = [1, 1.1, 1.2, 1.3];

const COLOR_CLASSES: Record<Exclude<ColorMode, "none">, string> = {
  highContrast: "accessibility-high-contrast",
  invert: "accessibility-invert",
  monochrome: "accessibility-monochrome",
  sepia: "accessibility-sepia",
  blackYellow: "accessibility-black-yellow",
};

const CAPTION_CLASS = "a11y-alt-caption";

const applyImageCaptions = (enabled: boolean) => {
  if (!enabled) {
    document.querySelectorAll<HTMLElement>(`.${CAPTION_CLASS}`).forEach((el) => el.remove());
    return;
  }
  document.querySelectorAll<HTMLImageElement>("img[alt]").forEach((img) => {
    const alt = img.getAttribute("alt");
    if (!alt) return;
    // idempotent — never re-insert a caption that already exists
    if (img.nextElementSibling?.classList.contains(CAPTION_CLASS)) return;
    img.title = alt;
    const caption = document.createElement("span");
    caption.className = CAPTION_CLASS;
    caption.textContent = alt;
    img.insertAdjacentElement("afterend", caption);


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

    root.style.fontSize = FONT_SIZES[s.fontSize] ?? "100%";

    // Page zoom (separate from font size)
    const zoom = ZOOM_LEVELS[s.zoom] ?? 1;
    body.style.zoom = zoom === 1 ? "" : String(zoom);

    // Color modes — mutually exclusive
    Object.values(COLOR_CLASSES).forEach((cls) => {
      body.classList.remove(cls);
      root.classList.remove(cls);
    });
    if (s.colorMode !== "none") body.classList.add(COLOR_CLASSES[s.colorMode]);

    const toggleClass = (cond: boolean, cls: string) => {
      body.classList.toggle(cls, cond);
    };

    toggleClass(s.highlightLinks, "accessibility-highlight-links");
    toggleClass(s.bigCursor, "accessibility-big-cursor");
    toggleClass(s.readableFont, "accessibility-readable-font");
    toggleClass(s.lineHeight, "accessibility-line-height");
    toggleClass(s.textSpacing, "accessibility-text-spacing");
    toggleClass(s.headingEmphasis, "accessibility-heading-emphasis");
    toggleClass(s.imageDescriptions, "accessibility-img-desc");

    body.classList.toggle("accessibility-stop-animations", s.stopAnimations);
    root.classList.toggle("accessibility-stop-animations", s.stopAnimations);

    applyImageCaptions(s.imageDescriptions);
  }, []);

  useEffect(() => {
    applyStyles(state);
    try {
      localStorage.setItem("accessibility", JSON.stringify(state));
    } catch {}
  }, [state, applyStyles]);

  // Re-apply image captions when new images render (SPA navigation, lazy content)
  useEffect(() => {
    if (!state.imageDescriptions) return;
    const observer = new MutationObserver(() => applyImageCaptions(true));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [state.imageDescriptions]);

  const setColorMode = (mode: Exclude<ColorMode, "none">) =>
    setState((p) => ({ ...p, colorMode: p.colorMode === mode ? "none" : mode }));

  const toggleFlag = (key: keyof AccessibilityState) =>
    setState((p) => ({ ...p, [key]: !p[key] }));

  const step = (key: "fontSize" | "zoom", dir: 1 | -1) =>
    setState((p) => {
      const max = key === "fontSize" ? FONT_SIZES.length - 1 : ZOOM_LEVELS.length - 1;
      return { ...p, [key]: Math.min(max, Math.max(0, p[key] + dir)) };
    });

  const reset = () => setState(defaultState);

  const colorButtons: { mode: Exclude<ColorMode, "none">; label: string; icon: React.ReactNode }[] = [
    { mode: "highContrast", label: "ניגודיות גבוהה", icon: <Contrast size={20} /> },
    { mode: "invert", label: "היפוך צבעים", icon: <Moon size={20} /> },
    { mode: "monochrome", label: "מונוכרום", icon: <Droplet size={20} /> },
    { mode: "sepia", label: "ספיה", icon: <Sun size={20} /> },
    { mode: "blackYellow", label: "שחור־צהוב", icon: <Contrast size={20} /> },
  ];

  const toggles: { key: keyof AccessibilityState; label: string; icon: React.ReactNode }[] = [
    { key: "headingEmphasis", label: "הדגשת כותרות", icon: <Heading size={20} /> },
    { key: "highlightLinks", label: "הדגשת קישורים", icon: <Link2 size={20} /> },
    { key: "imageDescriptions", label: "תיאור תמונות", icon: <ImageIcon size={20} /> },
    { key: "readableFont", label: "גופן קריא", icon: <AlignRight size={20} /> },
    { key: "lineHeight", label: "מרווח שורות", icon: <ZoomOut size={20} /> },
    { key: "textSpacing", label: "מרווח אותיות", icon: <Underline size={20} /> },
    { key: "bigCursor", label: "סמן גדול", icon: <MousePointer size={20} /> },
    { key: "stopAnimations", label: "ביטול הבהובים ואנימציות", icon: <Pause size={20} /> },
  ];

  const cardClass = (active: boolean) =>
    `w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-right ${
      active
        ? "border-primary bg-primary/10 text-primary"
        : "border-border bg-background text-foreground hover:bg-secondary"
    }`;

  const iconBox = (active: boolean) =>
    `w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
    }`;

  return (
    <>
      {/* Floating button — position from uiConfig */}
      <button
        onClick={() => setOpen(true)}
        aria-label="פתח תפריט נגישות"
        className={`${uiPositions.accessibility.button} w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform`}
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
              {...getSlideAnimation(drawerAnimations.accessibilityPanel.direction)}
              transition={drawerAnimations.accessibilityPanel.transition}
              className={`fixed top-0 ${uiPositions.accessibility.panelSide === 'left' ? 'left-0' : 'right-0'} bottom-0 w-80 max-w-[90vw] z-[70] bg-card shadow-2xl flex flex-col`}
              dir="rtl"
              role="dialog"
              aria-label="תפריט נגישות"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Accessibility size={20} className="text-primary" />
                  <h2 className="text-lg font-bold">תפריט נגישות</h2>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="סגור תפריט נגישות"
                  className="w-11 h-11 rounded-full bg-muted flex items-center justify-center"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* Font size */}
                <div className="rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Type size={18} className="text-primary" />
                    <span className="text-sm font-bold">גודל טקסט — {FONT_SIZES[state.fontSize]}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => step("fontSize", 1)}
                      aria-label="הגדלת גופן"
                      className="flex-1 h-11 rounded-lg bg-primary/10 text-primary font-bold flex items-center justify-center gap-1"
                    >
                      <Plus size={16} /> הגדלה
                    </button>
                    <button
                      onClick={() => step("fontSize", -1)}
                      aria-label="הקטנת גופן"
                      className="flex-1 h-11 rounded-lg bg-muted text-foreground font-bold flex items-center justify-center gap-1"
                    >
                      <Minus size={16} /> הקטנה
                    </button>
                  </div>
                </div>

                {/* Zoom */}
                <div className="rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <ZoomIn size={18} className="text-primary" />
                    <span className="text-sm font-bold">
                      גודל תצוגה — {Math.round(ZOOM_LEVELS[state.zoom] * 100)}%
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => step("zoom", 1)}
                      aria-label="הגדלת מסך"
                      className="flex-1 h-11 rounded-lg bg-primary/10 text-primary font-bold flex items-center justify-center gap-1"
                    >
                      <Maximize2 size={16} /> הגדלת מסך
                    </button>
                    <button
                      onClick={() => step("zoom", -1)}
                      aria-label="הקטנת מסך"
                      className="flex-1 h-11 rounded-lg bg-muted text-foreground font-bold flex items-center justify-center gap-1"
                    >
                      <Minimize2 size={16} /> הקטנת מסך
                    </button>
                  </div>
                </div>

                {/* Color modes */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground px-1">התאמת צבעים</p>
                  {colorButtons.map((btn) => {
                    const active = state.colorMode === btn.mode;
                    return (
                      <button
                        key={btn.mode}
                        onClick={() => setColorMode(btn.mode)}
                        aria-pressed={active}
                        className={cardClass(active)}
                      >
                        <div className={iconBox(active)}>{btn.icon}</div>
                        <span className="font-medium text-sm">{btn.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Toggles */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground px-1">התאמות תוכן</p>
                  {toggles.map((btn) => {
                    const active = Boolean(state[btn.key]);
                    return (
                      <button
                        key={btn.key}
                        onClick={() => toggleFlag(btn.key)}
                        aria-pressed={active}
                        className={cardClass(active)}
                      >
                        <div className={iconBox(active)}>{btn.icon}</div>
                        <span className="font-medium text-sm">{btn.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="px-4 py-4 border-t border-border space-y-3">
                <button
                  onClick={reset}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-muted text-muted-foreground hover:bg-secondary transition-colors font-medium text-sm"
                >
                  <RotateCcw size={16} />
                  איפוס הגדרות
                </button>
                <div className="flex gap-2">
                  <a
                    href="/accessibility-statement"
                    className="flex-1 text-center py-3 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-bold text-xs"
                  >
                    הצהרת נגישות
                  </a>
                  <a
                    href="https://wa.me/972584633555?text=%D7%93%D7%99%D7%95%D7%95%D7%97%20%D7%A2%D7%9C%20%D7%91%D7%A2%D7%99%D7%99%D7%AA%20%D7%A0%D7%92%D7%99%D7%A9%D7%95%D7%AA%20%D7%91%D7%90%D7%AA%D7%A8"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1 py-3 rounded-xl bg-muted text-foreground hover:bg-secondary transition-colors font-bold text-xs"
                  >
                    <MessageSquareWarning size={14} />
                    דיווח על בעיה
                  </a>
                </div>
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
