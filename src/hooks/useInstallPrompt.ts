import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Captures the Android `beforeinstallprompt` event so we can trigger the
 * native install prompt on demand (e.g. when the user taps our install button).
 * iOS Safari doesn't fire this event — callers should fall back to showing
 * the manual "Add to Home Screen" instructions.
 */
export const useInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    // Pick up an event that was already captured in main.tsx before React mounted.
    const w = typeof window !== "undefined" ? (window as unknown as { __deferredInstallPrompt?: Event }) : undefined;
    return (w?.__deferredInstallPrompt as BeforeInstallPromptEvent) ?? null;
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const earlyReady = () => {
      const w = window as unknown as { __deferredInstallPrompt?: Event };
      if (w.__deferredInstallPrompt) {
        setDeferredPrompt(w.__deferredInstallPrompt as BeforeInstallPromptEvent);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("deferred-install-prompt-ready", earlyReady);
    const installedHandler = () => {
      setDeferredPrompt(null);
      const w = window as unknown as { __deferredInstallPrompt?: Event };
      delete w.__deferredInstallPrompt;
      try { localStorage.setItem("habakta_pwa_installed", "1"); } catch {}
      // Open the post-install instructions modal (notifications guidance)
      window.dispatchEvent(new CustomEvent("open-post-install-instructions"));
    };
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("deferred-install-prompt-ready", earlyReady);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferredPrompt) return "unavailable";
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return choice.outcome;
    } catch {
      return "unavailable";
    }
  }, [deferredPrompt]);

  return { canPrompt: !!deferredPrompt, promptInstall };
};
