import { useEffect } from "react";
import Seo from "@/components/Seo";
import { SEO_PAGES } from "@/seo/pages";

/**
 * Groups landing page (/groups).
 * The page itself is a self-contained static design in public/groups-page/
 * (GSAP + Lenis animations), shown full-screen in a same-origin frame.
 * SEO title/description stay here via <Seo>; crawler text comes from the
 * seoPrerender plugin (SEO_PAGES.groups).
 * Rollback: point the /groups route in App.tsx back to ./pages/GroupsLegacy.
 */
const Groups = () => {
  useEffect(() => {
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  return (
    <>
      <Seo page={SEO_PAGES.groups} />
      <h1 className="sr-only">{SEO_PAGES.groups.title}</h1>
      <iframe
        src="/groups-page/index.html"
        title="המבורגר הבקתה - עצירת צהריים לקבוצות"
        className="fixed inset-0 z-40 h-[100dvh] w-full border-0 bg-[#f4e4d0]"
        allow="autoplay; fullscreen"
      />
    </>
  );
};

export default Groups;
