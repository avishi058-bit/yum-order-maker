// Finds the tax-invoice (חשבונית מס קבלה) document number inside a Z-Credit
// response. Z-Credit names this field differently across its APIs and often
// spells "Receipt" as "Reciept", and it may be nested (e.g. under Data or a
// transactions list), so the search goes by key pattern rather than one name.

const DOC_KEY = /(invoice|reciept|receipt|document|doc)\w*(number|num|no)$/i;
// Card/terminal identifiers that must never be mistaken for a document number.
const NOT_DOC = /(approval|card|voucher|transaction|session|reference|unique|customer|terminal|holder|phone|zip)/i;

const usable = (v: unknown): string | null => {
  if (v == null || typeof v === "object") return null;
  const s = String(v).trim();
  return s !== "" && s !== "0" && s.toLowerCase() !== "null" ? s : null;
};

export function findDocumentNumber(obj: unknown, depth = 0): string | null {
  if (obj == null || typeof obj !== "object" || depth > 4) return null;
  const entries = Array.isArray(obj)
    ? obj.map((v, i) => [String(i), v] as const)
    : Object.entries(obj as Record<string, unknown>);
  for (const [k, v] of entries) {
    if (DOC_KEY.test(k) && !NOT_DOC.test(k)) {
      const s = usable(v);
      if (s) return s;
    }
  }
  for (const [, v] of entries) {
    const found = findDocumentNumber(v, depth + 1);
    if (found) return found;
  }
  return null;
}

/** Nested key names only (never values), for safe logging. */
export function keyNames(obj: unknown, prefix = "", depth = 0, out: string[] = []): string[] {
  if (obj == null || typeof obj !== "object" || depth > 3 || out.length > 80) return out;
  const entries = Array.isArray(obj) ? obj.slice(0, 1).map((v) => ["[0]", v] as const) : Object.entries(obj as Record<string, unknown>);
  for (const [k, v] of entries) {
    const name = prefix ? `${prefix}.${k}` : k;
    out.push(name);
    keyNames(v, name, depth + 1, out);
  }
  return out;
}
