import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, MapPin, Crosshair, Check } from "lucide-react";
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
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__initDeliveryMap&channel=${channel ?? ""}&language=he&region=IL`;
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

// Default: תושיה — origin of the restaurant
const DEFAULT_CENTER = { lat: 32.5822, lng: 35.1961 };

const LocationPickerModal = ({ open, onClose, onConfirm, initial }: Props) => {
  const mapDiv = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(initial ?? null);

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
    };
  }, [open, initial]);

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
            הקש/י על המפה או גרר/י את הסיכה למיקום המדויק.
          </p>

          <button
            onClick={useCurrentLocation}
            disabled={locating}
            className="w-full bg-primary/15 border-2 border-primary/40 text-foreground font-bold py-2.5 rounded-xl hover:bg-primary/25 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {locating ? <Loader2 className="animate-spin" size={16} /> : <Crosshair size={16} className="text-primary" />}
            השתמש/י במיקום הנוכחי שלי
          </button>

          <div className="relative w-full h-[55vh] max-h-[420px] rounded-xl overflow-hidden border border-border bg-secondary">
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
