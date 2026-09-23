import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Delete, CornerDownLeft } from "lucide-react";

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

type Layout = "hebrew" | "numeric" | "english";

// Letters in VISUAL order right-to-left, matching standard Hebrew keyboard.
// The container uses direction:rtl so index 0 = rightmost key on screen.
const HEBREW_ROWS: string[][] = [
  ["פ", "ם", "ן", "ו", "ט", "א", "ר", "ק"],
  ["ף", "ך", "ל", "ח", "י", "ע", "כ", "ג", "ד", "ש"],
  ["ץ", "ת", "צ", "מ", "נ", "ה", "ב", "ס", "ז"],
];

// English letters, stored right-to-left because the rows render row-reverse.
const ENGLISH_ROWS: string[][] = [
  ["p", "o", "i", "u", "y", "t", "r", "e", "w", "q"],
  ["l", "k", "j", "h", "g", "f", "d", "s", "a"],
  [".", "_", "-", "@", "m", "n", "b", "v", "c", "x", "z"],
];

const NUMERIC_KEYS = [
  ["3", "2", "1"],
  ["6", "5", "4"],
  ["9", "8", "7"],
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
  if (t === "email" || im === "email") return "english";
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

  /**
   * Typing (especially a space that wraps a word to a new line) can make the
   * browser scroll the focused field into view, which visually "jumps" the
   * dialog up to the field above. Freeze every scrollable ancestor around the
   * edit so the view stays exactly where the user left it.
   */
  const withFrozenScroll = useCallback((el: HTMLElement, fn: () => void) => {
    const nodes: { node: HTMLElement; top: number; left: number }[] = [];
    let p: HTMLElement | null = el.parentElement;
    while (p) {
      if (p.scrollHeight > p.clientHeight || p.scrollWidth > p.clientWidth) {
        nodes.push({ node: p, top: p.scrollTop, left: p.scrollLeft });
      }
      p = p.parentElement;
    }
    const winX = window.scrollX;
    const winY = window.scrollY;

    const restore = () => {
      nodes.forEach(({ node, top, left }) => {
        if (node.scrollTop !== top) node.scrollTop = top;
        if (node.scrollLeft !== left) node.scrollLeft = left;
      });
      if (window.scrollX !== winX || window.scrollY !== winY) {
        window.scrollTo(winX, winY);
      }
    };

    // Keep pinning the scroll for a short window — browsers (and smooth
    // scrolling) can move the view a few frames after the edit lands.
    const onScroll = () => restore();
    document.addEventListener("scroll", onScroll, true);

    fn();

    restore();
    let frames = 0;
    const tick = () => {
      restore();
      if (++frames < 20) requestAnimationFrame(tick);
      else document.removeEventListener("scroll", onScroll, true);
    };
    requestAnimationFrame(tick);
  }, []);


  const press = useCallback((char: string) => {
    const el = targetRef.current;
    if (!el) return;
    // Re-focus the input in case blur fired
    el.focus({ preventScroll: true });
    withFrozenScroll(el, () => insertText(el, char));
  }, [withFrozenScroll]);

  const onBackspace = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    withFrozenScroll(el, () => backspace(el));
  }, [withFrozenScroll]);


  const onSpace = useCallback(() => press(" "), [press]);

  const onEnter = useCallback(() => {
    setOpen(false);
    // Find and click the "המשך לתשלום" submit button
    setTimeout(() => {
      const submitBtn = document.querySelector<HTMLButtonElement>('form button[type="submit"], form motion\\.button[type="submit"]');
      if (submitBtn) {
        submitBtn.click();
      } else {
        // Fallback: submit the form directly
        const form = document.querySelector<HTMLFormElement>('form');
        form?.requestSubmit();
      }
    }, 50);
  }, []);

  const rows =
    layout === "numeric" ? NUMERIC_KEYS : layout === "english" ? ENGLISH_ROWS : HEBREW_ROWS;
  // Cycle: Hebrew -> numbers -> English -> Hebrew
  const nextLayout: Layout =
    layout === "hebrew" ? "numeric" : layout === "numeric" ? "english" : "hebrew";
  const nextLabel = nextLayout === "numeric" ? "123" : nextLayout === "english" ? "ABC" : "א-ב";

  const isNum = layout === "numeric";
  const keyCls =
    "rounded-xl bg-card text-foreground border border-border shadow-sm active:scale-95 active:bg-muted transition-transform flex items-center justify-center font-medium select-none";
  const fnCls =
    "rounded-xl bg-muted text-foreground border border-border shadow-sm active:scale-95 transition-transform flex items-center justify-center font-semibold select-none";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="kiosk-kbd"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: "spring", damping: 26, stiffness: 300 }}
          onPointerDown={handlePointerDown}
          dir="ltr"
          className="fixed left-1/2 -translate-x-1/2 z-[10000] rounded-3xl bg-background/95 backdrop-blur border border-border shadow-2xl p-4"
          style={{
            bottom: "calc(2vh + env(safe-area-inset-bottom, 0px))",
            width: isNum ? "min(420px, 92vw)" : "min(760px, 94vw)",
          }}
          role="dialog"
          aria-label="מקלדת"
        >
          {isNum ? (
            <div className="grid grid-cols-3 gap-2.5" dir="ltr">
              {["1","2","3","4","5","6","7","8","9"].map((k) => (
                <button key={k} type="button" onPointerDown={handlePointerDown} onClick={() => press(k)}
                  className={`${keyCls} h-16 text-3xl`}>{k}</button>
              ))}
              <button type="button" onPointerDown={handlePointerDown} onClick={() => setLayout("hebrew")}
                className={`${fnCls} h-16 text-base`}>א-ב</button>
              <button type="button" onPointerDown={handlePointerDown} onClick={() => press("0")}
                className={`${keyCls} h-16 text-3xl`}>0</button>
              <button type="button" onPointerDown={handlePointerDown} onClick={onBackspace}
                className={`${fnCls} h-16`} aria-label="מחק"><Delete size={26} /></button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {rows.map((row, i) => (
                <div key={i} className="flex flex-row-reverse gap-1.5 justify-center">
                  {row.map((k, j) => (
                    <button key={j} type="button" onPointerDown={handlePointerDown} onClick={() => press(k)}
                      className={`${keyCls} h-14 flex-1 max-w-[64px] min-w-0 text-2xl`}>{k}</button>
                  ))}
                  {i === 0 && (
                    <button type="button" onPointerDown={handlePointerDown} onClick={onBackspace}
                      className={`${fnCls} h-14 px-4`} aria-label="מחק"><Delete size={24} /></button>
                  )}
                </div>
              ))}
              <div className="flex flex-row-reverse gap-1.5">
                <button type="button" onPointerDown={handlePointerDown} onClick={onEnter}
                  className="rounded-xl bg-primary text-primary-foreground shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-1 h-14 px-5 font-semibold"
                  aria-label="אנטר"><CornerDownLeft size={20} /><span>המשך</span></button>
                <button type="button" onPointerDown={handlePointerDown} onClick={onSpace}
                  className={`${keyCls} h-14 flex-1 text-base text-muted-foreground`} aria-label="רווח">רווח</button>
                <button type="button" onPointerDown={handlePointerDown} onClick={() => setLayout(nextLayout)}
                  className={`${fnCls} h-14 px-5 text-base`}>{nextLabel}</button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default KioskKeyboard;
