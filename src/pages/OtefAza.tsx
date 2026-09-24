import { useEffect } from "react";
import raw from "@/content/otef-aza.txt?raw";

const blocks = raw.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
const isHeading = (t: string) => t.length < 90 && !/[.:!]$/.test(t);

const OtefAza = () => {
  useEffect(() => {
    document.title = "המבורגר בעוטף עזה — הבקתה, כפר מימון (תושיה)";
  }, []);
  const [title, ...rest] = blocks;
  return (
    <main className="min-h-screen bg-background py-12 px-4" dir="rtl">
      <article className="max-w-3xl mx-auto space-y-5 text-foreground/90 leading-relaxed">
        <h1 className="text-3xl font-black text-foreground">{title} — הבקתה, המבורגר של מושבניקים</h1>
        {rest.map((b, i) =>
          isHeading(b) ? (
            <h2 key={i} className="text-xl font-bold text-foreground pt-4">{b}</h2>
          ) : (
            <p key={i}>{b}</p>
          ),
        )}
        <div className="pt-8 flex gap-6 font-bold">
          <a href="/" className="text-primary hover:underline">להזמנה ←</a>
          <a href="/groups" className="text-primary hover:underline">אירוח קבוצות ←</a>
        </div>
      </article>
    </main>
  );
};

export default OtefAza;
