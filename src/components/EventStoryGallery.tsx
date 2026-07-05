import { useEffect, useRef, useState } from "react";
import event1 from "@/assets/events/event1.jpeg.asset.json";
import event2 from "@/assets/events/event2.jpeg.asset.json";
import event3 from "@/assets/events/event3.jpeg.asset.json";
import event4 from "@/assets/events/event4.jpeg.asset.json";
import event5 from "@/assets/events/event5.jpeg.asset.json";
import { ChevronLeft, ChevronRight } from "lucide-react";

const IMAGES: { url: string; caption: string }[] = [
  { url: event2.url, caption: "🍔 שולחן שוק אצלנו בהבקתה" },
  { url: event1.url, caption: "🎉 שולחן שוק המבורגרים מלא!" },
  { url: event3.url, caption: "👨‍👩‍👧 אירועים משפחתיים" },
  { url: event4.url, caption: "🌳 אירועים חוץ בפארק" },
  { url: event5.url, caption: "🥳 קבוצות ותיירות" },
];

const DURATION = 4000;

const EventStoryGallery = () => {
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const paused = useRef(false);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      if (paused.current) return;
      setProgress((p) => {
        if (p >= 100) {
          setIdx((i) => (i + 1) % IMAGES.length);
          return 0;
        }
        return p + 100 / (DURATION / 50);
      });
    }, 50);
    return () => clearInterval(t);
  }, []);

  useEffect(() => setProgress(0), [idx]);

  const go = (delta: number) => {
    setIdx((i) => (i + delta + IMAGES.length) % IMAGES.length);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    paused.current = true;
    startX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    paused.current = false;
    if (startX.current == null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(dx) > 40) go(dx > 0 ? -1 : 1); // RTL: swipe right → prev
    startX.current = null;
  };

  return (
    <div
      className="relative w-full aspect-[9/16] max-h-[420px] rounded-2xl overflow-hidden bg-black shadow-lg select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseDown={() => { paused.current = true; }}
      onMouseUp={() => { paused.current = false; }}
      onMouseLeave={() => { paused.current = false; }}
    >
      {/* progress bars */}
      <div className="absolute top-2 inset-x-2 z-20 flex gap-1">
        {IMAGES.map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden">
            <div
              className="h-full bg-white transition-all"
              style={{ width: i < idx ? "100%" : i === idx ? `${progress}%` : "0%" }}
            />
          </div>
        ))}
      </div>

      {IMAGES.map((img, i) => (
        <img
          key={i}
          src={img.url}
          alt={img.caption}
          loading={i === 0 ? "eager" : "lazy"}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            i === idx ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-10 z-10">
        <p className="text-white font-bold text-lg drop-shadow">{IMAGES[idx].caption}</p>
      </div>

      <button
        onClick={() => go(-1)}
        aria-label="הקודם"
        className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 text-white rounded-full p-2"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
      <button
        onClick={() => go(1)}
        aria-label="הבא"
        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 text-white rounded-full p-2"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
    </div>
  );
};

export default EventStoryGallery;
