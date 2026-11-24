// Checkout: one short row per burger with ready name buttons - the customer's
// own name (typed once, above) and any name already given to another burger.
// "שם אחר" opens a small field. Everything here is optional.
import { useState } from "react";

export type DishOwnerRow = { id: string; label: string; qty: number };

type Theme = { textMain: string; textMuted: string; border: string; inputBg: string; inputBorder: string; inputFocus: string };

type Props = {
  rows: DishOwnerRow[];
  myName: string;
  owners: Record<string, string>;
  onChange: (id: string, name: string) => void;
  th: Theme;
  large?: boolean;
};

const DishOwners = ({ rows, myName, owners, onChange, th, large = false }: Props) => {
  const [typing, setTyping] = useState<string | null>(null);
  const me = myName.trim().split(/\s+/)[0] ?? "";
  const known = Array.from(new Set([me, ...Object.values(owners).map((n) => n.trim())].filter((n) => n.length >= 2)));
  const chip = `rounded-full border-2 font-bold transition-colors ${large ? "px-5 py-2 text-lg" : "px-3 py-1 text-sm"}`;

  return (
    <div className={`rounded-xl border ${th.border} p-3 space-y-3`}>
      <p className={`font-bold ${th.textMain} ${large ? "text-xl" : ""}`}>
        על השם של מי כל המבורגר? <span className={`font-normal ${th.textMuted}`}>(אפשר לדלג)</span>
      </p>
      {rows.map((row) => {
        const current = (owners[row.id] ?? "").trim();
        return (
          <div key={row.id} className="space-y-2">
            <p className={`${th.textMain} ${large ? "text-lg" : "text-sm"}`}>
              {row.label}{row.qty > 1 ? ` ×${row.qty}` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {known.map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={current === name}
                  onClick={() => { setTyping(null); onChange(row.id, current === name ? "" : name); }}
                  className={`${chip} ${current === name ? "border-primary bg-primary text-primary-foreground" : `${th.border} ${th.textMain}`}`}
                >
                  {name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setTyping(row.id); if (known.includes(current)) onChange(row.id, ""); }}
                className={`${chip} border-dashed ${th.border} ${th.textMuted}`}
              >
                שם אחר
              </button>
            </div>
            {typing === row.id && (
              <input
                type="text"
                autoFocus
                value={owners[row.id] ?? ""}
                maxLength={30}
                onChange={(e) => onChange(row.id, e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setTyping(null); } }}
                onBlur={() => setTyping(null)}
                placeholder="שם (למשל: יוסי)"
                autoComplete="off"
                className={`w-full ${th.inputBg} border ${th.inputBorder} rounded-lg px-4 py-2 ${th.textMain} focus:outline-none focus:ring-2 ${th.inputFocus}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DishOwners;
