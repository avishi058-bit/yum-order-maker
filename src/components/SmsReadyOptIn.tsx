// "SMS me when ready" for dine-in and kiosk customers who want to walk around.
// Off by default; when on and no phone is known yet, asks for one.
interface Props {
  on: boolean;
  onToggle: (on: boolean) => void;
  askPhone: boolean;
  phone: string;
  onPhone: (phone: string) => void;
  kiosk: boolean;
  th: { border: string; textMain: string; textMuted: string; inputBg: string; inputBorder: string; inputFocus: string };
}

const SmsReadyOptIn = ({ on, onToggle, askPhone, phone, onPhone, kiosk, th }: Props) => (
  <div className={`rounded-xl border-2 transition-colors ${on ? "border-primary bg-primary/10" : th.border}`}>
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onToggle(!on)}
      className={`w-full flex items-center gap-3 text-right ${kiosk ? "p-5" : "p-4"}`}
    >
      <span aria-hidden className={kiosk ? "text-4xl" : "text-2xl"}>📱</span>
      <span className="flex-1">
        <span className={`block font-black ${kiosk ? "text-2xl" : "text-base"} ${th.textMain}`}>הולכים לסיבוב וחוזרים?</span>
        <span className={`block ${kiosk ? "text-lg" : "text-sm"} ${th.textMuted}`}>נעדכן אתכם ב-SMS כשההזמנה שלכם מוכנה</span>
      </span>
      <span
        aria-hidden
        className={`shrink-0 rounded-full transition-colors relative ${kiosk ? "w-16 h-9" : "w-12 h-7"} ${on ? "bg-primary" : "bg-muted-foreground/30"}`}
      >
        <span
          className={`absolute top-1 rounded-full bg-white shadow transition-all ${kiosk ? "w-7 h-7" : "w-5 h-5"} ${on ? "left-1" : kiosk ? "left-8" : "left-6"}`}
        />
      </span>
    </button>
    {on && askPhone && (
      <div className={kiosk ? "px-5 pb-5" : "px-4 pb-4"}>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={phone}
          onChange={(e) => onPhone(e.target.value)}
          placeholder="מספר טלפון נייד"
          aria-label="מספר טלפון לעדכון ב-SMS"
          dir="ltr"
          className={`w-full ${th.inputBg} border ${th.inputBorder} rounded-lg px-4 ${kiosk ? "py-4 text-2xl" : "py-3"} text-center tracking-wider ${th.textMain} focus:outline-none focus:ring-2 ${th.inputFocus}`}
        />
      </div>
    )}
  </div>
);

export default SmsReadyOptIn;
