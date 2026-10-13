import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Phone,
  MapPin,
  Users,
  Clock,
  Utensils,
  Bus,
  Leaf,
  Shield,
  Trees,
  Globe2,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import PressSection from "@/components/PressSection";
import logo from "@/assets/habikta-logo.jpeg.asset.json";
import heroBurger from "@/assets/hero-burger.webp";
import event1 from "@/assets/events/event1.jpeg.asset.json";
import event2 from "@/assets/events/event2.jpeg.asset.json";
import event3 from "@/assets/events/event3.jpeg.asset.json";
import event4 from "@/assets/events/event4.jpeg.asset.json";
import event5 from "@/assets/events/event5.jpeg.asset.json";
import arayes from "@/assets/menu/arayes-special-opt.webp";
import { GROUPS_BOOKING_ENABLED, GROUPS_WHATSAPP_URL } from "@/data/groupsContact";
import { uiPositions } from "@/config/uiConfig";

const PHONE = "058-4633555";
const WHATSAPP = GROUPS_WHATSAPP_URL;
const WAZE = "https://waze.com/ul?q=דרך%20ערבי%20נחל%2023%20תושיה";

/** Waze navigation link - same address used across the ordering screens */
const WazeLink = ({ className = "" }: { className?: string }) => (
  <a
    href={WAZE}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="נווטו אלינו עם Waze"
    className={`inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-sm font-bold ${className}`}
  >
    <img src="/waze-icon.png" alt="" aria-hidden="true" className="w-4 h-4 rounded" />
    נווטו אלינו
  </a>
);

const WhatsAppIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={`${className} text-green shrink-0`} fill="currentColor" aria-hidden="true">
    <path d="M20.52 3.48A11.9 11.9 0 0 0 12.05 0C5.48 0 .13 5.35.13 11.92c0 2.1.55 4.15 1.6 5.96L0 24l6.25-1.64a11.9 11.9 0 0 0 5.8 1.48h.01c6.57 0 11.92-5.35 11.92-11.92 0-3.18-1.24-6.18-3.46-8.44ZM12.06 21.8a9.86 9.86 0 0 1-5.03-1.38l-.36-.22-3.71.98.99-3.62-.24-.37a9.85 9.85 0 0 1-1.51-5.27c0-5.46 4.44-9.9 9.9-9.9a9.84 9.84 0 0 1 7 2.9 9.84 9.84 0 0 1 2.9 7c0 5.46-4.44 9.9-9.94 9.88Zm5.43-7.41c-.3-.15-1.76-.87-2.03-.97-.28-.1-.48-.15-.68.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.64-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.09 4.48.71.31 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
  </svg>
);

const WhatsAppButton = ({ className = "" }: { className?: string }) => (
  <Button asChild size="lg" className={`h-auto min-h-12 whitespace-normal border border-green bg-card text-foreground hover:bg-card/90 text-base font-bold ${className}`}>
    <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">
      <WhatsAppIcon /> דברו איתנו בוואטסאפ
    </a>
  </Button>
);

/** Subtle text link - used instead of the big button everywhere except the hero and floating chip */
const WhatsAppTextLink = ({ label = "לתיאום בוואטסאפ", light = false }: { label?: string; light?: boolean }) => (
  <a
    href={WHATSAPP}
    target="_blank"
    rel="noopener noreferrer"
    className={`inline-flex items-center gap-1.5 font-bold underline underline-offset-4 hover:opacity-80 ${light ? "text-primary-foreground" : "text-primary"}`}
  >
    <WhatsAppIcon className="w-4 h-4" />
    {label}
  </a>
);

const LeadForm = ({ id }: { id: string }) => {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [guests, setGuests] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!GROUPS_BOOKING_ENABLED) return;
    if (!fullName.trim() || phone.trim().length < 6) {
      toast.error("נא למלא שם וטלפון");
      return;
    }
    setSending(true);
    const { error } = await (supabase as any).from("event_leads").insert({
      full_name: fullName.trim(),
      phone: phone.trim(),
      group_type: null,
      guests_count: guests ? Number(guests) : null,
      preferred_date: date || null,
      notes: notes.trim() || null,
    });
    setSending(false);
    if (error) {
      toast.error("השליחה נכשלה, אפשר להתקשר אלינו ישירות");
      return;
    }
    setSent(true);
    toast.success("הפרטים נשלחו - נחזור אליכם בהקדם");
  };

  if (sent) {
    return (
      <Card id={id} className="border-primary/40 shadow-lg">
        <CardContent className="p-6 text-center space-y-2">
          <p className="text-xl font-black">קיבלנו את הפרטים 🙌</p>
          <p className="text-muted-foreground">נחזור אליכם בהקדם. אם זה דחוף, אפשר להתקשר {PHONE}.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id={id} className="scroll-mt-24 shadow-lg border-primary/20">
      <CardHeader>
        <CardTitle className="text-2xl">השאירו פרטים ונחזור אליכם</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`${id}-name`}>שם</Label>
              <Input id={`${id}-name`} value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} required />
            </div>
            <div>
              <Label htmlFor={`${id}-phone`}>טלפון</Label>
              <Input id={`${id}-phone`} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={25} required />
            </div>
            <div>
              <Label htmlFor={`${id}-guests`}>מספר משתתפים</Label>
              <Input id={`${id}-guests`} type="number" min={1} max={2000} value={guests} onChange={(e) => setGuests(e.target.value.replace(/^0+/, ""))} />
            </div>
            <div>
              <Label htmlFor={`${id}-date`}>תאריך משוער</Label>
              <Input id={`${id}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor={`${id}-notes`}>הודעה / הערות</Label>
            <Textarea id={`${id}-notes`} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="שעת הגעה משוערת, מסלול הסיור, תקציב, צרכים מיוחדים" />
          </div>
          <Button type="submit" size="lg" className="w-full text-lg h-14" disabled={sending}>
            {sending ? "שולח..." : "שלחו פרטים"}
          </Button>
          <p className="text-xs text-muted-foreground">
            הפרטים משמשים אותנו רק ליצירת קשר בנוגע לפנייה. ראו <Link to="/privacy" className="underline">מדיניות פרטיות</Link>.
          </p>
        </form>
      </CardContent>
    </Card>
  );
};

/** Big photo card in the style of a tours landing page: image + title tag + short blurb + CTA */
const PhotoCard = ({
  image,
  title,
  text,
  ctaLabel,
  href,
}: {
  image: string;
  title: string;
  text: string;
  ctaLabel: string;
  href: string;
}) => (
  <article className="overflow-hidden rounded-3xl bg-card border border-border shadow-sm hover:shadow-xl transition-shadow">
    <div className="relative">
      <img
        src={image}
        alt={title}
        loading="lazy"
        className="w-full h-56 md:h-72 object-cover"
      />
      <h3 className="absolute bottom-4 right-0 bg-foreground/85 text-background text-xl md:text-2xl font-black px-5 py-2 rounded-r-none rounded-l-xl backdrop-blur-sm">
        {title}
      </h3>
    </div>
    <div className="p-5 space-y-4">
      <p className="text-muted-foreground leading-relaxed">{text}</p>
      {GROUPS_BOOKING_ENABLED ? (
        <Button asChild size="lg" className="w-full text-base">
          <a href={href}>{ctaLabel}</a>
        </Button>
      ) : <div className="flex justify-center"><WhatsAppTextLink /></div>}
    </div>
  </article>
);

const CARDS = [
  {
    image: event2.url,
    title: "קבוצות בסיור בעוטף",
    text: "עצירת צהריים שמשתלבת במסלול - חניה קרובה ונוחה לאוטובוסים, המטבח נערך מראש, ובתיאום מתאים אפשר לסיים תוך 30-45 דקות ולהמשיך הלאה.",
    ctaLabel: "לתאם עצירה לקבוצה",
    href: "#lead-top",
  },
  {
    image: heroBurger,
    title: "המבורגר 220 גרם",
    text: "קציצה עבה ועסיסית מתערובת בקר איכותית, עם צ׳יפס, וופל צ׳יפס, טבעות בצל, ירקות ורטבים. ארוחה אמיתית, לא ״מנת תיירים״.",
    ctaLabel: "לתפריט ולהזמנה",
    href: "/",
  },
  {
    image: event3.url,
    title: "עד 200 איש",
    text: "בהזמנה מראש נערכים לאירוח והסעדה של קבוצות גדולות, עם מסלולים מתומחרים לפי אדם ולפי תקציב - מהמבורגר קלאסי ועד מסלול בשרים מלא.",
    ctaLabel: "לקבל הצעה למסלול",
    href: "#lead-top",
  },
  {
    image: arayes,
    title: "מסלול בשרים",
    text: "אנטריקוט, פיקניה, עראיס, קבבים ושיפודים לצד מטוגנים, סלטים וצ׳ימיצ׳ורי - כ-0.5 ק״ג בשר ומעלה לאדם.",
    ctaLabel: "לפרטים על מסלול הבשרים",
    href: "#lead-bottom",
  },
  {
    image: event4.url,
    title: "מדשאה, מחצלות וצל",
    text: "אנחנו בתוך מושב: מדשאות, עצים, סככה מקורה ואווירת פיקניק כפרית - או שולחנות וכיסאות, לפי אופי הקבוצה.",
    ctaLabel: "לראות אפשרויות אירוח",
    href: "#lead-bottom",
  },
  {
    image: event5.url,
    title: "אירועים פרטיים ועסקיים",
    text: "ימי הולדת, אירועי חברה, משלחות וקבוצות - אצלנו בבקתה או באירוע חיצוני, בהתאמה לתקציב ולמספר המשתתפים.",
    ctaLabel: "להזמנת אירוע",
    href: "/events",
  },
];

const HIGHLIGHTS: { icon: typeof MapPin; text: string }[] = [
  { icon: MapPin, text: "מיקום בכפר מימון שמשתלב במסלולי סיור בעוטף" },
  { icon: MapPin, text: "מתאים למסלולים באזור תקומה והנובה" },
  { icon: Bus, text: "חניה קרובה ונוחה לאוטובוסים" },
  { icon: Users, text: "עבודה בתיאום צמוד עם מדריך הקבוצה" },
  { icon: Clock, text: "היערכות מראש לפי שעת ההגעה" },
  { icon: Utensils, text: "שולחנות שוק מוכנים שניות לפני שהקבוצה מגיעה" },
  { icon: Clock, text: "עצירה של כ-30-45 דקות אפשרית לקבוצה שממהרת ובתיאום מתאים" },
  { icon: Users, text: "אירוח קבוצות של עד 200 איש בהזמנה מראש" },
  { icon: Utensils, text: "מסלולים מיוחדים לקבוצות לפי אדם ולפי תקציב" },
  { icon: Users, text: "קבוצות החל מ-20 משתתפים" },
  { icon: Shield, text: "מינימום הזמנה של 2,000 ₪ כולל מע״מ" },
  { icon: Leaf, text: "אפשרויות צמחוניות/טבעוניות וללא גלוטן, בכפוף למגבלות סביבת ההכנה" },
  { icon: Trees, text: "ישיבה על מדשאות, מחצלות או שולחנות וכיסאות" },
  { icon: Trees, text: "אזור מקורה" },
  { icon: CheckCircle2, text: "שני תאי שירותים" },
  { icon: Globe2, text: "מתאים גם לקבוצות תיירים מחו״ל" },
  { icon: Globe2, text: "ניסיון באירוח קבוצות מארצות הברית, קנדה וסין" },
];

const FAQ: { q: string; a: string }[] = [
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

/** Long-form content - kept in the DOM for search/AI crawlers, collapsed for humans. */
const LONG_CONTENT: { title: string; paragraphs: string[] }[] = [
  {
    title: "עצירת אוכל שמשתלבת במסלול הסיור",
    paragraphs: [
      "הבקתה - המבורגר של מושבניקים - נמצאת בכפר מימון שבמועצה האזורית שדות נגב, בלב עוטף עזה והנגב המערבי. המיקום שלנו משתלב בצורה נוחה במסלולי סיור בעוטף הכוללים את אזור תקומה, מגרש המכוניות השרופות, אתר הנובה ואתרים נוספים באזור.",
      "אנחנו מכירים את הצרכים של קבוצות שנמצאות באמצע יום סיור: אוטובוס עם עשרות משתתפים, מדריך שצריך לעמוד בלוח זמנים וארוחת צהריים שצריכה להיות טובה - אבל גם יעילה.",
      "לכן אנחנו עובדים בתיאום צמוד עם מדריך או מארגן הקבוצה לפני ההגעה, יודעים כמה אנשים מגיעים ומתי, ונערכים מראש כדי שהמטבח יעבוד בהתאם לזמן ההגעה של הקבוצה. השולחנות מוכנים במתכונת שוק - שניות לפני שהאוטובוס נחה, כך שהקבוצה יכולה לשבת ולאכול מיד. לקבוצות שממהרות, בתיאום מתאים, ניתן לבצע עצירה של כ-30-45 דקות ולהמשיך בסיור.",
    ],
  },
  {
    title: "עד 200 איש בהזמנה מראש",
    paragraphs: [
      "הבקתה יכולה להיערך בהזמנה מראש לאירוח והסעדה של קבוצות גדולות של עד 200 איש, כולל הכנה והוצאה של כמות גדולה מאוד של המבורגרים בפרק זמן קצר.",
      "קבוצה אצלנו מוגדרת מ-20 משתתפים ומעלה, מינימום ההזמנה הוא 2,000 ₪ כולל מע״מ, וקיבולת הישיבה הרגילה היא כ-35 איש - ולכן קבוצות גדולות יותר מקבלות היערכות מיוחדת בהתאם לגודל הקבוצה, מזג האוויר וסגנון האירוח שנבחר.",
    ],
  },
  {
    title: "תיירים מהארץ ומהעולם",
    paragraphs: [
      "הבקתה מארחת קבוצות, משלחות ומטיילים שמגיעים לסיור בעוטף עזה, ובהן קבוצות מארצות הברית, קנדה ואפילו מסין. חלק מהקבוצות מגיעות לארוחת צהריים כחלק מיום שבו הן מבקרות באתר הנובה, באזור תקומה ובאתרים נוספים בעוטף.",
      "בשולחן אחד יכולה לשבת קבוצת תיירים שהגיעה מחצי עולם כדי להכיר את עוטף עזה, לידם משפחה שמטיילת באזור, ובשולחן אחר חיילי מילואים או סדיר שסיימו יום בגזרה. זו אחת הסיבות שהבקתה הפכה מבחינתנו להרבה יותר ממסעדת המבורגרים - היא נקודת מפגש מקומית בלב העוטף.",
    ],
  },
  {
    title: "מסלולים מיוחדים לקבוצות - לפי אדם ולפי תקציב",
    paragraphs: [
      "לקבוצות יש אצלנו תפריט ומסלולי אירוח ייעודיים, שאינם מוגבלים לתפריט הרגיל. המסלולים מתומחרים לפי אדם ומאפשרים למדריך, לחברת התיירות או למארגן לבחור מראש את רמת האירוח בהתאם לתקציב ולצרכים של הקבוצה - מארוחת המבורגר קלאסית ועד מסלולים מורחבים, מסלול ״הכל כלול״ ומסלול בשרים מלא.",
      "אירוח קבוצות מאפשר לנו להציע גם מנות שאינן חלק קבוע מהתפריט היומי: סוכריות עראיס על מצע טחינה ופטרוזיליה, תוספות חמות, ריבת בצל, שום קונפי, פלפלים חריפים, בצל מטוגן, ביצת עין, רצועות רוסטביף וקינוחים כמו סלט פירות עונתיים. בהתאם למסלול ניתן לקבל רטבים בסקוויזרים לשולחן ללא הגבלה, מים קרים עם קרח ואפשרות לשתייה קלה ללא הגבלה.",
      "במסלול הבשרים ניתן לכלול סטייק אנטריקוט, פיקניה, חצאי עראיס, קבבים במתכון אישי, שיפודי לבבות עוף ושיפודי פרגית בתיבול הבית, לצד מטוגנים, סלטים, צ׳ימיצ׳ורי, שום קונפי ופלפלים חריפים - כ-0.5 ק״ג בשר ומעלה לאדם. באירוח אצלנו הבשרים מוכנים במקום, ובאירועים חיצוניים ניתן להכין אותם על מנגל פחמים.",
    ],
  },
  {
    title: "מדשאה, מחצלות, עצים ואווירה של מושב",
    paragraphs: [
      "אנחנו לא אולם אירועים ולא מסעדה בתוך מרכז מסחרי. הבקתה נמצאת בתוך מושב, וזה חלק גדול מהחוויה: מדשאות, עצים, סככה מקורה ופתוחה בחלקה, ואפשרות לשבת על מחצלות מתחת לצל או על שולחנות וכיסאות.",
      "אנחנו לא אולם אירועים ולא מסעדה בתוך מרכז מסחרי. הבקתה נמצאת בתוך מושב, וזה חלק גדול מהחוויה: מדשאות, עצים, סככה מקורה ופתוחה בחלקה, ואפשרות לשבת על מחצלות מתחת לצל או על שולחנות וכיסאות. יש חניה קרובה ונוחה לאוטובוסים ליד המקום, כך שהקבוצה לא צריכה ללכת מרחק משמעותי מנקודת ההורדה. במקום קיימים שני תאי שירותים - לנשים ולגברים. הגישה אפשרית ברובה גם עבור אדם בכיסא גלגלים, אך קיימת מדרגה קטנה ולכן אין להציג את המקום כנגיש באופן מלא ללא בדיקה פרטנית.",
    ],
  },
  {
    title: "דרום אדום - המבורגר ליד יער שוקדה",
    paragraphs: [
      "הבקתה נמצאת במרחק של כקילומטר מיער שוקדה ומשתלבת באופן טבעי ביום טיול באזור בתקופת פסטיבל דרום אדום. במהלך חודש הפסטיבל אנחנו פותחים גם בשעות הצהריים כדי לארח את המטיילים.",
      "״דרום אדום - הדף הרשמי״ המליץ בעבר על הבקתה במסגרת התמיכה בעסקים המקומיים ותיאר אותה כ״המבורגר בוטיק באווירה כפרית״ ואף כ״אחד ההמבורגרים הכי שווים בארץ״.",
    ],
  },
  {
    title: "החיילים הם חלק מהמשפחה שלנו",
    paragraphs: [
      "הקשר עם חיילי הסדיר והמילואים באזור קיבל משמעות מיוחדת אחרי 7 באוקטובר. בתקופה שבה חלק גדול מהאוכלוסייה האזרחית התפנה, חזרנו למקום, פתחנו את המטבח והכנו אוכל לעשרות חיילים ששמרו בגזרה - חלק מהפעילות בהתנדבות. הסיפור סוקר גם ב-mako.",
      "גם היום חיילים מהמוצבים והבסיסים בסביבה מגיעים אלינו בערבים להמבורגר, בירה קרה וששבש, ואנחנו מבצעים גם משלוחים למוצבים והזמנות מרוכזות בתיאום.",
    ],
  },
  {
    title: "כשרות ורגישויות",
    paragraphs: [
      "הבקתה פועלת בכשרות רגילה בהשגחת הרבנות שדות נגב. קציצת ההמבורגר עשויה מבשר חלק רבנות והירקות הם גוש קטיף. תעודת הכשרות היא כשרות רגילה, בין היתר מכיוון שתוספת הרוסטביף האופציונלית אינה מבשר חלק.",
      "קיימת אפשרות להמבורגר צמחוני/טבעוני, אך הוא מוכן על אותה פלנצ׳ה של הבשר, וקיימת אפשרות ללחמנייה ללא גלוטן שההכנה שלה נעשית בסביבה שבה קיים גלוטן. לקבוצות עם רגישויות מומלץ לעדכן אותנו מראש.",
    ],
  },
  {
    title: "כתבו עלינו",
    paragraphs: [
      "ב-mako סופר הסיפור של הבקתה בתקופת מלחמת חרבות ברזל, החזרה לפעילות והקשר עם החיילים באזור. מבקר האוכל של מקור ראשון פרסם ביקורת תחת הכותרת ״בכפר מימון מצאנו את ההמבורגר המנצח״, ומקור ראשון כלל את הבקתה גם בסיור קולינרי בעוטף עזה. הבקתה התארחה בכתבה מצולמת בתוכנית ״פותחים שישי״ בערוץ 13, והופיעה גם ב-ynet, ישראל היום, Wolt וגופי תיירות אזוריים.",
    ],
  },
];

const Groups = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Autoplay on page entry: try with sound at half volume; if the browser
  // blocks unmuted autoplay, fall back to muted autoplay (volume stays 0.5
  // so unmuting starts at half).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = 0.5;
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(() => {});
    });
  }, []);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "אוכל לקבוצות בסיור בעוטף עזה | המבורגר הבקתה, כפר מימון";
    const desc = document.querySelector('meta[name="description"]');
    const prevDesc = desc?.getAttribute("content") || "";
    desc?.setAttribute(
      "content",
      "הבקתה בכפר מימון - עצירת צהריים לקבוצות ומשלחות בסיור בעוטף עזה, בין תקומה לאזור הנובה. עד 200 איש בהזמנה מראש, המבורגר 220 גרם, מסלולים לפי אדם."
    );
    const canonical = document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = "https://yum-order-maker.lovable.app/groups";
    document.head.appendChild(canonical);

    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.textContent = JSON.stringify([
      {
        "@context": "https://schema.org",
        "@type": "Restaurant",
        name: "הבקתה - המבורגר של מושבניקים",
        description:
          "מסעדת המבורגרים בכפר מימון שבמועצה האזורית שדות נגב, בלב עוטף עזה, המארחת קבוצות, משלחות וסיורים בתיאום מראש.",
        servesCuisine: "המבורגר",
        telephone: "+972584633555",
        url: "https://yum-order-maker.lovable.app/groups",
        address: {
          "@type": "PostalAddress",
          addressLocality: "כפר מימון",
          addressRegion: "מועצה אזורית שדות נגב",
          addressCountry: "IL",
        },
        maximumAttendeeCapacity: 200,
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQ.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ]);
    document.head.appendChild(ld);

    return () => {
      document.title = prevTitle;
      desc?.setAttribute("content", prevDesc);
      canonical.remove();
      ld.remove();
    };
  }, []);

  return (
    <div dir="rtl" className="theme-sand min-h-screen bg-background text-foreground">
      {/* Sticky top bar */}
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <a
              href={`tel:${PHONE}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-sm font-bold"
              aria-label={`התקשרו ${PHONE}`}
            >
              <Phone className="w-4 h-4" /> חייגו
            </a>
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-sm font-bold"
            >
              <WhatsAppIcon className="w-4 h-4" /> וואטסאפ
            </a>
          </div>
          <Link to="/" className="flex items-center gap-2">
            <img src={logo.url} alt="הבקתה" className="h-12 w-12 object-contain rounded-full ring-2 ring-primary-foreground/60" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <img src={event1.url} alt="אירוח קבוצות בבקתה בכפר מימון" className="w-full h-[58vh] min-h-[340px] object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/45 to-foreground/20" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-5xl mx-auto w-full px-4 pb-8 space-y-3 text-background">
            <p className="inline-flex items-center gap-2 rounded-full bg-background/20 backdrop-blur px-3 py-1 text-xs font-bold">
              <MapPin className="w-4 h-4" /> כפר מימון · שדות נגב · עוטף עזה
            </p>
            <h1 className="text-3xl md:text-5xl font-black leading-tight drop-shadow">
              המקום לאכול בו בסיור בעוטף
            </h1>
            <p className="text-base md:text-xl font-bold leading-relaxed max-w-2xl">
              אירוח קבוצות, משלחות וסיורים - עד 200 איש, בתיאום מראש, בלי לשבור את לוח הזמנים.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <WhatsAppButton />
            </div>
          </div>
        </div>
      </section>

      <section aria-label="המדריך שסוגר סיור בעוטף" className="px-4 py-6 bg-background">
        <video
          ref={videoRef}
          className="block w-full max-w-[400px] mx-auto aspect-[9/16] rounded-lg bg-foreground object-contain"
          controls
          playsInline
          autoPlay
          preload="auto"
          poster="/habikta-guide-otef-reel-poster.jpg"
          aria-label="המדריך שסוגר סיור בעוטף"
        >
          <source src="/habikta-guide-otef-reel.mp4" type="video/mp4" />
          הדפדפן אינו תומך בניגון הסרטון.
        </video>
      </section>

      {/* Quick stats strip */}
      <div className="bg-secondary">
        <div className="max-w-5xl mx-auto px-4 py-5 grid grid-cols-3 gap-3 text-center">
          {[
            { k: "עד 200", v: "איש בהזמנה מראש" },
            { k: "30-45 דק׳", v: "עצירה לקבוצה שממהרת" },
            { k: "220 גרם", v: "קציצת המבורגר" },
          ].map((s) => (
            <div key={s.k}>
              <p className="text-xl md:text-3xl font-black text-primary">{s.k}</p>
              <p className="text-xs md:text-sm text-muted-foreground font-bold">{s.v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Prominent group tour coordination pitch */}
      <section className="bg-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto px-4 py-10 md:py-14">
          <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
            <div className="shrink-0">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-primary-foreground/15 flex items-center justify-center">
                <Bus className="w-9 h-9 md:w-11 md:h-11" />
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <h2 className="text-2xl md:text-4xl font-black leading-tight">
                קבוצות באמצע יום סיור? אנחנו מוכנים לכן.
              </h2>
              <p className="text-base md:text-xl font-bold leading-relaxed opacity-95 max-w-3xl">
                אנחנו מכירים את הצרכים של קבוצות שנמצאות באמצע יום סיור: אוטובוס עם עשרות משתתפים, מדריך שצריך לעמוד בלוח זמנים וארוחת צהריים שצריכה להיות טובה - אבל גם יעילה.
              </p>
              <p className="text-base md:text-lg leading-relaxed opacity-90 max-w-3xl">
                לכן אנחנו עובדים בתיאום צמוד עם מדריך או מארגן הקבוצה לפני ההגעה, יודעים כמה אנשים מגיעים ומתי, ונערכים מראש כדי שהמטבח יעבוד בהתאם לזמן ההגעה של הקבוצה. השולחנות מוכנים במתכונת שוק - שניות לפני שהאוטובוס נחה, כדי שאף דקה לא תתבזבז. לקבוצות שממהרות, בתיאום מתאים, ניתן לבצע עצירה של כ-30-45 דקות ולהמשיך בסיור.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <WhatsAppTextLink label="לתאום בוואטסאפ" light />
              </div>
            </div>
          </div>
        </div>
      </section>
      <main className="max-w-5xl mx-auto px-4 py-10 space-y-12">
        <h2 className="text-2xl md:text-4xl font-black text-center text-primary">
          מה אפשר לעשות אצלנו
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          {CARDS.map((c) => (
            <PhotoCard key={c.title} {...c} />
          ))}
        </div>

        {GROUPS_BOOKING_ENABLED && <LeadForm id="lead-top" />}

        <section>
          <h2 className="text-2xl md:text-4xl font-black text-center text-primary mb-6">
            למה קבוצות בוחרות בבקתה
          </h2>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm hover:shadow-md hover:border-primary/40 transition-all"
              >
                <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-sm font-bold leading-relaxed">{text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-2xl md:text-4xl font-black text-center text-primary mb-6">שאלות נפוצות</h2>
          <div className="space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-border bg-card p-4">
                <summary className="cursor-pointer font-black list-none flex items-center justify-between gap-3">
                  <h3 className="text-base">{f.q}</h3>
                  <ChevronDown className="w-5 h-5 text-primary shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="pt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Full story - collapsed for humans, present for crawlers */}
        <section>
          <details className="rounded-3xl border border-border bg-card p-5">
            <summary className="cursor-pointer font-black text-lg list-none flex items-center justify-between gap-3">
              הסיפור המלא של הבקתה ואירוח קבוצות
              <ChevronDown className="w-5 h-5 text-primary shrink-0" />
            </summary>
            <div className="pt-5 space-y-6">
              {LONG_CONTENT.map((s) => (
                <article key={s.title} className="space-y-2">
                  <h3 className="text-lg font-black">{s.title}</h3>
                  {s.paragraphs.map((p, i) => (
                    <p key={i} className="text-sm text-muted-foreground leading-relaxed">{p}</p>
                  ))}
                </article>
              ))}
            </div>
          </details>
        </section>
      </main>

      <PressSection />

      <section className="max-w-5xl mx-auto px-4 py-12 space-y-6">
        <h2 className="text-2xl md:text-4xl font-black text-center text-primary">מתאמים הגעה?</h2>
        {GROUPS_BOOKING_ENABLED ? <LeadForm id="lead-bottom" /> : <div className="flex justify-center text-lg"><WhatsAppTextLink label="דברו איתנו בוואטסאפ" /></div>}
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" variant="outline">
            <a href={`tel:${PHONE}`}><Phone className="ml-2 w-5 h-5" /> {PHONE}</a>
          </Button>
        </div>
      </section>

      {/* Floating WhatsApp */}
      <Button asChild className={`${uiPositions.groupsWhatsApp.position} md:hidden h-14 px-6 rounded-full bg-green text-primary-foreground hover:bg-green/90 shadow-2xl ring-2 ring-green/40`}>
      <a
        href={WHATSAPP}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="דברו איתנו בוואטסאפ"
        className="flex items-center gap-2 text-base font-bold"
      >
        <WhatsAppIcon className="w-7 h-7" />
        דברו איתנו בוואטסאפ
      </a>
      </Button>
    </div>
  );
};

export default Groups;
