import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Phone,
  MessageCircle,
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
  Calendar,
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

const PHONE = "058-4633555";
const WHATSAPP = "https://wa.me/972584633555?text=%D7%94%D7%99%D7%99%2C%20%D7%90%D7%A0%D7%97%D7%A0%D7%95%20%D7%9E%D7%A2%D7%95%D7%A0%D7%99%D7%99%D7%A0%D7%99%D7%9D%20%D7%9C%D7%AA%D7%90%D7%9D%20%D7%94%D7%92%D7%A2%D7%94%20%D7%A9%D7%9C%20%D7%A7%D7%91%D7%95%D7%A6%D7%94";

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
    toast.success("הפרטים נשלחו — נחזור אליכם בהקדם");
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
      <Button asChild size="lg" className="w-full text-base">
        <a href={href}>{ctaLabel}</a>
      </Button>
    </div>
  </article>
);

const CARDS = [
  {
    image: event2.url,
    title: "קבוצות בסיור בעוטף",
    text: "עצירת צהריים שמשתלבת במסלול — חניה קרובה ונוחה לאוטובוסים, המטבח נערך מראש, ובתיאום מתאים אפשר לסיים תוך 30-45 דקות ולהמשיך הלאה.",
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
    text: "בהזמנה מראש נערכים לאירוח והסעדה של קבוצות גדולות, עם מסלולים מתומחרים לפי אדם ולפי תקציב — מהמבורגר קלאסי ועד מסלול בשרים מלא.",
    ctaLabel: "לקבל הצעה למסלול",
    href: "#lead-top",
  },
  {
    image: arayes,
    title: "מסלול בשרים",
    text: "אנטריקוט, פיקניה, עראיס, קבבים ושיפודים לצד מטוגנים, סלטים וצ׳ימיצ׳ורי — כ-0.5 ק״ג בשר ומעלה לאדם.",
    ctaLabel: "לפרטים על מסלול הבשרים",
    href: "#lead-bottom",
  },
  {
    image: event4.url,
    title: "מדשאה, מחצלות וצל",
    text: "אנחנו בתוך מושב: מדשאות, עצים, סככה מקורה ואווירת פיקניק כפרית — או שולחנות וכיסאות, לפי אופי הקבוצה.",
    ctaLabel: "לראות אפשרויות אירוח",
    href: "#lead-bottom",
  },
  {
    image: event5.url,
    title: "אירועים פרטיים ועסקיים",
    text: "ימי הולדת, אירועי חברה, משלחות וקבוצות — אצלנו בבקתה או באירוע חיצוני, בהתאמה לתקציב ולמספר המשתתפים.",
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
    a: "הגישה למקום אפשרית גם עבור אדם בכיסא גלגלים ברובה, אך קיימת מדרגה קטנה ולכן אין להציג את המקום כנגיש באופן מלא ללא בדיקה פרטנית של צורכי הקבוצה. במקום קיימים שני תאי שירותים — לנשים ולגברים.",
  },
];

/** Long-form content — kept in the DOM for search/AI crawlers, collapsed for humans. */
const LONG_CONTENT: { title: string; paragraphs: string[] }[] = [
  {
    title: "עצירת אוכל שמשתלבת במסלול הסיור",
    paragraphs: [
      "הבקתה — המבורגר של מושבניקים — נמצאת בכפר מימון שבמועצה האזורית שדות נגב, בלב עוטף עזה והנגב המערבי. המיקום שלנו משתלב בצורה נוחה במסלולי סיור בעוטף הכוללים את אזור תקומה, מגרש המכוניות השרופות, אתר הנובה ואתרים נוספים באזור.",
      "אנחנו מכירים את הצרכים של קבוצות שנמצאות באמצע יום סיור: אוטובוס עם עשרות משתתפים, מדריך שצריך לעמוד בלוח זמנים וארוחת צהריים שצריכה להיות טובה — אבל גם יעילה.",
      "לכן אנחנו עובדים בתיאום צמוד עם מדריך או מארגן הקבוצה לפני ההגעה, יודעים כמה אנשים מגיעים ומתי, ונערכים מראש כדי שהמטבח יעבוד בהתאם לזמן ההגעה של הקבוצה. לקבוצות שממהרות, בתיאום מתאים, ניתן לבצע עצירה של כ-30-45 דקות ולהמשיך בסיור.",
    ],
  },
  {
    title: "עד 200 איש בהזמנה מראש",
    paragraphs: [
      "הבקתה יכולה להיערך בהזמנה מראש לאירוח והסעדה של קבוצות גדולות של עד 200 איש, כולל הכנה והוצאה של כמות גדולה מאוד של המבורגרים בפרק זמן קצר.",
      "קבוצה אצלנו מוגדרת מ-20 משתתפים ומעלה, מינימום ההזמנה הוא 2,000 ₪ כולל מע״מ, וקיבולת הישיבה הרגילה היא כ-35 איש — ולכן קבוצות גדולות יותר מקבלות היערכות מיוחדת בהתאם לגודל הקבוצה, מזג האוויר וסגנון האירוח שנבחר.",
    ],
  },
  {
    title: "תיירים מהארץ ומהעולם",
    paragraphs: [
      "הבקתה מארחת קבוצות, משלחות ומטיילים שמגיעים לסיור בעוטף עזה, ובהן קבוצות מארצות הברית, קנדה ואפילו מסין. חלק מהקבוצות מגיעות לארוחת צהריים כחלק מיום שבו הן מבקרות באתר הנובה, באזור תקומה ובאתרים נוספים בעוטף.",
      "בשולחן אחד יכולה לשבת קבוצת תיירים שהגיעה מחצי עולם כדי להכיר את עוטף עזה, לידם משפחה שמטיילת באזור, ובשולחן אחר חיילי מילואים או סדיר שסיימו יום בגזרה. זו אחת הסיבות שהבקתה הפכה מבחינתנו להרבה יותר ממסעדת המבורגרים — היא נקודת מפגש מקומית בלב העוטף.",
    ],
  },
  {
    title: "מסלולים מיוחדים לקבוצות — לפי אדם ולפי תקציב",
    paragraphs: [
      "לקבוצות יש אצלנו תפריט ומסלולי אירוח ייעודיים, שאינם מוגבלים לתפריט הרגיל. המסלולים מתומחרים לפי אדם ומאפשרים למדריך, לחברת התיירות או למארגן לבחור מראש את רמת האירוח בהתאם לתקציב ולצרכים של הקבוצה — מארוחת המבורגר קלאסית ועד מסלולים מורחבים, מסלול ״הכל כלול״ ומסלול בשרים מלא.",
      "אירוח קבוצות מאפשר לנו להציע גם מנות שאינן חלק קבוע מהתפריט היומי: סוכריות עראיס על מצע טחינה ופטרוזיליה, תוספות חמות, ריבת בצל, שום קונפי, פלפלים חריפים, בצל מטוגן, ביצת עין, רצועות רוסטביף וקינוחים כמו סלט פירות עונתיים. בהתאם למסלול ניתן לקבל רטבים בסקוויזרים לשולחן ללא הגבלה, מים קרים עם קרח ואפשרות לשתייה קלה ללא הגבלה.",
      "במסלול הבשרים ניתן לכלול סטייק אנטריקוט, פיקניה, חצאי עראיס, קבבים במתכון אישי, שיפודי לבבות עוף ושיפודי פרגית בתיבול הבית, לצד מטוגנים, סלטים, צ׳ימיצ׳ורי, שום קונפי ופלפלים חריפים — כ-0.5 ק״ג בשר ומעלה לאדם. באירוח אצלנו הבשרים מוכנים במקום, ובאירועים חיצוניים ניתן להכין אותם על מנגל פחמים.",
    ],
  },
  {
    title: "מדשאה, מחצלות, עצים ואווירה של מושב",
    paragraphs: [
      "אנחנו לא אולם אירועים ולא מסעדה בתוך מרכז מסחרי. הבקתה נמצאת בתוך מושב, וזה חלק גדול מהחוויה: מדשאות, עצים, סככה מקורה ופתוחה בחלקה, ואפשרות לשבת על מחצלות מתחת לצל או על שולחנות וכיסאות.",
      "אנחנו לא אולם אירועים ולא מסעדה בתוך מרכז מסחרי. הבקתה נמצאת בתוך מושב, וזה חלק גדול מהחוויה: מדשאות, עצים, סככה מקורה ופתוחה בחלקה, ואפשרות לשבת על מחצלות מתחת לצל או על שולחנות וכיסאות. יש חניה קרובה ונוחה לאוטובוסים ליד המקום, כך שהקבוצה לא צריכה ללכת מרחק משמעותי מנקודת ההורדה. במקום קיימים שני תאי שירותים — לנשים ולגברים. הגישה אפשרית ברובה גם עבור אדם בכיסא גלגלים, אך קיימת מדרגה קטנה ולכן אין להציג את המקום כנגיש באופן מלא ללא בדיקה פרטנית.",
    ],
  },
  {
    title: "דרום אדום — המבורגר ליד יער שוקדה",
    paragraphs: [
      "הבקתה נמצאת במרחק של כקילומטר מיער שוקדה ומשתלבת באופן טבעי ביום טיול באזור בתקופת פסטיבל דרום אדום. במהלך חודש הפסטיבל אנחנו פותחים גם בשעות הצהריים כדי לארח את המטיילים.",
      "״דרום אדום - הדף הרשמי״ המליץ בעבר על הבקתה במסגרת התמיכה בעסקים המקומיים ותיאר אותה כ״המבורגר בוטיק באווירה כפרית״ ואף כ״אחד ההמבורגרים הכי שווים בארץ״.",
    ],
  },
  {
    title: "החיילים הם חלק מהמשפחה שלנו",
    paragraphs: [
      "הקשר עם חיילי הסדיר והמילואים באזור קיבל משמעות מיוחדת אחרי 7 באוקטובר. בתקופה שבה חלק גדול מהאוכלוסייה האזרחית התפנה, חזרנו למקום, פתחנו את המטבח והכנו אוכל לעשרות חיילים ששמרו בגזרה — חלק מהפעילות בהתנדבות. הסיפור סוקר גם ב-mako.",
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
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "אוכל לקבוצות בסיור בעוטף עזה | המבורגר הבקתה, כפר מימון";
    const desc = document.querySelector('meta[name="description"]');
    const prevDesc = desc?.getAttribute("content") || "";
    desc?.setAttribute(
      "content",
      "הבקתה בכפר מימון — עצירת צהריים לקבוצות ומשלחות בסיור בעוטף עזה, בין תקומה לאזור הנובה. עד 200 איש בהזמנה מראש, המבורגר 220 גרם, מסלולים לפי אדם."
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
        name: "הבקתה — המבורגר של מושבניקים",
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
              <MessageCircle className="w-4 h-4" /> וואטסאפ
            </a>
          </div>
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="הבקתה" className="h-11 w-11 rounded-full object-cover ring-2 ring-primary-foreground/60" />
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
              אירוח קבוצות, משלחות וסיורים — עד 200 איש, בתיאום מראש, בלי לשבור את לוח הזמנים.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button asChild size="lg" className="text-base h-12">
                <a href="#lead-top">השאירו פרטים ונחזור אליכם</a>
              </Button>
              <Button asChild size="lg" variant="secondary" className="text-base h-12">
                <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="ml-2 w-5 h-5" /> וואטסאפ
                </a>
              </Button>
            </div>
          </div>
        </div>
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
                אנחנו מכירים את הצרכים של קבוצות שנמצאות באמצע יום סיור: אוטובוס עם עשרות משתתפים, מדריך שצריך לעמוד בלוח זמנים וארוחת צהריים שצריכה להיות טובה — אבל גם יעילה.
              </p>
              <p className="text-base md:text-lg leading-relaxed opacity-90 max-w-3xl">
                לכן אנחנו עובדים בתיאום צמוד עם מדריך או מארגן הקבוצה לפני ההגעה, יודעים כמה אנשים מגיעים ומתי, ונערכים מראש כדי שהמטבח יעבוד בהתאם לזמן ההגעה של הקבוצה. לקבוצות שממהרות, בתיאום מתאים, ניתן לבצע עצירה של כ-30-45 דקות ולהמשיך בסיור.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button asChild size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 text-base h-12">
                  <Link to="/events">
                    <Calendar className="ml-2 w-5 h-5" /> להזמנת קבוצה ואירוע
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 text-base h-12">
                  <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="ml-2 w-5 h-5" /> לתיאום מהיר בוואטסאפ
                  </a>
                </Button>
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

        <LeadForm id="lead-top" />

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

        {/* Full story — collapsed for humans, present for crawlers */}
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
        <LeadForm id="lead-bottom" />
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" variant="outline">
            <a href={`tel:${PHONE}`}><Phone className="ml-2 w-5 h-5" /> {PHONE}</a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/"><Utensils className="ml-2 w-4 h-4" /> לתפריט ולהזמנה</Link>
          </Button>
        </div>
      </section>

      {/* Floating WhatsApp */}
      <a
        href={WHATSAPP}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="שליחת הודעה בוואטסאפ"
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-xl"
      >
        <MessageCircle className="w-7 h-7" />
      </a>
    </div>
  );
};

export default Groups;
