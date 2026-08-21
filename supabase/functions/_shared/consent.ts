// Legal consent proof ("clickwrap digital signature").
//
// Every explicit customer approval is persisted in public.consent_events with
// the exact wording that was displayed, a version tag, timestamp, IP and
// user-agent — so the business can prove after the fact that the customer
// read and approved it.

export const CONSENT_TEXTS = {
  terms: {
    version: "terms-v1",
    text:
      "אני מאשר/ת שקראתי והבנתי את תנאי השימוש ואת מדיניות הפרטיות של המבורגר הבקתה, " +
      "ואני מסכים/ה להם. האישור ניתן במסך סיום ההזמנה לפני התשלום.",
  },
  gluten_free: {
    version: "gluten-v1",
    text:
      "אני מאשר/ת שקראתי והבנתי כי לחמנייה ללא גלוטן מוכנה במטבח שבו מטופלים מוצרים המכילים גלוטן, " +
      "המנה אינה סטרילית ב-100% מגלוטן וייתכן זיהום צולב. כמו כן הובהר לי שהצ׳יפס מטוגן בשמן " +
      "שבו מטוגנים גם מוצרים המכילים גלוטן, ושטבעות בצל / טבעות בצל בטמפורה / שבבי בצל קריספי " +
      "מכילים גלוטן ואינם ניתנים להזמנה עם לחמנייה ללא גלוטן. ההזמנה בוצעה על אחריותי.",
  },
} as const;

export type ConsentKind = keyof typeof CONSENT_TEXTS;

interface RecordConsentArgs {
  supabase: { from: (t: string) => { insert: (v: unknown) => Promise<{ error: unknown }> } };
  kind: ConsentKind;
  phone?: string | null;
  customerName?: string | null;
  orderId?: string | null;
  itemRef?: string | null;
  source?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt?: string | null;
}

export async function recordConsent(args: RecordConsentArgs): Promise<void> {
  const def = CONSENT_TEXTS[args.kind];
  try {
    const { error } = await args.supabase.from("consent_events").insert({
      consent_type: args.kind,
      action: "granted",
      method: "clickwrap",
      consent_text_version: def.version,
      consent_text: def.text,
      phone: args.phone || null,
      customer_name: args.customerName || null,
      order_id: args.orderId || null,
      item_ref: args.itemRef || null,
      source: args.source || null,
      ip_address: args.ip || null,
      user_agent: args.userAgent || null,
      ...(args.createdAt ? { created_at: args.createdAt } : {}),
    });
    if (error) console.error("consent insert failed", args.kind, error);
  } catch (e) {
    console.error("consent insert threw", args.kind, e);
  }
}
