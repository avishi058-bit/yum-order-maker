import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { SEO_PAGES } from "./pages";
import { prerenderPage, renderBody } from "./prerender";

const tpl = readFileSync("index.html", "utf8");
const count = (s: string, re: RegExp) => (s.match(re) || []).length;

describe("public page prerender", () => {
  it("static index.html has no canonical (it is the fallback for every route)", () => {
    expect(count(tpl, /rel="canonical"/g)).toBe(0);
  });
  it("/groups has exactly one self canonical on the right domain", () => {
    const html = prerenderPage(tpl, SEO_PAGES.groups, renderBody(SEO_PAGES.groups));
    expect(count(html, /rel="canonical"/g)).toBe(1);
    expect(html).toContain('<link rel="canonical" href="https://habikta-burger.lovable.app/groups" />');
    expect(html).not.toContain("yum-order-maker");
    expect(html).toContain("<title>אוכל לקבוצות בסיור בעוטף עזה | ארוחת צהריים בהבקתה, כפר מימון</title>");
    expect(html).toContain('hreflang="en" href="https://habikta-burger.lovable.app/en/groups"');
  });
  it("/en/groups is English LTR with its own canonical", () => {
    const html = prerenderPage(tpl, SEO_PAGES.groupsEn);
    expect(html).toContain('<html lang="en" dir="ltr">');
    expect(html).toContain('<link rel="canonical" href="https://habikta-burger.lovable.app/en/groups" />');
  });
});
