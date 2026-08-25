import { PlayCircle, ExternalLink } from "lucide-react";

type IconProps = { className?: string };

const InstagramIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const YoutubeIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M23 12s0-3.6-.46-5.32a2.78 2.78 0 0 0-1.96-1.96C18.86 4.25 12 4.25 12 4.25s-6.86 0-8.58.47A2.78 2.78 0 0 0 1.46 6.7C1 8.4 1 12 1 12s0 3.6.46 5.3a2.78 2.78 0 0 0 1.96 1.97c1.72.47 8.58.47 8.58.47s6.86 0 8.58-.47a2.78 2.78 0 0 0 1.96-1.96C23 15.6 23 12 23 12ZM9.95 15.37V8.63L15.77 12l-5.82 3.37Z" />
  </svg>
);

type PressItem = {
  outlet: string;
  title: string;
  description: string;
  url: string;
  cta?: string;
};

const OUTLETS = [
  "ערוץ 13",
  "mako",
  "מקור ראשון",
  "ynet",
  "ישראל היום",
  "וואלה",
  "סרוגים",
  "Wolt",
];

const VIDEO_ID = "YDUMyeS4xrQ";
const VIDEO_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;

const ITEMS: PressItem[] = [
  {
    outlet: "mako",
    title: "״להיות במלון זה הרבה יותר קשה. אתה בחרדה ממה שהולך בבית״",
    description:
      "כתבת mako על הבקתה בתקופת מלחמת חרבות ברזל, החזרה לכפר מימון, הבישול לחיילים והקשר שנוצר עם חיילי הסדיר והמילואים באזור.",
    url: "https://www.mako.co.il/finances-news/Article-808851b37c68c81027.htm",
  },
  {
    outlet: "מקור ראשון · ביקורת אוכל",
    title: "בכפר מימון מצאנו את ההמבורגר המנצח",
    description:
      "מבקרי האוכל של מקור ראשון הגיעו לבקתה בכפר מימון וסיקרו את ההמבורגר, איכות הבשר והחוויה במקום.",
    url: "https://www.makorrishon.co.il/opinions/article/254998",
  },
  {
    outlet: "מקור ראשון",
    title: "סיור קולינרי בעוטף עזה: חמישה מקומות שאתם חייבים לאכול בהם",
    description: "הבקתה נבחרה כאחת מחמש התחנות בסיור הקולינרי של מקור ראשון בעוטף עזה.",
    url: "https://www.makorrishon.co.il/culture/article/252865",
  },
  {
    outlet: "דרום אדום · הבשור",
    title: "המבורגר הבקתה — המבורגר בוטיק באווירה כפרית",
    description:
      "עמוד המקום באתר התיירות הרשמי של הבשור–דרום אדום, המתאר את הבקתה כהמבורגר בוטיק באווירה כפרית עם ישיבה בחוץ.",
    url: "https://dev.habsor.co.il/?p=26324",
    cta: "לעמוד המלא",
  },
  {
    outlet: "ynet",
    title: "וולט מתחילה לפעול בשדרות, נתיבות ויישובי העוטף",
    description:
      "ynet מסקר את התרחבות Wolt לעוטף ומזכיר את המבורגר הבקתה בכפר מימון ואת החזרה לפעילות באזור.",
    url: "https://www.ynet.co.il/yedioth/article/yokra14001305",
  },
  {
    outlet: "ישראל היום",
    title: "מחיים את העסקים בדרום ובעוטף עזה: מסעדות האזור חוזרות לשגרה",
    description: "סיקור של חזרת עסקי האוכל בעוטף לפעילות, כולל הבקתה והסיפור שלה בכפר מימון.",
    url: "https://www.israelhayom.co.il/food/food-news/article/16161619",
  },
  {
    outlet: "ישראל היום",
    title: "Wolt מתחילה לפעול בעוטף עזה, שדרות ונתיבות",
    description: "הבקתה מופיעה בין עסקי האוכל המקומיים במסגרת כניסת Wolt לעוטף.",
    url: "https://www.israelhayom.co.il/food/food-news/article/16084465",
  },
  {
    outlet: "וואלה",
    title: "הנוחות מגיעה לעוטף: Wolt תפעל בעוטף עזה, שדרות ונתיבות",
    description: "וואלה מסקרת את כניסת Wolt לאזור ואת חזרת העסקים המקומיים, כולל המבורגר הבקתה.",
    url: "https://finance.walla.co.il/item/3677768",
  },
  {
    outlet: "סרוגים",
    title: "וולט הגיעה לעוטף: מאיזה מסעדות שווה להזמין?",
    description: "סרוגים הקדישו חלק לבקתה במסגרת המלצות האוכל שלהם מהעוטף.",
    url: "https://www.srugim.co.il/1019705-%D7%95%D7%95%D7%9C%D7%98-%D7%94%D7%92%D7%99%D7%A2%D7%94-%D7%9C%D7%A2%D7%95%D7%98%D7%A3-%D7%9E%D7%90%D7%99%D7%96%D7%94-%D7%9E%D7%A1%D7%A2%D7%93%D7%95%D7%AA-%D7%A9%D7%95%D7%95%D7%94-%D7%9C%D7%94%D7%96",
  },
  {
    outlet: "Wolt",
    title: "הגענו לנתיבות, שדרות ויישובי העוטף",
    description: "Wolt מספרת על העסקים המקומיים בעוטף, ובהם הבקתה, ועל החזרה לפעילות בתקופת המלחמה.",
    url: "https://wolt.com/he/isr/yavne/article/isr_g_nationalcampaign_netivot_sderot",
  },
  {
    outlet: "סיורים בעוטף עזה ושדרות",
    title: "המבורגר הבקתה",
    description:
      "עמוד תיירות ייעודי לבקתה המתאר את האווירה הכפרית, האוכל, הסיפור המקומי וההתאמה לקבוצות וסיורים בעוטף.",
    url: "https://www.oteftours.co.il/category/%D7%94%D7%9E%D7%91%D7%95%D7%A8%D7%92%D7%A8-%D7%94%D7%91%D7%A7%D7%AA%D7%94",
    cta: "לעמוד המלא",
  },
  {
    outlet: "מגזין נטו",
    title: "בואו לתמוך ולחזק את העסקים הנמצאים בעוטף עזה, שדרות ונתיבות",
    description:
      "כתבת סיור אוכל בעוטף שבה הבקתה היא אחת התחנות ומוזכרת כמקום שההמבורגרים שלו מוכרים באזור.",
    url: "https://www.netobatyam.co.il/entertainment/2853/",
  },
  {
    outlet: "יפה גביש · מה שמעניין",
    title: "בואו לתמוך ולחזק את העסקים הנמצאים בעוטף עזה, שדרות ונתיבות",
    description: "סיקור נוסף של סיור העסקים והאוכל באזור, עם תחנה בבקתה בכפר מימון.",
    url: "https://www.jaffagavishwhatsinteresting.com/post/_wolt",
  },
];

const SOCIALS = [
  { label: "אינסטגרם", href: "https://www.instagram.com/habikta_burgers/", Icon: InstagramIcon },
  { label: "טיקטוק", href: "https://www.tiktok.com/@habikta", Icon: null },
  { label: "יוטיוב", href: VIDEO_URL, Icon: YoutubeIcon },
];

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-1.86-2.48V9.77a5.7 5.7 0 1 0 4.95 5.64V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.29 4.29 0 0 1-3.24-1.48Z" />
  </svg>
);

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  name: "הבקתה — המבורגר של מושבניקים",
  subjectOf: [
    { "@type": "VideoObject", name: "אבישי שלזינגר - המבורגר הבקתה - מתארח בערוץ 13", url: VIDEO_URL },
    ...ITEMS.map((i) => ({
      "@type": "NewsArticle",
      headline: i.title,
      url: i.url,
      publisher: { "@type": "Organization", name: i.outlet },
    })),
  ],
};

const PressSection = () => {
  return (
    <section id="press" aria-labelledby="press-heading" className="py-14 px-4 border-t border-border">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="max-w-6xl mx-auto">
        <header className="text-center max-w-3xl mx-auto mb-8">
          <h2 id="press-heading" className="text-3xl md:text-4xl font-black mb-3">כתבו עלינו</h2>
          <p className="text-muted-foreground leading-relaxed">
            מהטלוויזיה והעיתונות ועד אתרי האוכל והתיירות — לאורך השנים הגיעו לבקתה כתבים, מבקרי אוכל וגופי תקשורת
            שסיפרו על ההמבורגר, האנשים, האווירה והסיפור שלנו בעוטף.
          </p>
        </header>

        {/* Media wall — mobile: smooth snap carousel with edge fades; desktop: centered wrap */}
        <div className="relative mb-10">
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-10 z-10 md:hidden bg-gradient-to-l from-background to-transparent"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-10 z-10 md:hidden bg-gradient-to-r from-background to-transparent"
            aria-hidden="true"
          />
          <ul
            className="flex md:flex-wrap gap-3 md:gap-6 justify-start md:justify-center overflow-x-auto md:overflow-visible snap-x snap-mandatory scroll-smooth overscroll-x-contain pb-3 -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="כלי תקשורת שסיקרו את הבקתה"
          >
            {OUTLETS.map((name) => (
              <li
                key={name}
                className="shrink-0 snap-center rounded-2xl border border-border bg-card/60 px-5 py-3 text-sm md:text-base font-black tracking-wide text-muted-foreground whitespace-nowrap"
              >
                {name}
              </li>
            ))}
          </ul>
          <p className="md:hidden text-center text-[11px] text-muted-foreground/70 -mt-1">
            החליקו הצידה לעוד ←
          </p>
        </div>


        <div className="grid gap-5 md:grid-cols-3">
          {/* Featured video card */}
          <article className="md:col-span-2 group rounded-3xl overflow-hidden border border-border bg-card shadow-sm hover:shadow-lg transition-shadow">
            <a
              href={VIDEO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="לצפייה בכתבה של ערוץ 13 על המבורגר הבקתה ביוטיוב"
              className="block"
            >
              <div className="relative aspect-video bg-muted">
                <img
                  src={`https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`}
                  alt="אבישי שלזינגר מהמבורגר הבקתה מתארח בערוץ 13 בתוכנית פותחים שישי"
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/35 transition-colors">
                  <PlayCircle className="w-16 h-16 text-white drop-shadow-lg" aria-hidden="true" />
                </span>
              </div>
              <div className="p-5 space-y-2">
                <p className="text-xs font-black text-primary">ערוץ 13 · כתבה מצולמת</p>
                <h3 className="text-xl font-black leading-snug">
                  אבישי שלזינגר - המבורגר הבקתה - מתארח בערוץ 13
                </h3>
                <p className="text-sm text-muted-foreground">הבקתה מתארחת בתוכנית ״פותחים שישי״ בערוץ 13.</p>
                <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
                  לצפייה בכתבה <ExternalLink className="w-4 h-4" aria-hidden="true" />
                </span>
              </div>
            </a>
          </article>

          {ITEMS.map((item) => (
            <article
              key={item.url}
              className="rounded-3xl border border-border bg-card p-5 flex flex-col gap-2 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <p className="text-xs font-black text-primary">{item.outlet}</p>
              <h3 className="text-lg font-black leading-snug">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${item.title} — ${item.outlet} (נפתח בחלון חדש)`}
                  className="hover:underline"
                >
                  {item.title}
                </a>
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">{item.description}</p>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
              >
                {item.cta || "לכתבה המלאה"} <ExternalLink className="w-4 h-4" aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>

        <div className="mt-12 text-center">
          <h3 className="text-2xl font-black mb-4">עקבו אחרי הבקתה</h3>
          <div className="flex items-center justify-center gap-3">
            {SOCIALS.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${label} של המבורגר הבקתה (נפתח בחלון חדש)`}
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 font-bold hover:border-primary hover:text-primary transition-colors"
              >
                {Icon ? <Icon className="w-5 h-5" aria-hidden="true" /> : <TikTokIcon className="w-5 h-5" />}
                <span className="text-sm">{label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PressSection;
