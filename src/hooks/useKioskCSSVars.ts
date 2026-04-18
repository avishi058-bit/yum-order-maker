import { useEffect } from "react";
import { useSiteSettings } from "./useSiteSettings";

/**
 * Injects kiosk display settings as CSS variables on the <html> element,
 * and applies layout-stability fixes (no zoom, no bounce, transform-only).
 *
 * Performance: this runs ONCE per settings change (not per render),
 * and the browser handles all subsequent styling natively — no JS overhead
 * during interaction or scroll.
 *
 * IMPORTANT: only called on the kiosk page. Website is unaffected.
 */
export function useKioskCSSVars(enabled: boolean) {
  const { settings, loading } = useSiteSettings();

  useEffect(() => {
    if (!enabled || loading) return;

    const root = document.documentElement;

    // Inject CSS vars — read by components via var(--kiosk-*)
    root.style.setProperty("--kiosk-modal-h", `${settings.kiosk_modal_height_vh}vh`);
    root.style.setProperty("--kiosk-image-h", `${settings.kiosk_image_height_px}px`);
    root.style.setProperty("--kiosk-image-scale", String(settings.kiosk_image_scale));
    root.style.setProperty("--kiosk-card-img-size", `${settings.kiosk_card_image_size_px}px`);
    root.style.setProperty("--kiosk-spacing-scale", String(settings.kiosk_spacing_scale));
    root.style.setProperty("--kiosk-ui-scale", String(settings.kiosk_ui_scale));
    root.style.setProperty("--kiosk-font-scale", String(settings.kiosk_font_scale));

    // Layout-stability classes
    document.body.classList.add("kiosk-active");
    if (settings.kiosk_lock_layout) {
      document.body.classList.add("kiosk-lock-layout");
    } else {
      document.body.classList.remove("kiosk-lock-layout");
    }
    // Toggle UI-scale CSS rule only when actually scaling (avoids unnecessary
    // transform creating a new stacking context at scale 1).
    if (settings.kiosk_ui_scale !== 1) {
      document.body.classList.add("kiosk-ui-scale-on");
    } else {
      document.body.classList.remove("kiosk-ui-scale-on");
    }

    // Live-update any open ItemCustomizer hero (its height is set imperatively
    // via JS, so a CSS-var change alone wouldn't reach it). Cheap query —
    // there's at most one open at a time.
    const openHero = document.querySelector<HTMLDivElement>("[data-kiosk-hero='true']");
    if (openHero) openHero.style.height = `${settings.kiosk_image_height_px}px`;

    // Disable browser zoom (pinch/double-tap) on the kiosk
    let viewportTag = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    const originalContent = viewportTag?.content ?? "";
    if (settings.kiosk_disable_zoom) {
      if (!viewportTag) {
        viewportTag = document.createElement("meta");
        viewportTag.name = "viewport";
        document.head.appendChild(viewportTag);
      }
      viewportTag.content =
        "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover";
    }

    return () => {
      document.body.classList.remove("kiosk-active", "kiosk-lock-layout", "kiosk-ui-scale-on");
      // Reset CSS vars so they don't leak to other routes
      root.style.removeProperty("--kiosk-modal-h");
      root.style.removeProperty("--kiosk-image-h");
      root.style.removeProperty("--kiosk-image-scale");
      root.style.removeProperty("--kiosk-card-img-size");
      root.style.removeProperty("--kiosk-spacing-scale");
      root.style.removeProperty("--kiosk-ui-scale");
      root.style.removeProperty("--kiosk-font-scale");
      if (viewportTag && originalContent) {
        viewportTag.content = originalContent;
      }
    };
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
