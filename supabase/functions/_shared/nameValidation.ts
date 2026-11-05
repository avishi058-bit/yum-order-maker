export const CUSTOMER_NAME_MESSAGE = "בבקשה לכתוב את השם האמיתי שלכם ולכבד את המקום...";
// Shown in the browser from the second invalid attempt onward.
export const CUSTOMER_NAME_REPEAT_MESSAGE = "הגיע הזמן להתבגר חבר… בבקשה את השם האמיתי :)";
export const STAFF_NAME_MESSAGE = "יש לכתוב לפחות 2 אותיות";

// One list for browser and server. Context-sensitive words are handled below.
export const CUSTOMER_NAME_BLOCKLIST = [
  "זין", "הזין", "אידיוט", "ניגר", "הומו", "ההומו", "גיי", "מכוער", "רצח", "השמן", "אחושרמוטה", "שרמוטה", "המוזרה", "זונה", "מניאק", "כוס", "חרא", "המלך", "המלכה", "ימלמלמלך", "הגבר", "גבר", "המתוקי", "החמוד", "והקטן", "היפה", "הארנב", "סקיבידי", "שליטא", "טיפ", "תצעק", "בבקשה", "תודה", "הצלחה", "מבורך", "אח", "טעים", "בצד", "מנה", "ביצת", "עין", "עגבניה", "אקסטרה", "קסטרה", "חמוצים", "רטבים", "שש", "שבע", "שבכ", "שבעש", "שששבע", "סיקס", "סבן", "לברון", "גיימס", "זדורוב", "דרייק", "היהודים", "הזויות", "בנות", "פאדייי", "test", "asdasdasd", "tnt", "tchah", "dragonfly", "sixseven",
  "סיקס סבן", "אבא של בוחבוט", "אבו פאדייי", "שבוע טוב ומבורך", "חברות הזויות", "רומן זדורוב", "לברון גיימס", "עלמה ציגלר דרייק ברנץ", "אאאא", "אא", "ננ", "נננ", "עגג", "עחמ", "חחו", "עאהא", "יכנכנע", "יניכחד", "יותםיעכ", "שחחח", "אליאבם מלחחחח", "שיםחמוצים", "אסףים רטבים", "סתיוקסטרה עגבניה", "יהלש עם ביצת עין", "דבוש מנה בצד", "אורי היימןהצלחה", "חנוחילהואלה שיהיה טעים אח",
  // Nicknames and specific names Avishai asked to block.
  "בירן",
  // Curses, slurs and insults (whole words only).
  "זונות", "זיון", "זיונים", "מזדיין", "מזדיינת", "תזדיין", "שרמוטות", "מניאקית", "כוסאמק", "כוסעמק", "כוסאמא", "כוסאוכתק", "אמק", "אחותק", "חרה",
  "מטומטם", "מטומטמת", "דביל", "דבילית", "אהבל", "סתום", "סתומה", "טמבל", "אפס", "לוזר", "מפגר", "מפגרת", "שמנה", "מכוערת", "קוקסינל", "ערס", "פרחה",
  "כלבה", "חזיר", "חזירה", "קוף", "עכבר", "חמור", "נאצי", "מחבל", "גיהאד", "ערבוש", "כושי", "פרענק", "צחצח", "נבלה", "חלאה", "זבל", "מסריח", "מסריחה", "טיפש", "טיפשה", "הומואים",
  "בליאט", "סוקה", "פידור", "fuck", "fucker", "fucking", "motherfucker", "shit", "bitch", "asshole", "cunt", "dick", "pussy", "slut", "whore", "nigger", "nigga", "faggot", "fag", "retard", "idiot", "stupid", "loser", "gay", "homo", "sex", "porn",
  "יא חמור", "בן זונה", "בת זונה", "כוס אמק", "כוס עמק", "כוס אמא", "לך תזדיין", "חולה נפש", "רוסי מסריח", "אשכנזי מסריח",
] as const;

// Celebrities, politicians and characters. Multi-word entries block only when
// every word appears, so a real "נועה" or "עומר" alone is never affected.
export const CELEBRITY_NAMES = [
  // Single words that are never a real customer's given name.
  "היטלר", "hitler", "סינוואר", "נסראללה", "האניה", "ספיידרמן", "spiderman", "באטמן", "batman", "סופרמן", "superman", "שרק", "shrek", "פיקאצו", "pikachu",
  "ביונסה", "beyonce", "ריהאנה", "rihanna", "רונאלדו", "ronaldo", "נימאר", "neymar", "מסי", "messi", "טראמפ", "trump", "ביידן", "biden", "מאסק", "musk", "ביבי", "mrbeast", "ishowspeed", "סקיבידיטוילט",
  // Israeli politicians.
  "ביבי נתניהו", "בנימין נתניהו", "נתניהו", "יאיר לפיד", "בני גנץ", "נפתלי בנט", "איתמר בן גביר", "בן גביר", "בצלאל סמוטריץ", "סמוטריץ", "אביגדור ליברמן", "ליברמן", "יצחק הרצוג", "מירי רגב", "אריה דרעי", "יולי אדלשטיין", "יאיר גולן", "גדי איזנקוט",
  // Israeli singers, actors, TV and influencers.
  "עומר אדם", "עדן בן זקן", "נועה קירל", "אייל גולן", "שרית חדד", "מאיר בנאי", "ליאור נרקיס", "אנה זק", "סטטיק", "בן אל תבורי", "עדן חסון",  "גל גדות", "אסי עזר", "רותם סלע", "אברי גלעד",
  "עומר בן שושן", "בר רפאלי", "עידן רייכל", "שלמה ארצי", "אביב גפן", "אגם בוחבוט", "נסרין קדרי", "מורן מזור", "שחר חסון", "ששון גבאי", "ליאור אשכנזי", "יהורם גאון", "דודו טסה", "עדן אלנה", 
  "רביב כנר", "עוז זהבי", "הצל", "יואב אליאסי", "גיא פינס", "אורנה בנאי", "פאר טסי", "ישי ריבו", "חנן בן ארי", 
  // Israeli athletes.
  "ערן זהבי", "מאור בוזגלו", "דני אבדיה", "עומרי כספי", "תומר חמד", "מנור סולומון", "אורן סמדג", "ארטיום דולגופיאט", "לינוי אשרם",
  // International.
  "לברון גיימס", "לברון", "lebron", "lebron james", "ליונל מסי", "lionel messi", "כריסטיאנו רונאלדו", "cristiano ronaldo", "קיליאן אמבפה", "אמבפה", "mbappe", "ארלינג הולנד",
  "אילון מאסק", "elon musk", "דונלד טראמפ", "donald trump", "גו ביידן", "joe biden", "ברק אובמה", "obama", "אובמה", "ולדימיר פוטין", "פוטין", "putin", "זלנסקי", "zelensky", "קים גונג און", "kim jong un",
  "טיילור סוויפט", "taylor swift", "קניה ווסט", "kanye west", "kanye", "בילי אייליש", "billie eilish", "סלנה גומז", "selena gomez", "מייקל גקסון", "michael jackson", "גסטין ביבר", "justin bieber", "ביבר", "bieber",
  "קים קרדשיאן", "kim kardashian", "קרדשיאן", "kardashian", "מיסטר ביסט", "mr beast", "ספיד", "speed", "אדריאנה לימה", "סנופ דוג", "snoop dogg", "אמינם", "eminem", "טופאק", "tupac", "דרייק", "drake", "טרוויס סקוט", "travis scott",
  "בן לאדן", "bin laden", "יחיא סינוואר", "חסן נסראללה", "איסמעיל האניה", "אדולף היטלר", "adolf hitler", "סטלין", "stalin", "מוסוליני",
  "הארי פוטר", "harry potter", "בוב ספוג", "spongebob", "סופר מריו", "super mario", "גון סנה", "john cena", "ריק אסטלי", "rick astley", "גיימס בונד", "james bond", "דארת ויידר", "darth vader", "גוקר", "joker", "תומאס שלבי", "thomas shelby", "וולטר וייט", "walter white",
  "רומן זדורוב", "עלמה ציגלר", "כריסטיאנו", "cristiano", "סקיבידי",
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
const celebrityWords = new Set(CELEBRITY_NAMES.filter((entry) => !entry.includes(" ")).map(normalize));
const celebrityGroups = CELEBRITY_NAMES.filter((entry) => entry.includes(" ")).map((entry) => normalize(entry).split(" "));

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
  // Multi-word curses typed inside a longer name, e.g. "דני בן זונה".
  if (phrases.some((phrase) => phrase.length > 3 && compact.includes(phrase))) return { ok: false };
  if (tokens.some((token) => celebrityWords.has(token)) || celebrityWords.has(compact)) return { ok: false };
  if (celebrityGroups.some((group) => group.every((word) => tokens.includes(word)) || compact === group.join(""))) return { ok: false };
  const has = (word: string) => tokens.includes(normalize(word));
  // סבן and בת שבע are real names; only the joke combinations are blocked.
  if ((has("סבן") && has("סיקס")) || (has("שש") && has("שבע")) || (has("עין") && has("ביצת"))) return { ok: false };
  // אח and גבר are in `words`, so only standalone tokens are blocked.
  return { ok: true };
}