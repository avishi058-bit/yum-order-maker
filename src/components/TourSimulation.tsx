import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * The scroll-driven tour day (public/groups-tour.html) shown inside the groups page.
 * The frame only takes the scroll once it fills the screen, so scrolling the page
 * never gets caught by a half-visible map; at the end of the trip the scroll carries
 * on into the page. Visitors can skip it at any point.
 */
const TourSimulation = ({ src = "/groups-tour.html?embed=1", afterId = "after-tour-sim" }: { src?: string; afterId?: string }) => {
  const frameBox = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = frameBox.current;
    if (!el || !("IntersectionObserver" in window)) {
      setActive(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setActive(entry.intersectionRatio >= 0.9), {
      rootMargin: "-64px 0px 0px 0px",
      threshold: [0, 0.5, 0.9, 1],
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const skip = () => document.getElementById(afterId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const enter = () => frameBox.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <>
      <section aria-labelledby="tour-sim-title" className="bg-secondary">
        <div className="max-w-5xl mx-auto px-4 pt-8 pb-5 space-y-3 text-center">
          <h2 id="tour-sim-title" className="text-2xl md:text-4xl font-black text-primary">
            סימולציית סיור: יום בעוטף עם עצירה אצלנו
          </h2>
          <p className="text-base md:text-lg font-bold text-muted-foreground max-w-2xl mx-auto">
            גללו והאוטובוס יוצא לדרך: שדרות, אתר הנובה, צהריים בבקתה ואתר המכוניות בתקומה.
          </p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-bold">
            <button type="button" onClick={enter} className="underline underline-offset-4 text-primary">
              להתחיל את הסימולציה
            </button>
            <button type="button" onClick={skip} className="underline underline-offset-4 text-muted-foreground">
              דלגו על הסימולציה
            </button>
          </div>
        </div>
      </section>
      <div
        ref={frameBox}
        className="relative scroll-mt-16 bg-secondary"
        style={{ height: "calc(100svh - 64px)" }}
      >
        <iframe
          src={src}
          title="סימולציית יום סיור בעוטף עם עצירת צהריים בבקתה"
          loading="lazy"
          allow="autoplay; fullscreen"
          className={`block w-full h-full border-0 ${active ? "" : "pointer-events-none"}`}
        />
        <button
          type="button"
          onClick={skip}
          className="absolute bottom-4 right-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-foreground/85 text-background px-4 min-h-11 text-sm font-bold shadow-lg"
        >
          דלגו על הסימולציה <ChevronDown className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      <div id={afterId} className="scroll-mt-16" />
    </>
  );
};

export default TourSimulation;
