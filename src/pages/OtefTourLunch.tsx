import Seo from "@/components/Seo";
import { SEO_PAGES } from "@/seo/pages";

/**
 * "Where to eat on a Gaza Envelope tour" guide, Hebrew and English.
 * Text lives in SEO_PAGES.otefTourLunch / otefTourLunchEn.
 */
type Lang = "he" | "en";

const COPY = {
  he: { page: SEO_PAGES.otefTourLunch, cta: "מסלולים ותיאום לקבוצות - עד 200 איש ←", ctaHref: "/groups", other: "/en/otef-tour-lunch" },
  en: { page: SEO_PAGES.otefTourLunchEn, cta: "Group menus and booking - up to 200 people →", ctaHref: "/en/groups", other: "/otef-tour-lunch" },
} as const;

const LangSwitch = ({ lang }: { lang: Lang }) => {
  const btn = (l: Lang, label: string) => {
    const active = l === lang;
    return (
      <a
        href={COPY[l].page.path}
        lang={l}
        aria-current={active ? "page" : undefined}
        className={`min-w-[64px] px-4 py-2 rounded-full text-sm font-black text-center transition-colors ${
          active ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:text-foreground"
        }`}
      >
        {label}
      </a>
    );
  };
  return (
    <nav aria-label={lang === "en" ? "Language" : "שפה"} className="flex justify-end">
      <div className="inline-flex gap-1 rounded-full border border-border bg-card p-1" dir="ltr">
        {btn("he", "עברית")}
        {btn("en", "English")}
      </div>
    </nav>
  );
};

const OtefTourLunch = ({ lang = "he" }: { lang?: Lang }) => {
  const { page, cta, ctaHref } = COPY[lang];
  const Cta = () => (
    <a
      href={ctaHref}
      className="block rounded-2xl bg-primary text-primary-foreground p-5 text-center text-lg font-black hover:opacity-90"
    >
      {cta}
    </a>
  );
  return (
    <main className="min-h-screen bg-background py-8 px-4" dir={lang === "en" ? "ltr" : "rtl"} lang={lang}>
      <Seo page={page} />
      <article className="max-w-3xl mx-auto space-y-5 text-foreground/90 leading-relaxed">
        <LangSwitch lang={lang} />
        <h1 className="text-3xl font-black text-foreground">{page.h1}</h1>
        <p className="text-lg">{page.intro}</p>
        <Cta />
        {(page.sections ?? []).map((s) => (
          <section key={s.h2} className="space-y-3">
            <h2 className="text-xl font-bold text-foreground pt-4">{s.h2}</h2>
            {s.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </section>
        ))}
        <Cta />
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
};

export default OtefTourLunch;
