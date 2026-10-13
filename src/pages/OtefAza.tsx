import raw from "@/content/otef-aza.txt?raw";
import Seo from "@/components/Seo";
import { SEO_PAGES } from "@/seo/pages";

const blocks = raw.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
const isHeading = (t: string) => t.length < 90 && !/[.:!]$/.test(t);

const GroupsCta = () => (
  <a
    href="/groups"
    className="block rounded-2xl bg-primary text-primary-foreground p-5 text-center text-lg font-black hover:opacity-90"
  >
    מארגנים סיור בעוטף? אוכל לקבוצות ומשלחות - עד 200 איש ←
  </a>
);

const OtefAza = () => {
  const [title, ...rest] = blocks;
  return (
    <main className="min-h-screen bg-background py-12 px-4" dir="rtl">
      <Seo page={SEO_PAGES.otefAza} />
      <article className="max-w-3xl mx-auto space-y-5 text-foreground/90 leading-relaxed">
        <h1 className="text-3xl font-black text-foreground">{title} - הבקתה, המבורגר של מושבניקים</h1>
        <GroupsCta />
        {rest.map((b, i) =>
          isHeading(b) ? (
            <h2 key={i} className="text-xl font-bold text-foreground pt-4">{b}</h2>
          ) : (
            <p key={i}>{b}</p>
          ),
        )}
        <GroupsCta />
        <div className="pt-4 flex gap-6 font-bold">
          <a href="/" className="text-primary hover:underline">להזמנה ←</a>
          <a href="/groups" className="text-primary hover:underline">אירוח קבוצות ←</a>
        </div>
      </article>
    </main>
  );
};

export default OtefAza;
