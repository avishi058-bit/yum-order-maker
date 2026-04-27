import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DayHours {
  open: boolean;
  from: string; // "HH:MM"
  to: string;   // "HH:MM"
}
export type BusinessHoursMap = Record<string, DayHours>;

export interface SiteSettings {
  id: string;
  kiosk_font_scale: number;
  website_font_scale: number;
  primary_color: string;
  background_color: string;
  menu_item_overrides: Record<string, { name?: string; description?: string }>;
  menu_order: string[];
  banner_text: string;
  banner_enabled: boolean;
  business_hours: BusinessHoursMap;
  // Kiosk display tuning (admin-controlled, kiosk-only)
  kiosk_modal_height_vh: number;
  kiosk_image_height_px: number;
  kiosk_image_scale: number;
  kiosk_card_image_size_px: number;
  kiosk_spacing_scale: number;
  kiosk_ui_scale: number;
  kiosk_lock_layout: boolean;
  kiosk_disable_zoom: boolean;
}

const defaultBusinessHours: BusinessHoursMap = {
  "0": { open: true, from: "11:00", to: "23:00" },
  "1": { open: true, from: "11:00", to: "23:00" },
  "2": { open: true, from: "11:00", to: "23:00" },
  "3": { open: true, from: "11:00", to: "23:00" },
  "4": { open: true, from: "11:00", to: "23:00" },
  "5": { open: false, from: "11:00", to: "15:00" },
  "6": { open: true, from: "20:00", to: "23:59" },
};

export const KIOSK_DEFAULTS = {
  kiosk_modal_height_vh: 70,
  kiosk_image_height_px: 380,
  kiosk_image_scale: 1.0,
  kiosk_card_image_size_px: 176,
  kiosk_spacing_scale: 1.0,
  kiosk_ui_scale: 1.0,
  kiosk_lock_layout: true,
  kiosk_disable_zoom: true,
} as const;

const defaultSettings: SiteSettings = {
  id: "",
  kiosk_font_scale: 1.0,
  website_font_scale: 1.0,
  primary_color: "25 95% 53%",
  background_color: "0 0% 100%",
  menu_item_overrides: {},
  menu_order: [],
  banner_text: "",
  banner_enabled: false,
  business_hours: defaultBusinessHours,
  ...KIOSK_DEFAULTS,
};

const SETTINGS_CACHE_KEY = "site_settings_cache_v1";

const readCachedSettings = (): SiteSettings | null => {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Merge with defaults so any missing keys (e.g. after schema additions)
    // don't break consumers.
    return { ...defaultSettings, ...parsed };
  } catch {
    return null;
  }
};

const writeCachedSettings = (s: SiteSettings) => {
  try {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(s));
  } catch {
    /* quota / private mode — ignore */
  }
};

export const useSiteSettings = () => {
  // Initialise from localStorage cache so kiosk-tuning vars (scale, sizes…)
  // are applied on the very first render — no jump when the network reply lands.
  const [settings, setSettings] = useState<SiteSettings>(() => readCachedSettings() ?? defaultSettings);
  // If we already had a cached snapshot, treat the hook as ready immediately
  // so consumers (useKioskCSSVars) inject CSS vars on first paint.
  const [loading, setLoading] = useState(() => readCachedSettings() === null);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .limit(1)
      .single();
    if (data && !error) {
      const d = data as any;
      const fresh: SiteSettings = {
        id: d.id,
        kiosk_font_scale: Number(d.kiosk_font_scale) || 1.0,
        website_font_scale: Number(d.website_font_scale) || 1.0,
        primary_color: d.primary_color || defaultSettings.primary_color,
        background_color: d.background_color || defaultSettings.background_color,
        menu_item_overrides: (d.menu_item_overrides as Record<string, { name?: string; description?: string }>) || {},
        menu_order: (d.menu_order as string[]) || [],
        banner_text: d.banner_text || "",
        banner_enabled: d.banner_enabled ?? false,
        business_hours: (d.business_hours as BusinessHoursMap) || defaultBusinessHours,
        kiosk_modal_height_vh: Number(d.kiosk_modal_height_vh) || KIOSK_DEFAULTS.kiosk_modal_height_vh,
        kiosk_image_height_px: Number(d.kiosk_image_height_px) || KIOSK_DEFAULTS.kiosk_image_height_px,
        kiosk_image_scale: Number(d.kiosk_image_scale) || KIOSK_DEFAULTS.kiosk_image_scale,
        kiosk_card_image_size_px: Number(d.kiosk_card_image_size_px) || KIOSK_DEFAULTS.kiosk_card_image_size_px,
        kiosk_spacing_scale: Number(d.kiosk_spacing_scale) || KIOSK_DEFAULTS.kiosk_spacing_scale,
        kiosk_ui_scale: Number(d.kiosk_ui_scale) || KIOSK_DEFAULTS.kiosk_ui_scale,
        kiosk_lock_layout: d.kiosk_lock_layout ?? KIOSK_DEFAULTS.kiosk_lock_layout,
        kiosk_disable_zoom: d.kiosk_disable_zoom ?? KIOSK_DEFAULTS.kiosk_disable_zoom,
      };
      // Skip state update if nothing actually changed — prevents downstream
      // effects (like useKioskCSSVars) from re-running on every realtime
      // heartbeat / unrelated-row update, which used to flicker the kiosk
      // welcome screen.
      setSettings((prev) => {
        try {
          if (JSON.stringify(prev) === JSON.stringify(fresh)) return prev;
        } catch {
          /* fall through to update */
        }
        writeCachedSettings(fresh);
        return fresh;
      });
    }
    setLoading(false);
  };

  const channelId = useRef(`site-settings-realtime-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    fetchSettings();

    const channel = supabase
      .channel(channelId.current)
      .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, () => {
        fetchSettings();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateSettings = async (updates: Partial<Omit<SiteSettings, "id">>) => {
    if (!settings.id) return;
    const { error } = await supabase
      .from("site_settings")
      .update(updates as any)
      .eq("id", settings.id);
    if (!error) {
      setSettings((prev) => ({ ...prev, ...updates }));
    }
    return error;
  };

  return { settings, loading, updateSettings };
};
