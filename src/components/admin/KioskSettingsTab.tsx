import { useEffect, useState } from "react";
import { Save, RotateCcw, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useSiteSettings, KIOSK_DEFAULTS, type SiteSettings } from "@/hooks/useSiteSettings";

/**
 * Kiosk display tuning panel.
 *
 * All controls write to site_settings columns. The kiosk reads them via
 * useKioskCSSVars (which injects them as CSS variables on <html>) — this
 * means changes are reflected instantly on the kiosk with ZERO runtime
 * overhead (CSS does the work, not JS).
 *
 * Why this stays fast:
 *  - One DB read per kiosk session (already cached + realtime-subscribed)
 *  - CSS variables = native browser styling, no re-render storms
 *  - No animation loops, no per-frame JS
 */

type KioskTuningKeys =
  | "kiosk_modal_height_vh"
  | "kiosk_image_height_px"
  | "kiosk_image_scale"
  | "kiosk_card_image_size_px"
  | "kiosk_spacing_scale"
  | "kiosk_ui_scale"
  | "kiosk_font_scale"
  | "kiosk_lock_layout"
  | "kiosk_disable_zoom";

type KioskValues = Pick<SiteSettings, KioskTuningKeys>;

interface SliderRowProps {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  formatter?: (v: number) => string;
}

const SliderRow = ({ label, hint, value, min, max, step, unit, onChange, formatter }: SliderRowProps) => (
  <div className="bg-card rounded-2xl p-5 border border-border">
    <div className="flex items-center justify-between mb-2">
      <h3 className="font-black text-base">{label}</h3>
      <span className="font-black text-primary text-lg">
        {formatter ? formatter(value) : `${value}${unit}`}
      </span>
    </div>
    {hint && <p className="text-xs text-muted-foreground mb-3">{hint}</p>}
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-3 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
    />
    <div className="flex justify-between mt-1 text-xs text-muted-foreground">
      <span>{formatter ? formatter(min) : `${min}${unit}`}</span>
      <span>{formatter ? formatter(max) : `${max}${unit}`}</span>
    </div>
  </div>
);

interface ToggleRowProps {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

const ToggleRow = ({ label, hint, value, onChange }: ToggleRowProps) => (
  <div className="bg-card rounded-2xl p-5 border border-border">
    <div className="flex items-center justify-between">
      <div className="flex-1 pr-3">
        <h3 className="font-black text-base">{label}</h3>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-colors flex-none ${
          value ? "bg-green-500/20 text-green-600" : "bg-secondary text-muted-foreground"
        }`}
      >
        {value ? <Eye size={16} /> : <EyeOff size={16} />}
        {value ? "פעיל" : "כבוי"}
      </button>
    </div>
  </div>
);

const KioskSettingsTab = () => {
  const { settings, loading, updateSettings } = useSiteSettings();

  const [v, setV] = useState<KioskValues>({
    kiosk_modal_height_vh: KIOSK_DEFAULTS.kiosk_modal_height_vh,
    kiosk_image_height_px: KIOSK_DEFAULTS.kiosk_image_height_px,
    kiosk_image_scale: KIOSK_DEFAULTS.kiosk_image_scale,
    kiosk_card_image_size_px: KIOSK_DEFAULTS.kiosk_card_image_size_px,
    kiosk_spacing_scale: KIOSK_DEFAULTS.kiosk_spacing_scale,
    kiosk_ui_scale: KIOSK_DEFAULTS.kiosk_ui_scale,
    kiosk_font_scale: 1.0,
    kiosk_lock_layout: KIOSK_DEFAULTS.kiosk_lock_layout,
    kiosk_disable_zoom: KIOSK_DEFAULTS.kiosk_disable_zoom,
  });

  useEffect(() => {
    if (loading) return;
    setV({
      kiosk_modal_height_vh: settings.kiosk_modal_height_vh,
      kiosk_image_height_px: settings.kiosk_image_height_px,
      kiosk_image_scale: settings.kiosk_image_scale,
      kiosk_card_image_size_px: settings.kiosk_card_image_size_px,
      kiosk_spacing_scale: settings.kiosk_spacing_scale,
      kiosk_ui_scale: settings.kiosk_ui_scale,
      kiosk_font_scale: settings.kiosk_font_scale,
      kiosk_lock_layout: settings.kiosk_lock_layout,
      kiosk_disable_zoom: settings.kiosk_disable_zoom,
    });
  }, [loading, settings]);

  const update = <K extends keyof KioskValues>(key: K, value: KioskValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    const error = await updateSettings(v);
    if (error) toast.error("שגיאה בשמירה");
    else toast.success("הגדרות הקיוסק נשמרו!");
  };

  const handleReset = () => {
    setV({
      ...KIOSK_DEFAULTS,
      kiosk_font_scale: 1.0,
    });
    toast.info("ערכי ברירת מחדל הוחזרו — לחץ 'שמור' להחלה");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 mb-2">
        <p className="text-sm font-bold text-foreground mb-1">⚠️ הגדרות אלה חלות רק על הקיוסק</p>
        <p className="text-xs text-muted-foreground">
          האתר הרגיל לא מושפע. השינויים נשמרים מיידית ומסונכרנים בזמן אמת לעמדת הקיוסק.
        </p>
      </div>

      <h2 className="font-black text-lg pt-2">📐 גובה ופריסה</h2>

      <SliderRow
        label="גובה חלונית הבחירה"
        hint="כמה מהמסך תתפוס חלונית הבחירה כשהיא נפתחת. נמוך יותר = רואים יותר מההמבורגר ברקע."
        value={v.kiosk_modal_height_vh}
        min={50}
        max={95}
        step={1}
        unit="%"
        onChange={(val) => update("kiosk_modal_height_vh", val)}
      />

      <SliderRow
        label="גובה תמונת ההמבורגר בחלונית"
        hint="גובה אזור התמונה בראש החלונית. גדול יותר = תמונה בולטת יותר."
        value={v.kiosk_image_height_px}
        min={200}
        max={500}
        step={10}
        unit="px"
        onChange={(val) => update("kiosk_image_height_px", val)}
      />

      <SliderRow
        label="זום התמונה בחלונית"
        hint="קנה מידה (scale) של התמונה. השפעה ויזואלית בלבד — לא משנה את גובה האזור."
        value={v.kiosk_image_scale}
        min={0.7}
        max={1.5}
        step={0.05}
        unit="x"
        onChange={(val) => update("kiosk_image_scale", val)}
        formatter={(val) => `${val.toFixed(2)}x`}
      />

      <SliderRow
        label="גודל תמונת מנה בתפריט"
        hint="גודל התמונה הקטנה ליד כל מנה ברשימת התפריט."
        value={v.kiosk_card_image_size_px}
        min={120}
        max={260}
        step={4}
        unit="px"
        onChange={(val) => update("kiosk_card_image_size_px", val)}
      />

      <h2 className="font-black text-lg pt-4">🔤 גודל וטקסט</h2>

      <SliderRow
        label="גודל כתב כללי"
        hint="קנה מידה של כל הטקסטים בקיוסק."
        value={v.kiosk_font_scale}
        min={0.7}
        max={1.8}
        step={0.05}
        unit="x"
        onChange={(val) => update("kiosk_font_scale", val)}
        formatter={(val) => `${val.toFixed(2)}x`}
      />

      <SliderRow
        label="קנה מידה של ממשק"
        hint="(מתקדם) שולט על מרווחים ופרופורציות גלובליים. השאר 1.00 אם לא בטוח."
        value={v.kiosk_ui_scale}
        min={0.85}
        max={1.2}
        step={0.05}
        unit="x"
        onChange={(val) => update("kiosk_ui_scale", val)}
        formatter={(val) => `${val.toFixed(2)}x`}
      />

      <SliderRow
        label="מרווחים בין אלמנטים"
        hint="מרווח אנכי/אופקי בין כרטיסים, כפתורים ופריטים."
        value={v.kiosk_spacing_scale}
        min={0.7}
        max={1.4}
        step={0.05}
        unit="x"
        onChange={(val) => update("kiosk_spacing_scale", val)}
        formatter={(val) => `${val.toFixed(2)}x`}
      />

      <h2 className="font-black text-lg pt-4">🛡️ יציבות ביצועים</h2>

      <ToggleRow
        label="נעילת layout"
        hint="מונע 'קפיצות' של אלמנטים ושינוי גודל בזמן גלילה. מומלץ להשאיר פעיל."
        value={v.kiosk_lock_layout}
        onChange={(val) => update("kiosk_lock_layout", val)}
      />

      <ToggleRow
        label="חסימת זום של דפדפן"
        hint="מונע מהמשתמש להגדיל את המסך בטעות (פינץ' / דאבל-טאפ). מומלץ פעיל בקיוסק."
        value={v.kiosk_disable_zoom}
        onChange={(val) => update("kiosk_disable_zoom", val)}
      />

      <div className="sticky bottom-0 bg-background pt-4 pb-2 -mx-2 px-2 flex gap-2">
        <button
          onClick={handleReset}
          className="flex-none bg-secondary text-foreground font-bold py-4 px-5 rounded-xl flex items-center justify-center gap-2"
        >
          <RotateCcw size={18} />
          איפוס
        </button>
        <button
          onClick={handleSave}
          className="flex-1 bg-primary text-primary-foreground font-black py-4 rounded-xl text-lg flex items-center justify-center gap-2"
        >
          <Save size={20} />
          שמור הגדרות קיוסק
        </button>
      </div>
    </div>
  );
};

export default KioskSettingsTab;
