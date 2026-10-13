/** Build-time HTML transform: bakes a page's head + crawler text into index.html. */
import { absUrl, type SeoPage } from "./pages";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const setMeta = (html: string, attr: "name" | "property", key: string, value: string) => {
  const re = new RegExp(`<meta\\s+${attr}="${key}"\\s+content="[^"]*"\\s*/?>`);
  const tag = `<meta ${attr}="${key}" content="${esc(value)}" />`;
  return re.test(html) ? html.replace(re, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
};

export function renderBody(page: SeoPage, extraParagraphs: string[] = []): string {
  const parts: string[] = [];
  if (page.h1) parts.push(`<h1>${esc(page.h1)}</h1>`);
  if (page.intro) parts.push(`<p>${esc(page.intro)}</p>`);
  extraParagraphs.forEach((p) => parts.push(p));
  page.sections?.forEach((s) => {
    parts.push(`<h2>${esc(s.h2)}</h2>`);
    s.paragraphs.forEach((p) => parts.push(`<p>${esc(p)}</p>`));
  });
  if (page.faq?.length) {
    parts.push(`<h2>${page.lang === "en" ? "FAQ" : "שאלות נפוצות"}</h2>`);
    page.faq.forEach((f) => parts.push(`<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`));
  }
  page.links?.forEach((l) => parts.push(`<p><a href="${esc(l.href)}">${esc(l.label)}</a></p>`));
  return `<main dir="${page.lang === "en" ? "ltr" : "rtl"}" lang="${page.lang}">${parts.join("")}</main>`;
}

export function prerenderPage(template: string, page: SeoPage, bodyHtml?: string): string {
  let html = template;
  const dir = page.lang === "en" ? "ltr" : "rtl";
  html = html.replace(/<html[^>]*>/, `<html lang="${page.lang}" dir="${dir}">`);
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(page.title)}</title>`);
  html = setMeta(html, "name", "description", page.description);
  html = setMeta(html, "property", "og:title", page.title);
  html = setMeta(html, "property", "og:description", page.description);
  html = setMeta(html, "property", "og:url", absUrl(page.path));
  html = setMeta(html, "property", "og:locale", page.lang === "en" ? "en_US" : "he_IL");
  html = setMeta(html, "name", "twitter:title", page.title);
  html = setMeta(html, "name", "twitter:description", page.description);

  // Exactly one canonical, always self-referencing.
  html = html.replace(/\s*<link rel="canonical"[^>]*>/g, "");
  html = html.replace(/\s*<link rel="alternate" hreflang[^>]*>/g, "");
  const links = [`<link rel="canonical" href="${absUrl(page.path)}" />`];
  page.alternates?.forEach((a) =>
    links.push(`<link rel="alternate" hreflang="${a.hreflang}" href="${absUrl(a.path)}" />`),
  );
  html = html.replace("</head>", `    ${links.join("\n    ")}\n  </head>`);

  if (page.jsonLd) {
    const ld = `<script type="application/ld+json" id="seo-jsonld">${JSON.stringify(page.jsonLd).replace(/</g, "\\u003c")}</script>`;
    html = html.replace(/<script type="application\/ld\+json" id="site-jsonld">[\s\S]*?<\/script>/, ld);
  }
  if (bodyHtml) html = html.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`);
  return html;
}
