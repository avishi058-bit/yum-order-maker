import { useEffect } from "react";
import { absUrl, type SeoPage } from "@/seo/pages";

/** Updates existing head tags in place (never duplicates canonical) for public pages. */
const upsertMeta = (attr: "name" | "property", key: string, value: string) => {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
};

const Seo = ({ page }: { page: SeoPage }) => {
  useEffect(() => {
    const prevTitle = document.title;
    const prevDesc = document.head.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
    document.title = page.title;
    upsertMeta("name", "description", page.description);
    upsertMeta("property", "og:title", page.title);
    upsertMeta("property", "og:description", page.description);
    upsertMeta("property", "og:url", absUrl(page.path));
    upsertMeta("name", "twitter:title", page.title);
    upsertMeta("name", "twitter:description", page.description);

    const canonicals = document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]');
    canonicals.forEach((c, i) => i > 0 && c.remove());
    const canonical = canonicals[0] ?? document.head.appendChild(Object.assign(document.createElement("link"), { rel: "canonical" }));
    canonical.href = absUrl(page.path);

    document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((l) => l.remove());
    page.alternates?.forEach((a) => {
      const l = document.createElement("link");
      l.rel = "alternate";
      l.hreflang = a.hreflang;
      l.href = absUrl(a.path);
      document.head.appendChild(l);
    });

    document.getElementById("seo-jsonld")?.remove();
    if (page.jsonLd) {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.id = "seo-jsonld";
      s.textContent = JSON.stringify(page.jsonLd);
      document.head.appendChild(s);
    }
    const prevLang = document.documentElement.lang;
    document.documentElement.lang = page.lang;

    return () => {
      document.title = prevTitle;
      upsertMeta("name", "description", prevDesc);
      document.head.querySelectorAll('link[rel="canonical"], link[rel="alternate"][hreflang]').forEach((l) => l.remove());
      document.getElementById("seo-jsonld")?.remove();
      document.documentElement.lang = prevLang;
    };
  }, [page]);
  return null;
};

export default Seo;
