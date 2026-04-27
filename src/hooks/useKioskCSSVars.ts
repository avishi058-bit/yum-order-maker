import { useEffect, useRef } from "react";
import { useSiteSettings } from "./useSiteSettings";

/**
 * Injects kiosk display settings as CSS variables on the <html> element,
 * and applies layout-stability fixes (no zoom, no bounce, transform-only).
 *
 * IMPORTANT design rule (kiosk stability):
 * The body classes and viewport meta are attached ONCE on mount and detached
 * ONCE on unmount. CSS variable updates from realtime settings happen in a
 * separate effect that only writes the vars — it does NOT remove/re-add the
 * body classes (which would briefly toggle styles like overscroll, font-size,
 * touch-action and the viewport meta — visible as a flicker / "refresh" of
 * the welcome screen every time site_settings is updated).
 */
export function useKioskCSSVars(enabled: boolean) {
  const { settings, loading } = useSiteSettings();

  // ── 1) Attach kiosk body classes + viewport-meta ONCE on mount ───────
  const viewportRef = useRef<{ tag: HTMLMetaElement | null; original: string }>({
    tag: null,
    original: "",
  });

  useEffect(() => {
    if (!enabled) return;

    document.body.classList.add("kiosk-active");

    // Disable browser zoom (pinch/double-tap) on the kiosk — applied once.
    let viewportTag = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    const originalContent = viewportTag?.content ?? "";
    if (!viewportTag) {
      viewportTag = document.createElement("meta");
      viewportTag.name = "viewport";
      document.head.appendChild(viewportTag);
    }
    viewportRef.current = { tag: viewportTag, original: originalContent };

    return () => {
      document.body.classList.remove("kiosk-active", "kiosk-lock-layout", "kiosk-ui-scale-on");
      const root = document.documentElement;
      root.style.removeProperty("--kiosk-modal-h");
      root.style.removeProperty("--kiosk-image-h");
      root.style.removeProperty("--kiosk-image-scale");
      root.style.removeProperty("--kiosk-card-img-size");
      root.style.removeProperty("--kiosk-spacing-scale");
      root.style.removeProperty("--kiosk-ui-scale");
      root.style.removeProperty("--kiosk-font-scale");
      const { tag, original } = viewportRef.current;
      if (tag && original) tag.content = original;
    };
  }, [enabled]);

  // ── 2) Apply CSS variables + layout/zoom toggles whenever settings change.
  //     This effect is write-only — no DOM teardown/rebuild, so realtime
  //     settings updates do NOT cause the kiosk welcome screen to flicker.
  useEffect(() => {
    if (!enabled || loading) return;

    const root = document.documentElement;
    root.style.setProperty("--kiosk-modal-h", `${settings.kiosk_modal_height_vh}vh`);
    root.style.setProperty("--kiosk-image-h", `${settings.kiosk_image_height_px}px`);
    root.style.setProperty("--kiosk-image-scale", String(settings.kiosk_image_scale));
    root.style.setProperty("--kiosk-card-img-size", `${settings.kiosk_card_image_size_px}px`);
    root.style.setProperty("--kiosk-spacing-scale", String(settings.kiosk_spacing_scale));
    root.style.setProperty("--kiosk-ui-scale", String(settings.kiosk_ui_scale));
    root.style.setProperty("--kiosk-font-scale", String(settings.kiosk_font_scale));

    document.body.classList.toggle("kiosk-lock-layout", !!settings.kiosk_lock_layout);
    document.body.classList.toggle("kiosk-ui-scale-on", settings.kiosk_ui_scale !== 1);

    // Live-update any open ItemCustomizer hero (its height is set imperatively).
    const openHero = document.querySelector<HTMLDivElement>("[data-kiosk-hero='true']");
    if (openHero) openHero.style.height = `${settings.kiosk_image_height_px}px`;

    // Update the viewport meta only — no remove/re-add.
    const tag = viewportRef.current.tag;
    if (tag && settings.kiosk_disable_zoom) {
      const desired =
        "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover";
      if (tag.content !== desired) tag.content = desired;
    }
  }, [
    enabled,
    loading,
    settings.kiosk_modal_height_vh,
    settings.kiosk_image_height_px,
    settings.kiosk_image_scale,
    settings.kiosk_card_image_size_px,
    settings.kiosk_spacing_scale,
    settings.kiosk_ui_scale,
    settings.kiosk_font_scale,
    settings.kiosk_lock_layout,
    settings.kiosk_disable_zoom,
  ]);

  return settings;
}
