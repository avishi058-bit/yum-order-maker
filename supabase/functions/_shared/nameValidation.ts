export const CUSTOMER_NAME_MESSAGE = "בבקשה לכתוב את השם האמיתי שלכם ולכבד את המקום...";
export const STAFF_NAME_MESSAGE = "יש לכתוב לפחות 2 אותיות";

// One list for browser and server. Context-sensitive words are handled below.
export const CUSTOMER_NAME_BLOCKLIST = [
  "זין", "הזין", "אידיוט", "ניגר", "הומו", "ההומו", "גיי", "מכוער", "רצח", "השמן", "אחושרמוטה", "שרמוטה", "המוזרה", "זונה", "מניאק", "כוס", "חרא", "המלך", "המלכה", "ימלמלמלך", "הגבר", "גבר", "המתוקי", "החמוד", "והקטן", "היפה", "הארנב", "סקיבידי", "שליטא", "טיפ", "תצעק", "בבקשה", "תודה", "הצלחה", "מבורך", "אח", "טעים", "בצד", "מנה", "ביצת", "עין", "עגבניה", "אקסטרה", "קסטרה", "חמוצים", "רטבים", "שש", "שבע", "שבכ", "שבעש", "שששבע", "סיקס", "סבן", "לברון", "גיימס", "זדורוב", "דרייק", "היהודים", "הזויות", "בנות", "פאדייי", "test", "asdasdasd", "tnt", "tchah", "dragonfly", "sixseven",
  "סיקס סבן", "אבא של בוחבוט", "אבו פאדייי", "שבוע טוב ומבורך", "חברות הזויות", "רומן זדורוב", "לברון גיימס", "עלמה ציגלר דרייק ברנץ", "אאאא", "אא", "ננ", "נננ", "עגג", "עחמ", "חחו", "עאהא", "יכנכנע", "יניכחד", "יותםיעכ", "שחחח", "אליאבם מלחחחח", "שיםחמוצים", "אסףים רטבים", "סתיוקסטרה עגבניה", "יהלש עם ביצת עין", "דבוש מנה בצד", "אורי היימןהצלחה", "חנוחילהואלה שיהיה טעים אח",
] as const;

export function cleanCustomerName(name: string): string {
  return name.trim().replace(/\s+/gu, " ");
}

function normalize(name: string): string {
  return cleanCustomerName(name.toLowerCase()
    .replace(/[\u0591-\u05C7\p{Cf}]/gu, "")
    .replace(/[\p{P}\p{S}]/gu, "")
    .replace(/(\p{L})\1+/gu, "$1"));
}

const contextualWords = new Set(["שש", "שבע", "סבן", "עין"].map(normalize));
const words = new Set(CUSTOMER_NAME_BLOCKLIST.filter((entry) => !entry.includes(" "))
  .map(normalize).filter((entry) => !contextualWords.has(entry)));
const phrases = CUSTOMER_NAME_BLOCKLIST.filter((entry) => entry.includes(" "))
  .map((entry) => normalize(entry).replace(/\s/g, ""));

export function validateCustomerName(name: string, { context }: { context: "customer" | "staff" }): { ok: boolean } {
  const saved = cleanCustomerName(name);
  if ((saved.match(/\p{L}/gu)?.length ?? 0) < 2) return { ok: false };
  if (context === "staff") return { ok: true };
  if (/\p{N}/u.test(saved) || saved.length > 25 || saved.split(" ").length > 3 || /(\p{L})\1{2,}/u.test(name)) {
    return { ok: false };
  }
  const normalized = normalize(saved);
  const tokens = normalized.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const compact = normalized.replace(/\s/g, "");
  // Whole words only: זינגר/זיני/ביליה must never match a fragment.
  if (tokens.some((token) => words.has(token)) || words.has(compact) || phrases.includes(compact)) return { ok: false };
  const has = (word: string) => tokens.includes(normalize(word));
  // סבן and בת שבע are real names; only the joke combinations are blocked.
  if ((has("סבן") && has("סיקס")) || (has("שש") && has("שבע")) || (has("עין") && has("ביצת"))) return { ok: false };
  // אח and גבר are in `words`, so only standalone tokens are blocked.
  return { ok: true };
}