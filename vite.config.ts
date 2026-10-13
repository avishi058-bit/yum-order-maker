import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { SEO_PAGES } from "./src/seo/pages";
import { prerenderPage, renderBody } from "./src/seo/prerender";

/** Writes dist/<route>/index.html with the page's own head + crawler text. */
function seoPrerender(): Plugin {
  return {
    name: "seo-prerender",
    apply: "build",
    closeBundle() {
      const dist = path.resolve(__dirname, "dist");
      const tplPath = path.join(dist, "index.html");
      if (!fs.existsSync(tplPath)) return;
      const tpl = fs.readFileSync(tplPath, "utf8");
      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const otefBlocks = fs
        .readFileSync(path.resolve(__dirname, "src/content/otef-aza.txt"), "utf8")
        .split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
      const [otefTitle, ...otefRest] = otefBlocks;
      const otefHtml = [
        `<h1>${esc(otefTitle)} - הבקתה, המבורגר של מושבניקים</h1>`,
        ...otefRest.map((b) => (b.length < 90 && !/[.:!]$/.test(b) ? `<h2>${esc(b)}</h2>` : `<p>${esc(b)}</p>`)),
      ];
      const pages = [
        { page: SEO_PAGES.groups, body: renderBody(SEO_PAGES.groups) },
        { page: SEO_PAGES.groupsEn, body: renderBody(SEO_PAGES.groupsEn) },
        { page: SEO_PAGES.otefAza, body: renderBody(SEO_PAGES.otefAza, otefHtml) },
      ];
      for (const { page, body } of pages) {
        const out = path.join(dist, page.path.replace(/^\//, ""), "index.html");
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, prerenderPage(tpl, page, body));
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), seoPrerender()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    // Split vendor libraries into separate chunks so the initial customer page
    // doesn't have to download admin/kitchen-only deps (framer, charts, etc.).
    // Heavy libs (html2canvas, jspdf) stay dynamic-imported at their call sites.
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "query-vendor": ["@tanstack/react-query"],
          "ui-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
          ],
          "motion": ["framer-motion"],
          "supabase": ["@supabase/supabase-js"],
        },
      },
    },
  },
}));
