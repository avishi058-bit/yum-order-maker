/**
 * Single source of truth for public-page SEO (title, description, canonical,
 * hreflang, JSON-LD, static crawler text). Used both at runtime (<Seo />) and
 * by the build-time prerender plugin in vite.config.ts - so keep this file
 * free of asset imports and "@/..." aliases.
 */
export const SITE_URL = "https://habikta-burger.com";

export type Faq = { q: string; a: string };
export type Section = { h2: string; paragraphs: string[] };

export interface SeoPage {
  path: string;
  lang: "he" | "en";
  title: string;
  description: string;
  alternates?: { hreflang: string; path: string }[];
  jsonLd?: unknown;
  /** Visible-on-load crawler text, rendered into #root before React mounts. */
  h1?: string;
  intro?: string;
  sections?: Section[];
  faq?: Faq[];
  links?: { href: string; label: string }[];
}

export const GROUPS_FAQ_HE: Faq[] = [
  {
    q: "איפה אוכלים צהריים בסיור בעוטף?",
    a: "הבקתה בכפר מימון (תושיה) נמצאת במרחק נסיעה קצר מאתר הנובה ומתקומה, ולכן משתלבת בקלות במסלול הסיור. מתאמים מראש בוואטסאפ, יש חניה קרובה לאוטובוסים, והשולחנות מוכנים כשהקבוצה מגיעה.",
  },
  {
    q: "מה גודל הקבוצה המינימלי והמקסימלי?",
    a: "קבוצה אצלנו מוגדרת מ-20 משתתפים ומעלה, ובהזמנה מראש אנחנו נערכים לאירוח והסעדה של עד 200 איש. קיבולת הישיבה הרגילה של הבקתה היא כ-35 איש, ולכן קבוצות גדולות יותר מקבלות היערכות מיוחדת בהתאם לגודל הקבוצה, מזג האוויר וסגנון האירוח שנבחר.",
  },
  {
    q: "מהו מינימום ההזמנה לקבוצה?",
    a: "מינימום ההזמנה לקבוצה הוא 2,000 ₪ כולל מע״מ. המסלולים מתומחרים לפי אדם ומאפשרים לבחור מראש את רמת האירוח בהתאם לתקציב ולצרכים של הקבוצה.",
  },
  {
    q: "כמה זמן לוקחת עצירת האוכל לקבוצה?",
    a: "כאשר קבוצה ממהרת והכול מתואם מראש, ניתן לסיים אצלנו עצירת אוכל מלאה בתוך כ-30-45 דקות ולהמשיך לתחנה הבאה בסיור.",
  },
  {
    q: "איפה האוטובוס עוצר?",
    a: "יש חניה קרובה ונוחה לאוטובוסים ליד הבקתה, כך שהמשתתפים יורדים בסמוך למקום ולא צריכים ללכת מרחק משמעותי.",
  },
  {
    q: "האם המקום כשר?",
    a: "הבקתה פועלת בכשרות רגילה בהשגחת הרבנות שדות נגב. קציצת ההמבורגר עצמה עשויה מבשר חלק רבנות והירקות הם גוש קטיף. תעודת הכשרות של המקום היא כשרות רגילה, בין היתר מכיוון שתוספת הרוסטביף האופציונלית אינה מבשר חלק.",
  },
  {
    q: "יש אפשרויות צמחוניות, טבעוניות או ללא גלוטן?",
    a: "קיימת אפשרות להמבורגר צמחוני/טבעוני, אך הוא מוכן על אותה פלנצ׳ה של הבשר. קיימת גם אפשרות ללחמנייה ללא גלוטן, אך ההכנה נעשית בסביבה שבה קיים גלוטן. לקבוצות עם רגישויות או העדפות מיוחדות מומלץ לעדכן אותנו מראש.",
  },
  {
    q: "האם המקום נגיש?",
    a: "הגישה למקום אפשרית גם עבור אדם בכיסא גלגלים ברובה, אך קיימת מדרגה קטנה ולכן אין להציג את המקום כנגיש באופן מלא ללא בדיקה פרטנית של צורכי הקבוצה. במקום קיימים שני תאי שירותים - לנשים ולגברים.",
  },
];

export const GROUPS_SECTIONS_HE: Section[] = [
  {
    h2: "ארוחת צהריים לקבוצות בסיור בעוטף",
    paragraphs: [
      "עצירת אוכל שמשתלבת במסלול: אנחנו עובדים בתיאום צמוד עם המדריך או המארגן, יודעים כמה אנשים מגיעים ומתי, והמטבח נערך מראש לשעת ההגעה. השולחנות מוכנים במתכונת שוק כשהאוטובוס נחה, ולקבוצות שממהרות אפשר לסיים עצירה של כ-30-45 דקות ולהמשיך בסיור.",
    ],
  },
  {
    h2: "איפה לאכול בסיור בעוטף – ליד הנובה ותקומה",
    paragraphs: [
      "הבקתה נמצאת בכפר מימון (תושיה) שבמועצה האזורית שדות נגב, במרחק נסיעה קצר מאתר הנובה, מתקומה וממגרש המכוניות השרופות. יש חניה קרובה ונוחה לאוטובוסים, מדשאות, עצים וסככה מקורה.",
    ],
  },
  {
    h2: "מסעדה לקבוצות ומשלחות בעוטף עזה",
    paragraphs: [
      "בהזמנה מראש אנחנו נערכים לאירוח והסעדה של קבוצות ומשלחות של עד 200 איש, כולל הוצאה של כמות גדולה של המבורגרים בזמן קצר. קבוצה מוגדרת מ-20 משתתפים, ומינימום ההזמנה הוא 2,000 ₪ כולל מע״מ.",
      "המסלולים מתומחרים לפי אדם ולפי תקציב - מארוחת המבורגר קלאסית של 220 גרם, דרך מסלולים מורחבים ו״הכל כלול״, ועד מסלול בשרים מלא עם אנטריקוט, פיקניה, עראיס וקבבים.",
    ],
  },
  {
    h2: "מסלולים ומחירים לקבוצות (לאדם, כולל מע״מ)",
    paragraphs: [
      "המסלול הקלאסי - 69 ₪ לאדם: המבורגר 220 גרם, צ׳יפס, ירקות טריים (חסה, עגבנייה, בצל, חמוצים) ורטבים בסקוויזרים.",
      "המסלול המשודרג - 82 ₪ לאדם: המבורגר 220 גרם, צ׳יפס, טבעות בצל ווופל צ׳יפס, פחית שתייה קרה וכד מים קרים עם קרח.",
      "המסלול המפנק - 109 ₪ לאדם: שילוב מטוגנים עשיר, פחית וכד מים, תוספות שולחן (בצל מטוגן, ריבת בצל, פלפלים, שום קונפי) וסלט פירות עונתיים לקינוח.",
      "הכל כלול - 139 ₪ לאדם: פתיחה של סוכריות עראיס על טחינה, שילוב מטוגנים מלא, שתייה חופשית, תוספות שולחן כולל ביצת עין, וסלט פירות.",
      "מסלול הבשרים - 250 ₪ לאדם: כחצי ק״ג בשר לאדם - אנטריקוט, פיקניה, חצאי עראיס, קבבים, לבבות עוף ופרגית, עם מטוגנים, צ׳ימיצ׳ורי, סלטים ושתייה.",
      "קבוצה מ-20 משתתפים, עד 200 בהזמנה מראש, מינימום הזמנה 2,000 ₪ כולל מע״מ. יש חלופות לצמחונים וללא גלוטן. תיאום בוואטסאפ: 058-4633555.",
    ],
  },
];

export const GROUPS_FAQ_EN: Faq[] = [
  {
    q: "Where can a group eat lunch on a Gaza Envelope tour?",
    a: "HaBikta is in Kfar Maimon (Tushiya), a short drive from the Nova festival site and Tkuma. Book ahead on WhatsApp, the bus parks right next to us, and the tables are set when your group arrives.",
  },
  {
    q: "What group sizes do you host?",
    a: "Groups start at 20 people, and with advance booking we can host and feed up to 200. Our regular seating is about 35, so larger groups get a dedicated setup based on size, weather and the style of hosting you choose.",
  },
  {
    q: "Is there a minimum order?",
    a: "The minimum for a group is ₪2,000 including VAT. Menus are priced per person, so the guide or organizer can pick the level of hospitality that fits the budget.",
  },
  {
    q: "How long does the lunch stop take?",
    a: "When everything is arranged in advance, a group in a hurry can finish a full meal in about 30-45 minutes and move on to the next stop.",
  },
  {
    q: "Is the food kosher?",
    a: "Yes. HaBikta operates under regular kosher supervision of the Sdot Negev rabbinate. The burger patty itself is made from glatt (chalak) beef; the certificate is regular kosher because the optional roast-beef topping is not glatt.",
  },
  {
    q: "Do you have vegetarian, vegan or gluten-free options?",
    a: "There is a vegetarian/vegan burger, cooked on the same griddle as the meat, and a gluten-free bun prepared in an environment where gluten is present. Please let us know about dietary needs in advance.",
  },
  {
    q: "Is the place accessible?",
    a: "Most of the site is reachable by wheelchair, but there is a small step, so please check your group's specific needs with us. There are separate restrooms for women and men.",
  },
];

export const GROUPS_SECTIONS_EN: Section[] = [
  {
    h2: "Group lunch on a Gaza Envelope tour",
    paragraphs: [
      "A lunch stop that fits your itinerary: we coordinate closely with the guide or organizer, know how many people are coming and when, and the kitchen gets ready for your arrival time. Tables are set family-style as the bus pulls in, and a group in a hurry can be done in about 30-45 minutes.",
    ],
  },
  {
    h2: "Where to eat near the Nova site and Tkuma",
    paragraphs: [
      "We are in Kfar Maimon (Tushiya) in the Sdot Negev Regional Council, a short drive from the Nova festival site, Tkuma and the burnt-cars memorial site. There is convenient bus parking right next to us, lawns, shade trees and a covered pergola.",
    ],
  },
  {
    h2: "A restaurant for groups and delegations in the Otef",
    paragraphs: [
      "With advance booking we host groups and delegations of up to 200 people. We've welcomed groups from the US, Canada and China. Groups start at 20 people, with a ₪2,000 minimum including VAT.",
      "Menus are priced per person and by budget - from a classic 220 g burger meal, through extended and all-inclusive menus, to a full grill menu with entrecôte, picanha, arayes and kebabs.",
    ],
  },
  {
    h2: "Group menus and prices (per person, VAT included)",
    paragraphs: [
      "Classic - ₪69 per person: 220 g burger, fries, fresh vegetables (lettuce, tomato, onion, pickles) and squeeze-bottle sauces.",
      "Upgraded - ₪82 per person: 220 g burger, fries, onion rings and waffle fries, a cold canned drink and a jug of iced water.",
      "Premium - ₪109 per person: a rich mix of fries, a drink and iced water, table extras (fried onion, onion jam, peppers, garlic confit) and seasonal fruit salad.",
      "All inclusive - ₪139 per person: arayes bites on tahini to start, the full fries mix, unlimited soft drinks, table extras including a fried egg, and fruit salad.",
      "Meat feast - ₪250 per person: about half a kilo of meat per person - entrecôte, picanha, arayes, kebabs, chicken hearts and chicken thigh, with fries, chimichurri, salads and drinks.",
      "Groups from 20 people, up to 200 with advance booking, ₪2,000 minimum including VAT. Vegetarian and gluten-free alternatives available. Book on WhatsApp: +972-58-463-3555.",
    ],
  },
];

const ADDRESS_HE = {
  "@type": "PostalAddress",
  streetAddress: "דרך ערבי נחל 21, תושיה",
  addressLocality: "כפר מימון (תושיה)",
  addressRegion: "מועצה אזורית שדות נגב",
  postalCode: "8523000",
  addressCountry: "IL",
};

const GEO = { "@type": "GeoCoordinates", latitude: 31.4347276, longitude: 34.5416983 };
const SAME_AS = [
  "https://www.instagram.com/habikta_burgers/",
  "https://www.tiktok.com/@habikta",
];
const AREA_SERVED = ["עוטף עזה", "Gaza Envelope", "שדות נגב", "כפר מימון", "תושיה", "תקומה", "אתר הנובה", "Nova festival site"];
const GROUP_MENUS = [
  { name: "המסלול הקלאסי / Classic", price: 69 },
  { name: "המסלול המשודרג / Upgraded", price: 82 },
  { name: "המסלול המפנק / Premium", price: 109 },
  { name: "הכל כלול / All inclusive", price: 139 },
  { name: "מסלול הבשרים / Meat feast", price: 250 },
];
const groupOffers = {
  "@type": "OfferCatalog",
  name: "Group lunch menus / מסלולי אירוח לקבוצות",
  itemListElement: GROUP_MENUS.map((m) => ({
    "@type": "Offer",
    name: m.name,
    price: m.price,
    priceCurrency: "ILS",
    eligibleQuantity: { "@type": "QuantitativeValue", minValue: 20, maxValue: 200, unitText: "people" },
    priceSpecification: { "@type": "UnitPriceSpecification", price: m.price, priceCurrency: "ILS", unitText: "per person", valueAddedTaxIncluded: true },
  })),
};

const faqLd = (faq: Faq[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
});

const GROUPS_ALTERNATES = [
  { hreflang: "he", path: "/groups" },
  { hreflang: "en", path: "/en/groups" },
  { hreflang: "x-default", path: "/groups" },
];

export const SEO_PAGES = {
  groups: {
    path: "/groups",
    lang: "he",
    title: "אוכל לקבוצות בסיור בעוטף עזה | ארוחת צהריים בהבקתה, כפר מימון",
    description:
      "מארגנים סיור בעוטף? הבקתה בכפר מימון – ארוחת צהריים לקבוצות ומשלחות בין תקומה לאתר הנובה. עד 200 איש, כשר, עצירה של 30-45 דק'. דברו איתנו בוואטסאפ.",
    alternates: GROUPS_ALTERNATES,
    h1: "המקום לאכול בו בסיור בעוטף",
    intro: "אירוח קבוצות, משלחות וסיורים - עד 200 איש, בתיאום מראש, בלי לשבור את לוח הזמנים.",
    sections: GROUPS_SECTIONS_HE,
    faq: GROUPS_FAQ_HE,
    links: [
      { href: "/en/groups", label: "English" },
      { href: "/otef-aza", label: "המבורגר בעוטף עזה" },
      { href: "/", label: "לתפריט ולהזמנה" },
    ],
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Restaurant",
        name: "הבקתה - המבורגר של מושבניקים",
        description:
          "מסעדת המבורגרים כשרה בכפר מימון שבמועצה האזורית שדות נגב, בלב עוטף עזה, המארחת קבוצות, משלחות וסיורים בתיאום מראש.",
        url: `${SITE_URL}/groups`,
        telephone: "+972584633555",
        logo: `${SITE_URL}/icons/icon-512.png`,
        image: `${SITE_URL}/icons/icon-512.png`,
        geo: GEO,
        sameAs: SAME_AS,
        areaServed: AREA_SERVED,
        servesCuisine: ["המבורגרים", "Burgers"],
        acceptsReservations: true,
        priceRange: "₪₪",
        address: ADDRESS_HE,
        maximumAttendeeCapacity: 200,
        hasOfferCatalog: groupOffers,
        keywords: "איפה לאכול בסיור בעוטף, ארוחת צהריים לקבוצות בעוטף עזה, מסעדה ליד אתר הנובה, where to eat Gaza Envelope tour, lunch near Nova festival site, kosher restaurant Otef",
      },
      faqLd(GROUPS_FAQ_HE),
    ],
  },
  groupsEn: {
    path: "/en/groups",
    lang: "en",
    title: "Lunch for Groups on a Gaza Envelope Tour | HaBikta Burger, Kfar Maimon",
    description:
      "Organizing a Gaza Envelope (Otef Aza) tour? HaBikta in Kfar Maimon hosts groups and delegations near the Nova site and Tkuma – up to 200 people, kosher, 30-45 min lunch stop. WhatsApp us.",
    alternates: GROUPS_ALTERNATES,
    h1: "Where to eat on your Gaza Envelope tour",
    intro: "Lunch for groups, delegations and tours - up to 200 people, booked in advance, without breaking your schedule.",
    sections: GROUPS_SECTIONS_EN,
    faq: GROUPS_FAQ_EN,
    links: [{ href: "/groups", label: "עברית" }],
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Restaurant",
        name: "HaBikta Burger",
        description:
          "Kosher burger restaurant in Kfar Maimon, Sdot Negev, in the Gaza Envelope, hosting tour groups and delegations by advance booking.",
        url: `${SITE_URL}/en/groups`,
        telephone: "+972584633555",
        logo: `${SITE_URL}/icons/icon-512.png`,
        image: `${SITE_URL}/icons/icon-512.png`,
        geo: GEO,
        sameAs: SAME_AS,
        areaServed: AREA_SERVED,
        servesCuisine: ["Burgers"],
        acceptsReservations: true,
        priceRange: "₪₪",
        address: {
          "@type": "PostalAddress",
          streetAddress: "21 Arvei Nahal Rd, Tushiya",
          addressLocality: "Kfar Maimon (Tushiya)",
          addressRegion: "Sdot Negev Regional Council",
          postalCode: "8523000",
          addressCountry: "IL",
        },
        maximumAttendeeCapacity: 200,
        hasOfferCatalog: groupOffers,
        keywords: "איפה לאכול בסיור בעוטף, ארוחת צהריים לקבוצות בעוטף עזה, מסעדה ליד אתר הנובה, where to eat Gaza Envelope tour, lunch near Nova festival site, kosher restaurant Otef",
      },
      faqLd(GROUPS_FAQ_EN),
    ],
  },
  otefAza: {
    path: "/otef-aza",
    lang: "he",
    title: "המבורגר בעוטף עזה - הבקתה, כפר מימון (תושיה)",
    description:
      "המבורגר בעוטף עזה – הבקתה בכפר מימון (תושיה): המבורגר 220 גרם, כשר, אווירה כפרית, אירוח קבוצות בסיור בעוטף ועצירה ליד יער שוקדה בדרום אדום.",
    links: [
      { href: "/groups", label: "אוכל לקבוצות בסיור בעוטף ←" },
      { href: "/", label: "להזמנה ←" },
    ],
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Restaurant",
      name: "הבקתה - המבורגר של מושבניקים",
      url: `${SITE_URL}/otef-aza`,
      telephone: "+972584633555",
        logo: `${SITE_URL}/icons/icon-512.png`,
        image: `${SITE_URL}/icons/icon-512.png`,
        geo: GEO,
        sameAs: SAME_AS,
        areaServed: AREA_SERVED,
      servesCuisine: ["המבורגרים", "Burgers"],
      acceptsReservations: true,
      address: ADDRESS_HE,
    },
  },
  otefTourLunch: {
    path: "/otef-tour-lunch",
    lang: "he",
    title: "איפה לאכול בסיור בעוטף עזה | עצירת צהריים לקבוצות - הבקתה, כפר מימון",
    description:
      "מתכננים סיור בעוטף? הבקתה בכפר מימון - 8 דק׳ מתקומה ו-13 דק׳ מאתר הנובה. עצירת צהריים לקבוצות של 20-200 איש, כשר, 30-45 דקות, מסלולים מ-69 ₪ לאדם.",
    h1: "איפה לאכול בסיור בעוטף עזה",
    intro:
      "מארגנים סיור בעוטף ומחפשים איפה לעצור לצהריים עם הקבוצה? הבקתה בכפר מימון (תושיה) נמצאת בלב מסלול הסיור - כ-8 דקות מתקומה וכ-13 דקות מאתר הנובה - מארחת קבוצות של 20 עד 200 איש בתיאום מראש, ומאפשרת לסיים עצירת צהריים מלאה בכ-30-45 דקות.",
    sections: [
      {
        h2: "התחנות המקובלות בסיור בעוטף",
        paragraphs: [
          "רוב הסיורים בעוטף עוברים בחלק מהתחנות האלה: אתר הנובה ליד רעים, מגרש המכוניות השרופות בתקומה, הקיבוצים כפר עזה, בארי ונחל עוז, והעיר שדרות.",
          "הבקתה נמצאת בדיוק בלב מסלול הסיור: כ-8 דקות נסיעה מתקומה, כ-13 דקות מאתר הנובה וכ-15 דקות משדרות. היא בתוך מושב, כך שלא מבזבזים זמן על פקקים בעיר או על חיפוש חניה לאוטובוס - עוצרים לצהריים תוך כדי המסלול וממשיכים.",
        ],
      },
      {
        h2: "איך נראית עצירת הצהריים",
        paragraphs: [
          "1. מתאמים מראש בוואטסאפ את מספר המשתתפים, התאריך ושעת ההגעה.",
          "2. בוחרים מסלול אוכל לפי התקציב.",
          "3. ביום הסיור המדריך מעדכן כשהאוטובוס בדרך, והמטבח מתזמן את האוכל לשעת ההגעה.",
          "4. האוטובוס עוצר מול הבקתה, ושולחן השוק כבר ערוך: ההמבורגרים, המטוגנים, הירקות והרטבים, וכל אחד בונה לעצמו את המנה.",
          "5. אוכלים על הדשא, בצל העצים או בסככה המקורה, וממשיכים לתחנה הבאה.",
        ],
      },
      {
        h2: "מה מגישים וכמה זה עולה",
        paragraphs: [
          "חמישה מסלולים, מחיר לאדם כולל מע״מ: הקלאסי 69 ₪, המשודרג 82 ₪, המפנק 109 ₪, הכל כלול 139 ₪ ומסלול הבשרים 250 ₪. בכל מסלול יש המבורגר 220 גרם, והמסלולים המורחבים מוסיפים מטוגנים, שתייה, תוספות שולחן וקינוח. מינימום הזמנה 2,000 ₪ כולל מע״מ. הפירוט המלא בדף הקבוצות.",
        ],
      },
      {
        h2: "כשרות והתאמות",
        paragraphs: [
          "כשר בהשגחת רבנות שדות נגב. יש חלופות לצמחונים וללא גלוטן - מומלץ לעדכן מראש כמה מנות צריך.",
        ],
      },
      {
        h2: "תיאום",
        paragraphs: ["וואטסאפ 058-4633555. דרך ערבי נחל 21, תושיה (כפר מימון)."],
      },
    ],
    links: [
      { href: "/groups", label: "מסלולים ותיאום לקבוצות ←" },
      { href: "/en/groups", label: "English" },
      { href: "/otef-aza", label: "המבורגר בעוטף עזה" },
    ],
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "איפה לאכול בסיור בעוטף עזה",
      inLanguage: "he",
      url: `${SITE_URL}/otef-tour-lunch`,
      image: `${SITE_URL}/icons/icon-512.png`,
      author: { "@type": "Organization", name: "המבורגר הבקתה", url: `${SITE_URL}/` },
      publisher: { "@type": "Organization", name: "המבורגר הבקתה", logo: { "@type": "ImageObject", url: `${SITE_URL}/icons/icon-512.png` } },
      datePublished: "2026-10-27",
      about: {
        "@type": "Restaurant",
        name: "הבקתה - המבורגר של מושבניקים",
        url: `${SITE_URL}/groups`,
        telephone: "+972584633555",
        address: ADDRESS_HE,
        geo: GEO,
        servesCuisine: ["המבורגרים", "Burgers"],
        maximumAttendeeCapacity: 200,
        hasOfferCatalog: groupOffers,
      },
    },
  },
  home: {
    path: "/",
    lang: "he",
    title: "המבורגר הבקתה 🚜 - אתר הזמנות",
    description: "הַבִּקְתָה - המבורגר של מושבניקים להזמנות לחצו 👇🏻",
  },
} satisfies Record<string, SeoPage>;

export const absUrl = (path: string) => `${SITE_URL}${path === "/" ? "/" : path}`;
