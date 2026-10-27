import Seo from "@/components/Seo";
import { SEO_PAGES } from "@/seo/pages";

/** "Where to eat on a Gaza Envelope tour" guide - text lives in SEO_PAGES.otefTourLunch. */
const page = SEO_PAGES.otefTourLunch;

const GroupsCta = () => (
  <a
    href="/groups"
    className="block rounded-2xl bg-primary text-primary-foreground p-5 text-center text-lg font-black hover:opacity-90"
  >
    מסלולים ותיאום לקבוצות - עד 200 איש ←
  </a>
);

const OtefTourLunch = () => (
  <main className="min-h-screen bg-background py-12 px-4" dir="rtl">
    <Seo page={page} />
    <article className="max-w-3xl mx-auto space-y-5 text-foreground/90 leading-relaxed">
      <h1 className="text-3xl font-black text-foreground">{page.h1}</h1>
      <p className="text-lg">{page.intro}</p>
      <GroupsCta />
      {(page.sections ?? []).map((s) => (
        <section key={s.h2} className="space-y-3">
          <h2 className="text-xl font-bold text-foreground pt-4">{s.h2}</h2>
          {s.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      ))}
      <GroupsCta />
      <div className="pt-4 flex flex-wrap gap-6 font-bold">
        {(page.links ?? []).map((l) => (
          <a key={l.href} href={l.href} className="text-primary hover:underline">
            {l.label}
          </a>
        ))}
      </div>
    </article>
  </main>
);

export default OtefTourLunch;
