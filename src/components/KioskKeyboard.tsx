import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Delete, ArrowDown, Space } from "lucide-react";

/**
 * KioskKeyboard
 * On-screen Hebrew + numeric keyboard for the kiosk.
 * - Auto-shows on focus of <input type=text|tel|search|email> and <textarea>
 * - Hides on blur (with small grace period to avoid flicker)
 * - Numeric layout for type="tel" / "number", Hebrew otherwise
 * - Inserts characters via execCommand + native input event so React state updates
 * - Lives at the bottom, full width, fixed
 *
 * Usage: render <KioskKeyboard /> once at the root of the kiosk page.
 */

type Layout = "hebrew" | "numeric";

const HEBREW_ROWS: string[][] = [
  ["ק", "ר", "א", "ט", "ו", "ן", "ם", "פ"],
  ["ש", "ד", "ג", "כ", "ע", "י", "ח", "ל", "ך", "ף"],
  ["ז", "ס", "ב", "ה", "נ", "מ", "צ", "ת", "ץ"],
];

const NUMERIC_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", ""],
];

function isEditableTarget(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName === "INPUT") {
    const t = (el.getAttribute("type") || "text").toLowerCase();
    return ["text", "tel", "email", "search", "url", "number", "password"].includes(t);
  }
  return false;
}

function pickLayout(el: HTMLElement | null): Layout {
  if (!el) return "hebrew";
  const t = (el.getAttribute("type") || "").toLowerCase();
  const im = (el.getAttribute("inputmode") || "").toLowerCase();
  if (t === "tel" || t === "number" || im === "tel" || im === "numeric" || im === "decimal") {
    return "numeric";
  }
  return "hebrew";
}

/** Insert text into the focused input so React onChange fires. */
function insertText(el: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const next = el.value.slice(0, start) + text + el.value.slice(end);

  // Use the native setter so React's synthetic event picks up the change
  const proto =
    el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, next);

  // Fire native input event — React listens for this
  el.dispatchEvent(new Event("input", { bubbles: true }));

  // Restore caret after the inserted text
  const caret = start + text.length;
  el.setSelectionRange(caret, caret);
}

function backspace(el: HTMLInputElement | HTMLTextAreaElement) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  let nextStart = start;
  let next: string;
  if (start !== end) {
    next = el.value.slice(0, start) + el.value.slice(end);
  } else if (start > 0) {
    next = el.value.slice(0, start - 1) + el.value.slice(end);
    nextStart = start - 1;
  } else {
    return;
  }
  const proto =
    el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, next);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.setSelectionRange(nextStart, nextStart);
}

const KioskKeyboard = () => {
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<Layout>("hebrew");
  const targetRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const blurTimerRef = useRef<number | null>(null);

  const cancelBlur = () => {
    if (blurTimerRef.current) {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  };

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      if (!isEditableTarget(e.target)) return;
      cancelBlur();
      const el = e.target as HTMLInputElement | HTMLTextAreaElement;
      // Opt-out: <input data-no-kbd>
      if (el.dataset.noKbd !== undefined) return;
      targetRef.current = el;
      setLayout(pickLayout(el));
      setOpen(true);
    };

    const onFocusOut = (e: FocusEvent) => {
      if (!isEditableTarget(e.target)) return;
      // Delay so tapping a key (which momentarily blurs the input) doesn't close us
      cancelBlur();
      blurTimerRef.current = window.setTimeout(() => {
        setOpen(false);
        targetRef.current = null;
      }, 150);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      cancelBlur();
    };
  }, []);

  // Prevent the keyboard from stealing focus from the input
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    cancelBlur();
  }, []);

  const press = useCallback((char: string) => {
    const el = targetRef.current;
    if (!el) return;
    // Re-focus the input in case blur fired
    el.focus({ preventScroll: true });
    insertText(el, char);
  }, []);

  const onBackspace = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    backspace(el);
  }, []);

  const onSpace = useCallback(() => press(" "), [press]);

  const onClose = useCallback(() => {
    targetRef.current?.blur();
    setOpen(false);
    targetRef.current = null;
  }, []);

  const rows = layout === "numeric" ? NUMERIC_KEYS : HEBREW_ROWS;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="kiosk-kbd"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          onPointerDown={handlePointerDown}
          dir="rtl"
          className="fixed bottom-0 left-0 right-0 z-[10000] bg-card/95 backdrop-blur-md border-t-2 border-border shadow-[0_-8px_30px_rgba(0,0,0,0.25)]"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          role="dialog"
          aria-label="מקלדת"
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <div className="flex gap-2">
              <button
                type="button"
                onPointerDown={handlePointerDown}
                onClick={() => setLayout("hebrew")}
                className={`px-4 py-2 rounded-lg text-base font-bold transition-colors ${
                  layout === "hebrew" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                }`}
              >
                א-ב
              </button>
              <button
                type="button"
                onPointerDown={handlePointerDown}
                onClick={() => setLayout("numeric")}
                className={`px-4 py-2 rounded-lg text-base font-bold transition-colors ${
                  layout === "numeric" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                }`}
              >
                123
              </button>
            </div>
            <button
              type="button"
              onPointerDown={handlePointerDown}
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-muted text-foreground flex items-center gap-1 text-sm font-bold"
              aria-label="סגור מקלדת"
            >
              <ArrowDown size={18} /> סגור
            </button>
          </div>

          {/* Keys */}
          <div className="px-2 py-3 space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex gap-1.5 justify-center">
                {row.map((k, j) =>
                  k === "" ? (
                    <div key={j} className="flex-1" />
                  ) : (
                    <button
                      key={j}
                      type="button"
                      onPointerDown={handlePointerDown}
                      onClick={() => press(k)}
                      className="flex-1 min-w-[7%] h-14 rounded-lg bg-background border border-border text-2xl font-bold text-foreground active:bg-primary/20 active:scale-95 transition-transform shadow-sm"
                    >
                      {k}
                    </button>
                  )
                )}
              </div>
            ))}

            {/* Bottom utility row */}
            <div className="flex gap-1.5 justify-center pt-1">
              {layout === "hebrew" && (
                <button
                  type="button"
                  onPointerDown={handlePointerDown}
                  onClick={onSpace}
                  className="flex-[6] h-14 rounded-lg bg-background border border-border text-base font-bold text-foreground active:bg-primary/20 active:scale-95 transition-transform shadow-sm flex items-center justify-center gap-2"
                  aria-label="רווח"
                >
                  <Space size={20} /> רווח
                </button>
              )}
              <button
                type="button"
                onPointerDown={handlePointerDown}
                onClick={onBackspace}
                className="flex-[2] h-14 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-base font-bold active:bg-destructive/20 active:scale-95 transition-transform shadow-sm flex items-center justify-center gap-2"
                aria-label="מחק"
              >
                <Delete size={22} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default KioskKeyboard;
