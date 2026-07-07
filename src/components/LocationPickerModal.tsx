import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, MapPin, Crosshair, Check, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// Load the Google Maps JS API once, using the browser (referrer-restricted) key.
let mapsLoaderPromise: Promise<void> | null = null;
const loadMaps = (): Promise<void> => {
  if (mapsLoaderPromise) return mapsLoaderPromise;
  mapsLoaderPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if ((window as any).google?.maps) return resolve();
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    if (!key) return reject(new Error("missing browser key"));
    (window as any).__initDeliveryMap = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&libraries=places&callback=__initDeliveryMap&channel=${channel ?? ""}&language=he&region=IL`;
    s.async = true;
    s.onerror = () => reject(new Error("maps script failed"));
    document.head.appendChild(s);
  });
  return mapsLoaderPromise;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (loc: { lat: number; lng: number }) => void;
  initial?: { lat: number; lng: number } | null;
}

// Default: תושיה (מושב תושיה, עמק יזרעאל)
const DEFAULT_CENTER = { lat: 32.5286, lng: 35.2361 };

interface Suggestion {
  placeId: string;
  primary: string;
  secondary: string;
}

const LocationPickerModal = ({ open, onClose, onConfirm, initial }: Props) => {
  const mapDiv = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const sessionTokenRef = useRef<any>(null);
  const searchDebounceRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(initial ?? null);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        await loadMaps();
        if (cancelled || !mapDiv.current) return;
        const g = (window as any).google;
        const center = initial ?? DEFAULT_CENTER;
        const map = new g.maps.Map(mapDiv.current, {
          center, zoom: 15, disableDefaultUI: true, zoomControl: true, clickableIcons: false,
        });
        const marker = new g.maps.Marker({ position: center, map, draggable: true });
        mapRef.current = map;
        markerRef.current = marker;
        setPicked(center);

        map.addListener("click", (e: any) => {
          const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          marker.setPosition(pos);
          setPicked(pos);
        });
        marker.addListener("dragend", () => {
          const p = marker.getPosition();
          setPicked({ lat: p.lat(), lng: p.lng() });
        });

        try {
          const { AutocompleteSessionToken } = await g.maps.importLibrary("places");
          sessionTokenRef.current = new AutocompleteSessionToken();
        } catch (e) {
          console.warn("places lib failed", e);
        }

        setReady(true);
      } catch (e) {
        console.error(e);
        toast({ title: "טעינת המפה נכשלה", variant: "destructive" });
      }
    })();
    return () => {
      cancelled = true;
      setReady(false);
      mapRef.current = null;
      markerRef.current = null;
      sessionTokenRef.current = null;
      setSuggestions([]);
      setSearchQuery("");
    };
  }, [open, initial]);

  const runSearch = async (input: string) => {
    if (!input || input.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    try {
      const g = (window as any).google;
      const { AutocompleteSuggestion } = await g.maps.importLibrary("places");
      const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: sessionTokenRef.current,
        includedRegionCodes: ["il"],
        language: "he",
      });
      const mapped: Suggestion[] = (results ?? [])
        .map((s: any) => s.placePrediction)
        .filter(Boolean)
        .slice(0, 6)
        .map((p: any) => ({
          placeId: p.placeId,
          primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
          secondary: p.structuredFormat?.secondaryText?.text ?? "",
        }));
      setSuggestions(mapped);
    } catch (e) {
      console.warn("autocomplete failed", e);
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  };

  const onSearchChange = (v: string) => {
    setSearchQuery(v);
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = window.setTimeout(() => runSearch(v), 250);
  };

  const pickSuggestion = async (s: Suggestion) => {
    try {
      const g = (window as any).google;
      const { Place } = await g.maps.importLibrary("places");
      const place = new Place({ id: s.placeId });
      await place.fetchFields({ fields: ["location", "formattedAddress"] });
      const loc = place.location;
      if (!loc) return;
      const p = { lat: loc.lat(), lng: loc.lng() };
      setPicked(p);
      setSuggestions([]);
      setSearchQuery(place.formattedAddress ?? s.primary);
      if (mapRef.current && markerRef.current) {
        mapRef.current.panTo(p);
        mapRef.current.setZoom(17);
        markerRef.current.setPosition(p);
      }
      // reset session token after selection
      const { AutocompleteSessionToken } = await g.maps.importLibrary("places");
      sessionTokenRef.current = new AutocompleteSessionToken();
    } catch (e) {
      console.warn("place details failed", e);
      toast({ title: "שגיאה בטעינת המקום", variant: "destructive" });
    }
  };

  const useCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      toast({ title: "הדפדפן לא תומך במיקום", variant: "destructive" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPicked(p);
        if (mapRef.current && markerRef.current) {
          mapRef.current.panTo(p);
          mapRef.current.setZoom(17);
          markerRef.current.setPosition(p);
        }
      },
      (err) => {
        setLocating(false);
        toast({
          title: "לא הצלחנו לאתר את המיקום",
          description: err.code === 1 ? "יש לאשר גישה למיקום בהגדרות הדפדפן" : "נסה/י שוב או בחר/י ידנית במפה",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3"
        dir="rtl"
      >
        <motion.div
          initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
          className="bg-card rounded-2xl w-full max-w-lg p-4 shadow-2xl relative flex flex-col gap-3"
        >
          <button
            onClick={onClose}
            className="absolute top-3 left-3 p-2 rounded-full hover:bg-secondary text-muted-foreground z-10"
            aria-label="סגור"
          >
            <X size={20} />
          </button>
          <h3 className="text-lg font-black text-foreground flex items-center gap-2">
            <MapPin size={18} className="text-primary" /> בחר/י מיקום למשלוח
          </h3>
          <p className="text-xs text-muted-foreground">
            חפש/י כתובת, הקש/י על המפה או גרר/י את הסיכה למיקום המדויק.
          </p>

          <div className="relative">
            <div className="relative">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="חפש/י כתובת או מקום..."
                className="w-full pr-9 pl-9 py-2.5 rounded-xl bg-secondary border-2 border-border text-foreground text-sm focus:border-primary/60 focus:outline-none"
              />
              {searching && (
                <Loader2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            {suggestions.length > 0 && (
              <ul className="absolute z-20 right-0 left-0 mt-1 max-h-64 overflow-auto rounded-xl bg-card border border-border shadow-xl">
                {suggestions.map((s) => (
                  <li key={s.placeId}>
                    <button
                      type="button"
                      onClick={() => pickSuggestion(s)}
                      className="w-full text-right px-3 py-2 hover:bg-secondary flex items-start gap-2 border-b border-border/50 last:border-b-0"
                    >
                      <MapPin size={14} className="text-primary mt-0.5 shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-foreground font-bold truncate">{s.primary}</span>
                        {s.secondary && (
                          <span className="block text-xs text-muted-foreground truncate">{s.secondary}</span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            onClick={useCurrentLocation}
            disabled={locating}
            className="w-full bg-primary/15 border-2 border-primary/40 text-foreground font-bold py-2.5 rounded-xl hover:bg-primary/25 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {locating ? <Loader2 className="animate-spin" size={16} /> : <Crosshair size={16} className="text-primary" />}
            השתמש/י במיקום הנוכחי שלי
          </button>

          <div className="relative w-full h-[45vh] max-h-[380px] rounded-xl overflow-hidden border border-border bg-secondary">
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={28} />
              </div>
            )}
            <div ref={mapDiv} className="w-full h-full" />
          </div>

          <button
            onClick={() => picked && onConfirm(picked)}
            disabled={!picked}
            className="w-full bg-green-600 text-white font-black py-3 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Check size={18} /> אישור מיקום זה
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LocationPickerModal;
