import { describe, it, expect } from "vitest";
import { validateCustomerName, cleanCustomerName, normalizeBlockedName } from "./nameValidation";

describe("customer name rules", () => {
  it.each(["זין על פ", "ז.י.ן", "זיןןן", "ניגר אידיוט", "אני הומו", "אוראל יומטוב המלך", "67", "נבו שחר6767", "שש שבעש שבע", "יכין אמיתי תצעק את השם שלי ותקבל טיפ", "י", "ייי", "asdasdasd", "שולץ הגבר"])("blocks %s", (name) => {
    expect(validateCustomerName(name, { context: "customer" }).ok).toBe(false);
  });
  it.each(["יובל זינגר", "בן זיני", "שושנה ביליה", "סבן", "בת שבע", "עדי קרסנטי אלביליה", "איתמר שמעון שחר", "Daniel corcos", "יהודית אביטבול", "זינגד", "אמלכההמלכה"])("allows %s", (name) => {
    expect(validateCustomerName(name, { context: "customer" }).ok).toBe(true);
  });
  it.each(["ז י ן", "ז-י_ן", "זִין", "ז\u200fין", "ז\u202eין", "זיין", "אבא של בוחבוט", "אבאשלבוחבוט", "שש שבע", "שששבע", "שבעש", "ביצת עין"])("blocks normalization/phrase %s", (name) => {
    expect(validateCustomerName(name, { context: "customer" }).ok).toBe(false);
  });
  it("requires two letters, not two characters", () => {
    expect(validateCustomerName("י!", { context: "customer" }).ok).toBe(false);
  });
  it("rejects any digits", () => {
    expect(validateCustomerName("אב12", { context: "customer" }).ok).toBe(false);
  });
  it("caps customer names at three words", () => {
    expect(validateCustomerName("דני לוי כהן עדי", { context: "customer" }).ok).toBe(false);
  });
  it("caps customer names at 25 characters", () => {
    expect(validateCustomerName("אב".repeat(13), { context: "customer" }).ok).toBe(false);
    expect(validateCustomerName("אב".repeat(12) + "ג", { context: "customer" }).ok).toBe(true);
  });
  it("rejects triple raw repetitions but allows double letters", () => {
    expect(validateCustomerName("ירדןןן", { context: "customer" }).ok).toBe(false);
    expect(validateCustomerName("אורןן", { context: "customer" }).ok).toBe(true);
  });
  it.each(["י", "67", "י!"])("staff requires two letters: %s", (name) => {
    expect(validateCustomerName(name, { context: "staff" }).ok).toBe(false);
  });
  it.each(["ייי", "נבו6767", "שולץ הגבר", "דני לוי כהן עדי", "אב".repeat(20)])("staff has no other restrictions: %s", (name) => {
    expect(validateCustomerName(name, { context: "staff" }).ok).toBe(true);
  });
  it("only trims and collapses whitespace for storage", () => {
    expect(cleanCustomerName("  Daniel   Corcos  ")).toBe("Daniel Corcos");
  });
  it.each(["בירן", "בירן גיי", "ביבי נתניהו", "עומר אדם", "היטלר", "Elon Musk", "יא חמור", "מטומטם", "כוס אמק", "דני בן זונה", "ליונל מסי", "טיילור סוויפט", "ג'ו ביידן", "ל.ב.ר.ו.ן", "fuck you"])("blocks celebrity/curse %s", (name) => {
    expect(validateCustomerName(name, { context: "customer" }).ok).toBe(false);
  });
  it.each(["עומר כהן", "נועה לוי", "אדם שמש", "יאיר כהן", "בנימין", "עומר", "דני", "שירה", "אפרת", "ערן", "שמואל", "דביר", "אסף", "משה פרץ", "אושר כהן", "יהודה לוי", "עקיבא", "עלמה ציגלר", "כלב", "נועה", "גל", "בר", "מריו"])("still allows real name %s", (name) => {
    expect(validateCustomerName(name, { context: "customer" }).ok).toBe(true);
  });
  it.each(["יותםיעכ", "אסףים רטבים", "שדגכ", "asdf", "qwerty", "אני הומו", "ליהי עם א", "הבקתה", "אבא"])("blocks gibberish / not-a-name %s", (name) => {
    expect(validateCustomerName(name, { context: "customer" }).ok).toBe(false);
  });
  it.each(["יואב שלי", "נדב שלי", "בדיקה", "כרמל", "ראם ערבה", "יותם רמון", "שי בירנבאום"])("allows %s", (name) => {
    expect(validateCustomerName(name, { context: "customer" }).ok).toBe(true);
  });
  it("blocks names the staff added from the kitchen", () => {
    const extra = [normalizeBlockedName("שולץ"), normalizeBlockedName("סמימי מכוער")];
    expect(validateCustomerName("שולץ", { context: "customer", extraBlocked: extra }).ok).toBe(false);
    expect(validateCustomerName("דני סמימי מכוער", { context: "customer", extraBlocked: extra }).ok).toBe(false);
    expect(validateCustomerName("יואב", { context: "customer", extraBlocked: extra }).ok).toBe(true);
  });
});
