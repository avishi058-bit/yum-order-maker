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

// Letters in VISUAL order right-to-left, matching standard Hebrew keyboard.
// The container uses direction:rtl so index 0 = rightmost key on screen.
const HEBREW_ROWS: string[][] = [
  ["פ", "ם", "ן", "ו", "ט", "א", "ר", "ק"],
  ["ף", "ך", "ל", "ח", "י", "ע", "כ", "ג", "ד", "ש"],
  ["ץ", "ת", "צ", "מ", "נ", "ה", "ב", "ס", "ז"],
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
          dir="ltr"
          className="fixed bottom-0 left-0 right-0 z-[10000] bg-[#d1d5db] border-t border-black/10 shadow-[0_-8px_30px_rgba(0,0,0,0.25)] flex flex-col"
          style={{
            height: "45vh",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
          role="dialog"
          aria-label="מקלדת"
        >
          {/* Keys area — flex column that fills available height */}
          <div className="flex-1 flex flex-col justify-around px-1.5 py-2 gap-1.5">
            {/* Row 1: ק ר א ט ו ן ם פ ⌫  (right-to-left) */}
            {/* We use flex-row-reverse so array index 0 (ק) appears on the RIGHT */}
            <div className="flex-1 flex flex-row-reverse gap-1 items-stretch">
              {rows[0].map((k, j) => (
                <button
                  key={j}
                  type="button"
                  onPointerDown={handlePointerDown}
                  onClick={() => press(k)}
                  className="flex-1 min-w-0 rounded-md bg-white text-3xl font-normal text-black active:bg-black/10 active:scale-95 transition-transform shadow-[0_1px_0_rgba(0,0,0,0.35)]"
                  style={{ fontFamily: '-apple-system, "SF Pro Display", "Heebo", system-ui, sans-serif' }}
                >
                  {k}
                </button>
              ))}
              {/* Backspace at the LEFT end of row 1 */}
              <button
                type="button"
                onPointerDown={handlePointerDown}
                onClick={onBackspace}
                className="rounded-md bg-[#a8adb6] text-black active:bg-[#959aa3] active:scale-95 transition-transform shadow-[0_1px_0_rgba(0,0,0,0.35)] flex items-center justify-center"
                style={{ minWidth: "9%", flex: "0 0 auto", padding: "0 12px" }}
                aria-label="מחק"
              >
                <Delete size={26} strokeWidth={2.2} />
              </button>
            </div>

            {/* Rows 2 and 3 — letters only */}
            {rows.slice(1).map((row, i) => (
              <div key={i + 1} className="flex-1 flex flex-row-reverse gap-1 items-stretch">
                {row.map((k, j) => (
                  <button
                    key={j}
                    type="button"
                    onPointerDown={handlePointerDown}
                    onClick={() => press(k)}
                    className="flex-1 min-w-0 rounded-md bg-white text-3xl font-normal text-black active:bg-black/10 active:scale-95 transition-transform shadow-[0_1px_0_rgba(0,0,0,0.35)]"
                    style={{ fontFamily: '-apple-system, "SF Pro Display", "Heebo", system-ui, sans-serif' }}
                  >
                    {k}
                  </button>
                ))}
              </div>
            ))}

            {/* Bottom utility row (visually RTL): close | space | 123 → using row-reverse */}
            <div className="flex-1 flex flex-row-reverse gap-1 items-stretch">
              {/* 123 — rightmost */}
              <button
                type="button"
                onPointerDown={handlePointerDown}
                onClick={() => setLayout(layout === "hebrew" ? "numeric" : "hebrew")}
                className="rounded-md bg-[#a8adb6] text-black text-base font-semibold active:bg-[#959aa3] active:scale-95 transition-transform shadow-[0_1px_0_rgba(0,0,0,0.35)] flex items-center justify-center"
                style={{ minWidth: "12%", flex: "0 0 auto", padding: "0 12px" }}
              >
                {layout === "hebrew" ? "123" : "א-ב"}
              </button>
              {/* Space — center, takes the rest */}
              <button
                type="button"
                onPointerDown={handlePointerDown}
                onClick={onSpace}
                className="flex-1 rounded-md bg-white text-black text-base font-normal active:bg-black/10 active:scale-95 transition-transform shadow-[0_1px_0_rgba(0,0,0,0.35)]"
                style={{ fontFamily: '-apple-system, "SF Pro Display", "Heebo", system-ui, sans-serif' }}
                aria-label="רווח"
              >
                רווח
              </button>
              {/* Close — leftmost */}
              <button
                type="button"
                onPointerDown={handlePointerDown}
                onClick={onClose}
                className="rounded-md bg-[#a8adb6] text-black active:bg-[#959aa3] active:scale-95 transition-transform shadow-[0_1px_0_rgba(0,0,0,0.35)] flex items-center justify-center"
                style={{ minWidth: "12%", flex: "0 0 auto", padding: "0 12px" }}
                aria-label="סגור מקלדת"
              >
                <ArrowDown size={22} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default KioskKeyboard;
