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
  Flame,
  Leaf,
  Shield,
  Trees,
  Globe2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import PressSection from "@/components/PressSection";

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
      <Card id={id} className="border-primary/40">
        <CardContent className="p-6 text-center space-y-2">
          <p className="text-xl font-bold">קיבלנו את הפרטים 🙌</p>
          <p className="text-muted-foreground">נחזור אליכם בהקדם. אם זה דחוף, אפשר להתקשר {PHONE}.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader>
        <CardTitle>השאירו פרטים ונחזור אליכם</CardTitle>
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
          <Button type="submit" size="lg" className="w-full" disabled={sending}>
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

const Section = ({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) => (
  <section id={id} className="space-y-3 scroll-mt-24">
    <h2 className="text-2xl md:text-3xl font-black leading-snug">{title}</h2>
    <div className="text-muted-foreground leading-relaxed space-y-3">{children}</div>
  </section>
);

const HIGHLIGHTS: { icon: typeof MapPin; text: string }[] = [
  { icon: MapPin, text: "מיקום בכפר מימון שמשתלב במסלולי סיור בעוטף" },
  { icon: MapPin, text: "מתאים למסלולים באזור תקומה והנובה" },
  { icon: Bus, text: "אוטובוס יכול להגיע ממש מול הבקתה" },
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
    a: "האוטובוס יכול להגיע ממש מול הבקתה ולהוריד את המשתתפים בסמוך למקום, ללא צורך להיכנס למרכז עיר ולחפש חניה לאוטובוס.",
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
    <div dir="rtl" className="min-h-screen bg-background">
      <header className="bg-gradient-to-b from-primary/10 to-background border-b">
        <div className="max-w-4xl mx-auto px-4 py-12 space-y-5">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-bold">
            <MapPin className="w-4 h-4 text-primary" /> כפר מימון · שדות נגב · עוטף עזה
          </p>
          <h1 className="text-3xl md:text-5xl font-black leading-tight">
            הבקתה — המקום לאכול בו במהלך סיור בעוטף
          </h1>
          <p className="text-lg md:text-xl font-bold leading-relaxed">
            אירוח קבוצות, משלחות וסיורים בעוטף עזה — בכפר מימון, בין תקומה לאזור הנובה
          </p>
          <p className="text-muted-foreground leading-relaxed">
            אם אתם מתכננים סיור בעוטף ומחפשים מקום שבו קבוצה שלמה יכולה לעצור לארוחת צהריים טובה, בלי להפוך את
            עצירת האוכל לחלק שמבזבז את היום — בשביל זה בדיוק אנחנו כאן.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer"><MessageCircle className="ml-2 w-5 h-5" /> דברו איתנו בוואטסאפ</a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={`tel:${PHONE}`}><Phone className="ml-2 w-5 h-5" /> התקשרו עכשיו {PHONE}</a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="#lead-top">השאירו פרטים ונחזור אליכם</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-12">
        <LeadForm id="lead-top" />

        <Section title="עצירת אוכל שמשתלבת במסלול הסיור">
          <p>
            הבקתה — המבורגר של מושבניקים — נמצאת בכפר מימון שבמועצה האזורית שדות נגב, בלב עוטף עזה והנגב המערבי.
            המיקום שלנו משתלב בצורה נוחה במסלולי סיור בעוטף הכוללים את אזור תקומה, מגרש המכוניות השרופות, אתר הנובה
            ואתרים נוספים באזור.
          </p>
          <p>אבל המיקום הוא רק חלק מהיתרון.</p>
          <p>
            אנחנו מכירים את הצרכים של קבוצות שנמצאות באמצע יום סיור: אוטובוס עם עשרות משתתפים, מדריך שצריך לעמוד
            בלוח זמנים וארוחת צהריים שצריכה להיות טובה — אבל גם יעילה.
          </p>
          <p>
            לכן אנחנו עובדים בתיאום צמוד עם מדריך או מארגן הקבוצה לפני ההגעה. אנחנו יודעים כמה אנשים מגיעים ומתי הם
            צפויים להגיע, ונערכים מראש כדי שהמטבח יעבוד בהתאם לזמן ההגעה של הקבוצה.
          </p>
          <div className="grid sm:grid-cols-3 gap-4 pt-2">
            {[
              { icon: Clock, title: "30-45 דקות", text: "כאשר קבוצה ממהרת והכול מתואם מראש, ניתן לסיים אצלנו עצירת אוכל מלאה ולהמשיך לתחנה הבאה בסיור." },
              { icon: Bus, title: "האוטובוס עוצר מולנו", text: "האוטובוס יכול להגיע ממש מול הבקתה ולהוריד את המשתתפים בסמוך למקום, ללא צורך להיכנס למרכז עיר ולחפש חניה לאוטובוס." },
              { icon: Users, title: "עד 200 איש", text: "בהזמנה מראש אנחנו נערכים לאירוח והסעדה של קבוצות גדולות של עד 200 איש." },
            ].map(({ icon: Icon, title, text }) => (
              <Card key={title} className="border-primary/30">
                <CardContent className="p-4 space-y-1">
                  <Icon className="w-6 h-6 text-primary" />
                  <h3 className="font-black text-foreground">{title}</h3>
                  <p className="text-sm">{text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="pt-1">
            המטרה פשוטה: להגיע, לאכול טוב, ליהנות מהעצירה ולהמשיך בסיור בלי לבזבז זמן יקר.
          </p>
        </Section>

        <Section title="עד 200 איש בהזמנה מראש">
          <p>
            הבקתה יכולה להיערך בהזמנה מראש לאירוח והסעדה של קבוצות גדולות של עד 200 איש. אנחנו מסוגלים להיערך מראש גם
            להכנה והוצאה של כמות גדולה מאוד של המבורגרים בפרק זמן קצר, כאשר מספר המשתתפים ושעת ההגעה מתואמים איתנו.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { title: "מ-20 משתתפים", text: "קבוצה אצלנו מוגדרת מ-20 משתתפים ומעלה." },
              { title: "מינימום 2,000 ₪", text: "מינימום ההזמנה לקבוצה הוא 2,000 ₪ כולל מע״מ." },
              { title: "כ-35 מקומות ישיבה", text: "קיבולת הישיבה הרגילה של הבקתה היא כ-35 איש, ולכן קבוצות גדולות יותר מקבלות היערכות מיוחדת בהתאם לגודל הקבוצה, מזג האוויר וסגנון האירוח שנבחר." },
            ].map((c) => (
              <Card key={c.title}>
                <CardContent className="p-4 space-y-1">
                  <h3 className="font-black text-foreground">{c.title}</h3>
                  <p className="text-sm">{c.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>

        <Section title="תיירים מהארץ ומהעולם">
          <p>
            הבקתה מארחת קבוצות, משלחות ומטיילים שמגיעים לסיור בעוטף עזה. כבר אירחנו אצלנו קבוצות תיירים מישראל ומחו״ל,
            ובהן קבוצות מארצות הברית, קנדה ואפילו מסין.
          </p>
          <p>
            חלק מהקבוצות מגיעות אלינו לארוחת צהריים כחלק מיום שבו הן מבקרות באתר הנובה, באזור תקומה ובאתרים נוספים
            בעוטף.
          </p>
          <p>וכאן קורה משהו שאנחנו מאוד אוהבים בבקתה.</p>
          <blockquote className="border-r-4 border-primary bg-card rounded-2xl p-5 text-foreground leading-relaxed">
            בשולחן אחד יכולה לשבת קבוצת תיירים שהגיעה מחצי עולם כדי להכיר את עוטף עזה, לידם משפחה שמטיילת באזור,
            ובשולחן אחר חיילי מילואים או סדיר שסיימו יום בגזרה. אנשים מעולמות שונים לחלוטין נפגשים כאן סביב אוכל.
          </blockquote>
          <p>
            זו אחת הסיבות שהבקתה הפכה מבחינתנו להרבה יותר ממסעדת המבורגרים — היא נקודת מפגש מקומית בלב העוטף.
          </p>
        </Section>

        <Section title="ארוחת צהריים שמתאימה ללוח הזמנים של הסיור">
          <p>
            מדריכי טיולים יודעים שעצירת צהריים לקבוצה גדולה יכולה בקלות להפוך לשעה וחצי או שעתיים. עשרות אנשים צריכים
            לבחור מנות, לבצע הזמנה, לחכות להכנה ורק לאחר מכן להתחיל לאכול.
          </p>
          <p>אצלנו המטרה היא אחרת.</p>
          <p>
            לפני הגעת הקבוצה אנחנו נמצאים בתיאום עם המדריך או המארגן. מספר המשתתפים, המסלול שנבחר וזמן ההגעה ידועים
            מראש, והמטבח נערך בהתאם.
          </p>
          <p>
            כאשר האוטובוס מתקרב, אפשר לתזמן את העבודה כך שהמנות יתחילו לצאת סביב זמן ההגעה ולא להתחיל את כל תהליך
            ההכנה רק לאחר שהקבוצה התיישבה.
          </p>
          <p>לקבוצות שממהרות, בתיאום מתאים, ניתן לבצע עצירה של כ-30-45 דקות ולהמשיך בסיור.</p>
          <p>
            עבור מדריך שמנהל יום שלם של סיור בעוטף, זה יכול להיות ההבדל בין ארוחת צהריים שמשבשת את המסלול לבין ארוחה
            שמשתלבת בתוכו.
          </p>
        </Section>

        <Section title="המבורגר 220 גרם — ארוחה שאף אחד לא אמור לצאת ממנה רעב">
          <p>
            בלב הארוחה נמצא ההמבורגר שלנו. אנחנו עובדים עם תערובת בקר איכותית ומגישים קציצה עבה ועסיסית במשקל 220 גרם.
          </p>
          <p>
            אנחנו לא מנסים לתת לקבוצה ״מנת תיירים״ קטנה כדי לסמן וי על ארוחת הצהריים. הקבוצות מקבלות ארוחה אמיתית
            ומשביעה.
          </p>
          <p>
            לצד ההמבורגר ניתן להגיש צ׳יפס, וופל צ׳יפס, טבעות בצל, ירקות, רטבים ותוספות שונות — בהתאם למסלול שנבחר.
          </p>
        </Section>

        <Section title="מסלולים מיוחדים לקבוצות — לפי אדם ולפי תקציב">
          <p>
            לקבוצות יש אצלנו תפריט ומסלולי אירוח ייעודיים, שאינם מוגבלים לתפריט הרגיל של הבקתה. המסלולים מתומחרים לפי
            אדם ומאפשרים למדריך, לחברת התיירות או למארגן לבחור מראש את רמת האירוח בהתאם לתקציב ולצרכים של הקבוצה.
          </p>
          <p>
            קיימות אפשרויות החל מארוחת המבורגר קלאסית ועד מסלולים מורחבים, מסלול ״הכל כלול״ ומסלול בשרים מלא.
          </p>
          <p>
            אנחנו גם משתדלים להתגמש ולהתאים את המסלול להעדפות ולצרכים של הקבוצה בגבול האפשר, ולא מחייבים כל קבוצה
            להיכנס בדיוק לאותה תבנית.
          </p>
        </Section>

        <Section title="מנות מיוחדות שלא תמצאו בהכרח בתפריט הרגיל">
          <p>אירוח קבוצות מאפשר לנו להציע גם מנות ותוספות שאינן חלק קבוע מהתפריט היומי.</p>
          <p>
            בין היתר ניתן לשלב במסלולים מיוחדים סוכריות עראיס המוגשות על מצע טחינה ופטרוזיליה, תוספות חמות, ריבת בצל,
            שום קונפי, פלפלים חריפים, בצל מטוגן, ביצת עין, רצועות רוסטביף וקינוחים כמו סלט פירות עונתיים.
          </p>
          <p>
            בהתאם למסלול ניתן לקבל רטבים בסקוויזרים לשולחן ללא הגבלה, מים קרים עם קרח ואפשרות לשתייה קלה ללא הגבלה.
          </p>
        </Section>

        <Section title="מסלול בשרים לקבוצות ואירועים">
          <p>לקבוצות שמחפשות ארוחה גדולה יותר מהמבורגר קיים גם מסלול בשרים.</p>
          <p>
            המסלול יכול לכלול סטייק אנטריקוט, פיקניה, חצאי עראיס, קבבים במתכון אישי, שיפודי לבבות עוף ושיפודי פרגית
            בתיבול הבית, לצד מטוגנים, סלטים, צ׳ימיצ׳ורי, שום קונפי ופלפלים חריפים.
          </p>
          <p className="flex items-start gap-2 text-foreground font-bold">
            <Flame className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            במסלול זה מדובר בכמות נדיבה של כ-0.5 ק״ג ומעלה בשר לאדם.
          </p>
          <p>
            באירוח המתקיים אצלנו הבשרים מוכנים במקום על ציוד הבישול שלנו, ובאירועים חיצוניים ניתן להכין את הבשרים על
            מנגל פחמים.
          </p>
        </Section>

        <Section title="מדשאה, מחצלות, עצים ואווירה של מושב">
          <p>אנחנו לא אולם אירועים ולא מסעדה בתוך מרכז מסחרי.</p>
          <p>הבקתה נמצאת בתוך מושב, וזה חלק גדול מהחוויה.</p>
          <p>
            מסביב יש מדשאות ועצים, ואפשר להתאים את צורת הישיבה לאופי הקבוצה. יש קבוצות שמעדיפות שולחנות וכיסאות, ויש
            כאלה שמעדיפות לפרוס מחצלות על המדשאה, לשבת מתחת לצל העצים וליהנות מאווירת פיקניק כפרית עם מפות משובצות
            אדום-לבן.
          </p>
          <p>
            יש במקום סככה מקורה ופתוחה בחלקה, ובדרך כלל האוויר והבריזה של המושב יוצרים אווירה נעימה.
          </p>
          <p>
            אוטובוס יכול להגיע ממש מול המקום, כך שהקבוצה לא צריכה ללכת מרחק משמעותי מנקודת ההורדה לארוחה.
          </p>
          <p>במקום קיימים שני תאי שירותים — לנשים ולגברים.</p>
          <p>
            הגישה למקום אפשרית גם עבור אדם בכיסא גלגלים ברובה, אך קיימת מדרגה קטנה ולכן אין להציג את המקום כנגיש
            באופן מלא ללא בדיקה פרטנית של צורכי הקבוצה.
          </p>
        </Section>

        <Section title="דרום אדום — המבורגר ליד יער שוקדה">
          <p>
            הבקתה נמצאת במרחק של כקילומטר מיער שוקדה, ולכן היא משתלבת באופן טבעי גם ביום טיול באזור בתקופת פסטיבל
            דרום אדום.
          </p>
          <p>
            בכל שנה מגיעים לאזור מטיילים ומשפחות כדי לראות את פריחת הכלניות, לטייל ביער שוקדה ובנגב המערבי וליהנות
            מאירועי דרום אדום.
          </p>
          <p>במהלך חודש הפסטיבל אנחנו פותחים גם בשעות הצהריים כדי לארח את המטיילים.</p>
          <p>
            למי שמחפש מקום לאכול בדרום אדום, המבורגר ליד יער שוקדה או עצירת צהריים במהלך יום טיול באזור — הבקתה
            נמצאת ממש בתוך אזור הטיול.
          </p>
          <blockquote className="border-r-4 border-primary bg-card rounded-2xl p-5 text-foreground leading-relaxed">
            גם ״דרום אדום - הדף הרשמי״ המליץ בעבר על הבקתה במסגרת התמיכה בעסקים המקומיים ותיאר אותה כ״המבורגר בוטיק
            באווירה כפרית״ ואף כ״אחד ההמבורגרים הכי שווים בארץ״.
          </blockquote>
        </Section>

        <Section title="החיילים הם חלק מהמשפחה שלנו">
          <p>אי אפשר לספר על הבקתה בלי לדבר על חיילי הסדיר והמילואים שמשרתים באזור.</p>
          <p>הקשר הזה קיבל משמעות מיוחדת אחרי 7 באוקטובר.</p>
          <p>
            בתקופה שבה חלק גדול מהאוכלוסייה האזרחית באזור התפנה, הבקתה חזרה לפעילות גם עבור החיילים שנשארו בגזרה.
          </p>
          <p>
            חיילים התקשרו ושאלו אם אנחנו פתוחים. חזרנו למקום, פתחנו את המטבח והכנו אוכל לעשרות חיילים ששמרו באזור,
            כאשר חלק מהפעילות בתקופה הזאת נעשתה בהתנדבות.
          </p>
          <p>
            הסיפור הזה סוקר גם ב-mako, שסיפר על החזרה של הבקתה לפעילות בתקופת המלחמה ועל הקשר שנוצר עם חיילי הסדיר
            והמילואים.
          </p>
          <p>אבל הקשר לא הסתיים שם.</p>
          <p>גם היום חיילי מילואים וסדיר מהמוצבים והבסיסים בסביבה מגיעים אלינו בערבים.</p>
          <p>
            אחרי יום בגזרה אפשר להגיע לבקתה, להזמין המבורגר ובירה קרה, לשבת, לפתוח ששבש ולדבר.
          </p>
          <p>
            בתוך כל הטירוף של המציאות באזור, עבור חלק מהחיילים הבקתה היא פינה קטנה של שקט — מקום שאפשר לכמה רגעים
            להוריד בו את הציוד, לאכול ולהרגיש קצת בבית.
          </p>
          <p>
            אנחנו גם מבצעים משלוחים למוצבים באזור ונערכים להזמנות מרוכזות לחיילים בהתאם לתיאום ולאפשרויות הפעילות.
          </p>
          <p>
            מבחינתנו, הרבה מהחיילים שחוזרים אלינו שוב ושוב כבר מזמן אינם רק לקוחות — הם חלק מהמשפחה של הבקתה.
          </p>
        </Section>

        <Section title="הרבה מעבר להמבורגר">
          <p>הבקתה היא מקום שאפשר להגיע אליו בגלל האוכל ולהישאר בו בגלל האווירה.</p>
          <p>בסוף היום אפשר לקחת בירה קרה, לשבת עם החברים, לפתוח ששבש ולדבר.</p>
          <p>אין כאן תחושה שצריך לסיים את המנה ולמהר לפנות את השולחן.</p>
          <p>אנחנו רוצים שאנשים ירגישו בבית.</p>
          <p>וזה יוצר מפגשים שקשה למצוא במקומות אחרים.</p>
          <p>
            תיירים מארצות הברית, קנדה או סין שעושים סיור בעוטף יכולים למצוא את עצמם אוכלים ליד מילואימניקים
            מהמוצבים באזור. משפחה שחזרה מהכלניות ביער שוקדה יכולה לשבת ליד מושבניקים שמגיעים לכאן באופן קבוע.
          </p>
          <p>כל אחד הגיע מסיבה אחרת.</p>
          <p className="text-foreground font-black text-lg">בסוף כולם יושבים באותה בקתה.</p>
          <p>
            זו הסיבה שאנחנו רואים בבקתה הרבה מעבר לעוד מקום שמוכר המבורגר — היא הפכה למעין מוסד קולינרי מקומי ונקודת
            מפגש של האנשים שחיים, משרתים ומטיילים באזור.
          </p>
        </Section>

        <Section title="כשרות ורגישויות">
          <p>הבקתה פועלת בכשרות רגילה בהשגחת הרבנות שדות נגב.</p>
          <p>קציצת ההמבורגר עצמה עשויה מבשר חלק רבנות והירקות הם גוש קטיף.</p>
          <p>
            חשוב לדייק: תעודת הכשרות של המקום היא כשרות רגילה, בין היתר מכיוון שתוספת הרוסטביף האופציונלית אינה מבשר
            חלק.
          </p>
          <p>קיימת אפשרות להמבורגר צמחוני/טבעוני, אך הוא מוכן על אותה פלנצ׳ה של הבשר.</p>
          <p>קיימת גם אפשרות ללחמנייה ללא גלוטן, אך ההכנה נעשית בסביבה שבה קיים גלוטן.</p>
          <p>
            לקבוצות עם רגישויות או העדפות מיוחדות מומלץ לעדכן אותנו מראש כדי שנוכל לבדוק מה ניתן להתאים.
          </p>
        </Section>

        <Section title="אירועים פרטיים ועסקיים">
          <p>הניסיון שלנו בהוצאת כמויות גדולות של אוכל מאפשר לנו לתת שירות גם לאירועים פרטיים ועסקיים.</p>
          <p>
            אנחנו מציעים מסלולי אירוח לאירועים, ימי הולדת, אירועי חברה, משלחות וקבוצות, עם אפשרות להתאים את סוג האוכל
            והאירוח בהתאם לתקציב ולמספר המשתתפים.
          </p>
          <p>ניתן לקיים אירוח אצלנו בבקתה או, בהתאם לאירוע ולתיאום, להגיע גם לאירוע חיצוני.</p>
          <p>בהזמנה מראש ניתן להיערך לאירועים ולקבוצות של עד 200 משתתפים.</p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild variant="outline"><Link to="/events">הזמנת אירוע</Link></Button>
            <Button asChild variant="outline"><Link to="/"><Utensils className="ml-2 w-4 h-4" /> לתפריט ולהזמנה</Link></Button>
          </div>
        </Section>

        <Section title="כתבו עלינו">
          <p>לאורך השנים הבקתה זכתה לסיקור בתקשורת, בביקורות אוכל ובגופי תיירות.</p>
          <p>ב-mako סופר הסיפור של הבקתה בתקופת מלחמת חרבות ברזל, החזרה לפעילות והקשר עם החיילים באזור.</p>
          <p>
            מבקר האוכל של מקור ראשון הגיע לכפר מימון ופרסם ביקורת תחת הכותרת: ״בכפר מימון מצאנו את ההמבורגר המנצח״.
          </p>
          <p>מקור ראשון כלל את הבקתה גם במסגרת סיור קולינרי בעוטף עזה.</p>
          <p>הבקתה התארחה גם בכתבה מצולמת בתוכנית ״פותחים שישי״ בערוץ 13.</p>
          <p>
            בנוסף הופיעה הבקתה בסיקורים ואזכורים של גופי תקשורת ואתרי תוכן נוספים, ובהם ynet, ישראל היום, Wolt וגופי
            תיירות אזוריים.
          </p>
          <p>
            ״דרום אדום - הדף הרשמי״ תיאר בעבר את הבקתה כ״המבורגר בוטיק באווירה כפרית״ ואף כ״אחד ההמבורגרים הכי שווים
            בארץ״.
          </p>
        </Section>
      </main>

      <PressSection />

      <div className="max-w-4xl mx-auto px-4 py-12 space-y-12">
        <section className="scroll-mt-24">
          <h2 className="text-2xl md:text-3xl font-black mb-5">
            למה לבחור בבקתה לעצירת אוכל במהלך סיור בעוטף?
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

        <section className="scroll-mt-24">
          <h2 className="text-2xl md:text-3xl font-black mb-5">שאלות נפוצות</h2>
          <div className="space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-border bg-card p-4">
                <summary className="cursor-pointer font-black list-none flex items-center justify-between gap-3">
                  <h3 className="text-base">{f.q}</h3>
                  <span className="text-primary transition-transform group-open:rotate-45 text-xl leading-none">+</span>
                </summary>
                <p className="text-sm text-muted-foreground leading-relaxed pt-3">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-primary/40 bg-primary/5 p-6 md:p-10 text-center space-y-4 scroll-mt-24">
          <h2 className="text-2xl md:text-3xl font-black leading-snug">
            מתכננים סיור בעוטף? בואו נתאים לכם את עצירת הצהריים
          </h2>
          <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            ספרו לנו כמה אנשים מגיעים, מתי אתם צפויים להיות באזור ומה התקציב שלכם — ונבדוק איך אפשר להתאים לכם ארוחה
            שתשתלב במסלול.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer"><MessageCircle className="ml-2 w-5 h-5" /> דברו איתנו בוואטסאפ</a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={`tel:${PHONE}`}><Phone className="ml-2 w-5 h-5" /> התקשרו עכשיו</a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="#lead-bottom">השאירו פרטים ונחזור אליכם</a>
            </Button>
          </div>
        </section>

        <LeadForm id="lead-bottom" />

        <section className="text-center text-sm text-muted-foreground space-y-1">
          <h2 className="text-base font-black text-foreground">יצירת קשר</h2>
          <p>
            טלפון: <a className="text-primary underline" href={`tel:${PHONE}`}>{PHONE}</a> · וואטסאפ:{" "}
            <a className="text-primary underline" href={WHATSAPP} target="_blank" rel="noopener noreferrer">שליחת הודעה</a>
          </p>
          <p>הבקתה — המבורגר של מושבניקים, כפר מימון, מועצה אזורית שדות נגב.</p>
        </section>
      </div>
    </div>
  );
};

export default Groups;
