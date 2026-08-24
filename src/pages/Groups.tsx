import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Phone, MessageCircle, MapPin, Users, Clock, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const PHONE = "058-4633555";
const WHATSAPP = "https://wa.me/972584633555?text=%D7%94%D7%99%D7%99%2C%20%D7%90%D7%A0%D7%97%D7%A0%D7%95%20%D7%9E%D7%A2%D7%95%D7%A0%D7%99%D7%99%D7%A0%D7%99%D7%9D%20%D7%9C%D7%AA%D7%90%D7%9D%20%D7%94%D7%92%D7%A2%D7%94%20%D7%A9%D7%9C%20%D7%A7%D7%91%D7%95%D7%A6%D7%94";

const LeadForm = ({ id }: { id: string }) => {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [groupType, setGroupType] = useState("");
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
      group_type: groupType.trim() || null,
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
    <Card id={id}>
      <CardHeader>
        <CardTitle>השאירו פרטים ונחזור אליכם</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`${id}-name`}>שם מלא</Label>
              <Input id={`${id}-name`} value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} required />
            </div>
            <div>
              <Label htmlFor={`${id}-phone`}>טלפון</Label>
              <Input id={`${id}-phone`} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={25} required />
            </div>
            <div>
              <Label htmlFor={`${id}-type`}>סוג הקבוצה / האירוע</Label>
              <Input id={`${id}-type`} value={groupType} onChange={(e) => setGroupType(e.target.value)} placeholder="סיור בעוטף, משלחת, אירוע פרטי..." maxLength={100} />
            </div>
            <div>
              <Label htmlFor={`${id}-guests`}>מספר משתתפים</Label>
              <Input id={`${id}-guests`} type="number" min={1} max={2000} value={guests} onChange={(e) => setGuests(e.target.value.replace(/^0+/, ""))} />
            </div>
            <div>
              <Label htmlFor={`${id}-date`}>תאריך מבוקש</Label>
              <Input id={`${id}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor={`${id}-notes`}>הערות</Label>
            <Textarea id={`${id}-notes`} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="שעת הגעה משוערת, העדפות תפריט, צרכים מיוחדים" />
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

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="text-2xl font-bold">{title}</h2>
    <div className="text-muted-foreground leading-relaxed space-y-3">{children}</div>
  </section>
);

const Groups = () => {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "קבוצות וסיורים בעוטף | המבורגר הבקתה";
    const desc = document.querySelector('meta[name="description"]');
    const prevDesc = desc?.getAttribute("content") || "";
    desc?.setAttribute(
      "content",
      "המבורגר הבקתה — עצירת אוכל לקבוצות, משלחות וסיורים בעוטף עזה. תיאום מראש, המבורגר סמאש טרי, ישיבה בחוץ. השאירו פרטים ונחזור אליכם."
    );
    const canonical = document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = "https://yum-order-maker.lovable.app/groups";
    document.head.appendChild(canonical);
    return () => {
      document.title = prevTitle;
      desc?.setAttribute("content", prevDesc);
      canonical.remove();
    };
  }, []);

  return (
    <div dir="rtl" className="min-h-screen bg-background">

      <header className="bg-gradient-to-b from-primary/10 to-background border-b">
        <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
          <h1 className="text-3xl md:text-4xl font-extrabold leading-tight">
            קבוצות, משלחות וסיורים בעוטף — עצירת אוכל בהמבורגר הבקתה
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            הבקתה היא מסעדת המבורגרים במושב תושיה שבמועצה האזורית שדות נגב, כמה דקות נסיעה מתקומה ומאזור הסיורים בעוטף.
            אנחנו מכינים המבורגר סמאש טרי של מושבניקים, ומארחים קבוצות שמגיעות לסיור באזור — משלחות מהארץ ומחו״ל,
            קבוצות של דרום אדום ויער שוקדה, חיילים ואירועים פרטיים. הגעה של קבוצה מתואמת מראש בטלפון כדי שנוכל
            להיערך עם כמויות, זמני הכנה ומקומות ישיבה.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href={`tel:${PHONE}`}><Phone className="ml-2 w-5 h-5" /> התקשרו עכשיו {PHONE}</a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer"><MessageCircle className="ml-2 w-5 h-5" /> וואטסאפ</a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="#lead-top">השארת פרטים</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-10">
        <LeadForm id="lead-top" />

        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: MapPin, title: "איפה אנחנו", text: "דרך ערבי נחל 23, מושב תושיה, שדות נגב — קרוב לתקומה ולאזור הסיורים בעוטף." },
            { icon: Users, title: "קבוצות", text: "מארחים קבוצות בתיאום מראש, כדי שנוכל להיערך לכמות ולזמן ההגעה." },
            { icon: Clock, title: "תיאום מראש", text: "מומלץ ליצור קשר כמה ימים לפני, במיוחד לקבוצות גדולות." },
          ].map(({ icon: Icon, title, text }) => (
            <Card key={title}>
              <CardContent className="p-4 space-y-1">
                <Icon className="w-5 h-5 text-primary" />
                <h3 className="font-bold">{title}</h3>
                <p className="text-sm text-muted-foreground">{text}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Section title="מי אנחנו">
          <p>
            הבקתה היא מסעדת המבורגרים כשרה בהשגחת הרבנות המקומית שדות נגב. הכול נעשה אצלנו במקום: קציצות סמאש טריות,
            רטבים בהכנה עצמית, חמוצים וחלפניו מוחמץ בית, וצ׳יפס וטבעות בצל בטמפורה שמטוגנים במקום. האווירה כפרית ופשוטה —
            שולחנות בחוץ, דשא, וקבלת פנים של מושבניקים.
          </p>
        </Section>

        <Section title="סיור בעוטף — נובה ותקומה">
          <p>
            הרבה קבוצות שמגיעות לאזור משלבות ביקור באתר ההנצחה של מסיבת נובה ובמתחם הרכבים בתקומה. אנחנו נמצאים במרחק
            נסיעה קצר משם, ומהווים עצירת אוכל נוחה בהמשך או בסיום הסיור. אם תעדכנו אותנו מראש בשעת ההגעה המשוערת ובמספר
            המשתתפים, נכין את ההזמנה כך שהקבוצה לא תמתין.
          </p>
        </Section>

        <Section title="קבוצות ומשלחות מחו״ל">
          <p>
            אנחנו מארחים גם משלחות מחו״ל שמגיעות לסיור באזור. אפשר לתאם תפריט מצומצם וקבוע מראש לכל הקבוצה — כך ההגשה
            מהירה יותר וההזמנה פשוטה. נשמח לדעת מראש על צרכים מיוחדים, למשל מנות ללא גלוטן (חשוב לדעת: הלחמנייה ללא גלוטן
            מוכנה במטבח שאינו נקי מגלוטן, והטיגון מתבצע בשמן משותף).
          </p>
        </Section>

        <Section title="דרום אדום ויער שוקדה">
          <p>
            בעונת הפריחה מגיעים לאזור מטיילים רבים לכלניות ולשטחים הפתוחים בסביבה. אנחנו נקודת עצירה טבעית לארוחה אחרי יום
            בשטח. בעונה העמוסה מומלץ מאוד לתאם מראש הגעה של קבוצה.
          </p>
        </Section>

        <Section title="חיילים ופעילויות">
          <p>
            אנחנו מארחים גם חיילים וקבוצות שמגיעות במסגרת פעילות באזור. לתיאום כמויות ואיסוף מרוכז — צרו קשר טלפוני
            ונסגור את הפרטים.
          </p>
        </Section>

        <Section title="התפריט">
          <p>
            בתפריט: המבורגר קלאסי, סמאש דאבל צ׳יז, קרייזי סמאש, קריספי צ׳יקן, עראיס, ספיישל הדגל, דיל חברים ודיל משפחתי,
            לצד צ׳יפס, צ׳יפס וופל, טבעות בצל בטמפורה, רטבים ומבחר שתייה ובירות. אפשר לצפות בתפריט המלא ולהזמין ישירות באתר.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild variant="outline"><Link to="/"><Utensils className="ml-2 w-4 h-4" /> לתפריט ולהזמנה</Link></Button>
            <Button asChild variant="outline"><Link to="/events">הזמנת אירוע</Link></Button>
          </div>
        </Section>

        <Section title="אירועים ואירוח בבקתה">
          <p>
            מעבר לקבוצות מזדמנות, אנחנו מפיקים גם אירועים — ימי הולדת, אירועי חברה ומפגשים משפחתיים. אפשר לקיים את האירוע
            אצלנו במקום (ישיבה על הדשא עם מחצלות בצל, או שולחנות וכיסאות) או להגיע אליכם. לסגירת אירוע מלאו את הפרטים
            בטופס או עברו לעמוד הזמנת האירועים.
          </p>
        </Section>

        <Section title="יצירת קשר">
          <p>
            טלפון: <a className="text-primary underline" href={`tel:${PHONE}`}>{PHONE}</a> · וואטסאפ:{" "}
            <a className="text-primary underline" href={WHATSAPP} target="_blank" rel="noopener noreferrer">שליחת הודעה</a>
            <br />
            כתובת: דרך ערבי נחל 23, מושב תושיה, מועצה אזורית שדות נגב.
          </p>
        </Section>

        <LeadForm id="lead-bottom" />
      </main>
    </div>
  );
};

export default Groups;
