import { useEffect, useRef } from "react";
import { Bus, Clock, MapPin, Phone, Users, Utensils, Leaf, Trees, Globe2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import Seo from "@/components/Seo";
import { GROUPS_WHATSAPP_URL_EN } from "@/data/groupsContact";
import { GROUPS_FAQ_EN, GROUPS_SECTIONS_EN, SEO_PAGES } from "@/seo/pages";
import logo from "@/assets/habikta-logo.jpeg.asset.json";
import event1 from "@/assets/events/event1.jpeg.asset.json";

const PHONE = "+972-58-4633555";
const WAZE = "https://waze.com/ul?q=דרך%20ערבי%20נחל%2021%20תושיה";
const page = SEO_PAGES.groupsEn;

const WhatsAppButton = ({ label = "Message us on WhatsApp" }: { label?: string }) => (
  <Button asChild size="lg" className="h-auto min-h-12 whitespace-normal border border-green bg-card text-foreground hover:bg-card/90 text-base font-bold">
    <a href={GROUPS_WHATSAPP_URL_EN} target="_blank" rel="noopener noreferrer">{label}</a>
  </Button>
);

const HIGHLIGHTS = [
  { icon: MapPin, text: "Kfar Maimon - fits Gaza Envelope tour routes" },
  { icon: MapPin, text: "Short drive from the Nova site and Tkuma" },
  { icon: Bus, text: "Convenient bus parking right next to us" },
  { icon: Users, text: "Close coordination with your guide" },
  { icon: Clock, text: "30-45 minute stop for groups in a hurry" },
  { icon: Users, text: "Groups of 20 to 200 people, booked in advance" },
  { icon: Utensils, text: "Per-person group menus for every budget" },
  { icon: Leaf, text: "Vegetarian/vegan and gluten-free options" },
  { icon: Trees, text: "Lawns, shade trees and a covered pergola" },
  { icon: Globe2, text: "Experienced with groups from the US, Canada and China" },
];

const GroupsEn = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = 0.5;
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(() => {});
    });
  }, []);

  return (
    <div dir="ltr" lang="en" className="theme-sand min-h-screen bg-background text-foreground">
      <Seo page={page} />
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
        <div className="max-w-5xl mx-auto px-4 min-h-16 py-1.5 flex items-center justify-between gap-2">
          <a href="/" className="flex items-center">
            <img src={logo.url} alt="HaBikta" className="h-12 w-12 object-contain rounded-full ring-2 ring-primary-foreground/60" />
          </a>
          <div className="flex flex-wrap items-center gap-2">
            <a href={WAZE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-sm font-bold">
              <img src="/waze-icon.png" alt="" aria-hidden="true" className="w-4 h-4 rounded" /> Directions
            </a>
            <a href={`tel:${PHONE}`} className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-sm font-bold">
              <Phone className="w-4 h-4" /> Call
            </a>
            <a href={GROUPS_WHATSAPP_URL_EN} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-sm font-bold">
              WhatsApp
            </a>
            <a href="/groups" hrefLang="he" lang="he" className="text-sm font-bold underline underline-offset-4 px-1">עברית</a>
          </div>
        </div>
      </header>

      <section className="relative">
        <img src={event1.url} alt="A tour group having lunch at HaBikta, Kfar Maimon" className="w-full h-[58vh] min-h-[340px] object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/45 to-foreground/20" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-5xl mx-auto w-full px-4 pb-8 space-y-3 text-background">
            <p className="inline-flex items-center gap-2 rounded-full bg-background/20 backdrop-blur px-3 py-1 text-xs font-bold">
              <MapPin className="w-4 h-4" /> Kfar Maimon · Sdot Negev · Gaza Envelope
            </p>
            <h1 className="text-3xl md:text-5xl font-black leading-tight drop-shadow">{page.h1}</h1>
            <p className="text-base md:text-xl font-bold leading-relaxed max-w-2xl">{page.intro}</p>
            <WhatsAppButton />
          </div>
        </div>
      </section>

      <section aria-label="A guide on our lunch stop" className="px-4 py-6 bg-background">
        <video
          ref={videoRef}
          className="block w-full max-w-[400px] mx-auto aspect-[9/16] rounded-lg bg-foreground object-contain"
          controls
          playsInline
          autoPlay
          preload="auto"
          poster="/habikta-guide-otef-reel-poster.jpg"
          aria-label="A tour guide talks about the lunch stop at HaBikta"
        >
          <source src="/habikta-guide-otef-reel.mp4" type="video/mp4" />
        </video>
      </section>

      <div className="bg-secondary">
        <div className="max-w-5xl mx-auto px-4 py-5 grid grid-cols-3 gap-3 text-center">
          {[
            { k: "Up to 200", v: "people, booked ahead" },
            { k: "30-45 min", v: "lunch stop" },
            { k: "220 g", v: "burger patty" },
          ].map((s) => (
            <div key={s.k}>
              <p className="text-xl md:text-3xl font-black text-primary">{s.k}</p>
              <p className="text-xs md:text-sm text-muted-foreground font-bold">{s.v}</p>
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-12">
        <div className="space-y-8">
          {GROUPS_SECTIONS_EN.map((s) => (
            <section key={s.h2} className="space-y-3">
              <h2 className="text-2xl md:text-3xl font-black text-primary">{s.h2}</h2>
              {s.paragraphs.map((p) => (
                <p key={p} className="text-base md:text-lg leading-relaxed text-foreground/90">{p}</p>
              ))}
            </section>
          ))}
        </div>

        <section>
          <h2 className="text-2xl md:text-4xl font-black text-center text-primary mb-6">Why groups choose HaBikta</h2>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-sm font-bold leading-relaxed">{text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-2xl md:text-4xl font-black text-center text-primary mb-6">FAQ</h2>
          <div className="space-y-3">
            {GROUPS_FAQ_EN.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-border bg-card p-4">
                <summary className="cursor-pointer font-black list-none flex items-center justify-between gap-3">
                  <h3 className="text-base">{f.q}</h3>
                  <ChevronDown className="w-5 h-5 text-primary shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="pt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <section className="max-w-5xl mx-auto px-4 py-12 space-y-6 text-center">
        <h2 className="text-2xl md:text-4xl font-black text-primary">Planning your tour?</h2>
        <div className="flex flex-wrap justify-center gap-3">
          <WhatsAppButton />
          <Button asChild size="lg" variant="outline">
            <a href={`tel:${PHONE}`}><Phone className="mr-2 w-5 h-5" /> {PHONE}</a>
          </Button>
        </div>
      </section>

      {/* Tourist testimonial from Canada - vertical 9:16 reel, bottom of the page */}
      <section aria-label="Tourist testimonial from Canada" className="px-4 py-8 bg-background">
        <div className="max-w-5xl mx-auto space-y-5 text-center">
          <h2 className="text-2xl md:text-4xl font-black text-primary">Tourists who came to us from Canada 🇨🇦</h2>
          <p className="text-base md:text-lg font-bold text-muted-foreground">This is what a lunch at HaBikta looks like after a Gaza Envelope tour</p>
          <video
            className="block w-full max-w-[360px] mx-auto aspect-[9/16] rounded-lg bg-foreground object-contain"
            controls
            playsInline
            muted
            loop
            preload="metadata"
            poster="/habikta-canada-reel-poster.jpg"
            aria-label="Tourists from Canada talk about their lunch at HaBikta"
          >
            <source src="/habikta-canada-reel.mp4" type="video/mp4" />
            Your browser cannot play this video.
          </video>
          <div className="flex justify-center">
            <WhatsAppButton label="Arrange a group meal on WhatsApp" />
          </div>
        </div>
      </section>
    </div>
  );
};

export default GroupsEn;
