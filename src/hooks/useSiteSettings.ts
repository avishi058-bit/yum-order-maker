import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
}

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
};

export const useSiteSettings = () => {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .limit(1)
      .single();
    if (data && !error) {
      setSettings({
        id: data.id,
        kiosk_font_scale: Number(data.kiosk_font_scale) || 1.0,
        website_font_scale: Number(data.website_font_scale) || 1.0,
        primary_color: data.primary_color || defaultSettings.primary_color,
        background_color: data.background_color || defaultSettings.background_color,
        menu_item_overrides: (data.menu_item_overrides as Record<string, { name?: string; description?: string }>) || {},
        menu_order: (data.menu_order as string[]) || [],
        banner_text: data.banner_text || "",
        banner_enabled: data.banner_enabled ?? false,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();

    const channel = supabase
      .channel("site-settings-realtime")
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
