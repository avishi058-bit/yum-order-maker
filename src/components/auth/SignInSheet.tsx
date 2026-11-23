// Apple-style pieces for the phone sign-in: a light bottom sheet (centered card
// on wide screens) and a 6-box code field. Used by the checkout code step and
// the header sign-in (CustomerAuthModal).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export const SignInSheet = ({ onClose, children, labelledBy }: { onClose?: () => void; children: ReactNode; labelledBy: string }) =>
  createPortal(
    <div dir="rtl" role="dialog" aria-modal="true" aria-labelledby={labelledBy}
      className="fixed inset-0 z-[10050] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[6px]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative w-full sm:max-w-[400px] bg-[#faf8f5] text-[#1c1917] rounded-t-[28px] sm:rounded-[28px] px-6 pt-3 pb-[max(1.75rem,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom-8 fade-in duration-200">
        <div className="w-9 h-[5px] rounded-full bg-[#d6d1cb] mx-auto mb-5 sm:hidden" aria-hidden />
        {onClose && (
          <button type="button" onClick={onClose} aria-label="סגירה"
            className="absolute top-4 left-4 w-8 h-8 rounded-full bg-[#eeeae5] text-[#8a827b] flex items-center justify-center">
            <X size={16} />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );

export const SheetTitle = ({ id, children }: { id: string; children: ReactNode }) => (
  <h2 id={id} className="text-[26px] font-black text-center tracking-tight leading-tight">{children}</h2>
);
export const SheetSub = ({ children }: { children: ReactNode }) => (
  <p className="text-[15px] text-[#78716c] text-center leading-relaxed mt-2">{children}</p>
);
export const SheetButton = ({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) => (
  <button type="button" onClick={onClick} disabled={disabled}
    className="w-full mt-6 rounded-full bg-[#1c1917] text-white py-4 text-[17px] font-bold active:scale-[0.98] transition disabled:bg-[#d6d1cb] disabled:text-white">
    {children}
  </button>
);
export const SheetFine = ({ children }: { children: ReactNode }) => (
  <p className="text-[11.5px] text-[#a8a29e] text-center leading-normal mt-4">{children}</p>
);

/**
 * Six boxes over one real input, so the phone's "code from Messages" suggestion
 * (autocomplete one-time-code) and paste both work.
 */
export const CodeBoxes = ({ value, onChange, onComplete, disabled }: {
  value: string; onChange: (v: string) => void; onComplete: (v: string) => void; disabled?: boolean;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="relative mt-7" dir="ltr" onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 6);
          onChange(v);
          if (v.length === 6) onComplete(v);
        }}
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="קוד אימות בן 6 ספרות"
        className="absolute inset-0 w-full h-full opacity-0 caret-transparent"
        maxLength={6}
      />
      <div className="flex justify-center gap-2 pointer-events-none" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => {
          const active = i === Math.min(value.length, 5) && !disabled;
          return (
            <div key={i} className={`w-11 h-14 rounded-[13px] bg-white flex items-center justify-center text-[26px] font-bold border-[1.5px] transition-colors ${i === 3 ? "ml-1.5" : ""} ${active ? "border-[#f59e0b] shadow-[0_0_0_4px_rgba(245,158,11,0.15)]" : "border-[#e7e2dc]"}`}>
              {value[i] ?? (active ? <span className="w-[2px] h-6 bg-[#f59e0b] animate-pulse" /> : "")}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** "שליחה חוזרת בעוד 0:42", then a link. */
export const ResendLine = ({ sentAt, onResend, busy }: { sentAt: number; onResend: () => void; busy?: boolean }) => {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, 60 - Math.floor((Date.now() - sentAt) / 1000));
  return left > 0 ? (
    <p className="text-[14px] text-[#a8a29e] text-center mt-5">שליחה חוזרת בעוד 0:{String(left).padStart(2, "0")}</p>
  ) : (
    <button type="button" onClick={onResend} disabled={busy} className="block mx-auto text-[15px] font-semibold text-[#b45309] mt-5">
      {busy ? "שולח..." : "לא הגיע? שליחה חוזרת"}
    </button>
  );
};
