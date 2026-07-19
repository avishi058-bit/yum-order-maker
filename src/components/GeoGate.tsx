import { useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

const CACHE_KEY = "geo-gate-v1";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

type Status = "checking" | "allowed" | "blocked";

/**
 * Geo-restricts the site to visitors from Israel.
 *
 * Bypass rules (so we never lock staff out):
 * - Authenticated Supabase users (kitchen/admin/courier).
 * - Localhost / preview / editor sandbox.
 * - Anything running inside an iframe (Lovable preview editor).
 * - Lookup failure — fails open so a third-party outage doesn't block customers.
 */
const GeoGate = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<Status>("checking");
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Bypass in editor iframe / non-production hosts.
      try {
        if (window.self !== window.top) { setStatus("allowed"); return; }
      } catch { setStatus("allowed"); return; }

      const host = window.location.hostname;
      if (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host.endsWith(".lovableproject.com") ||
        host.includes("id-preview--")
      ) {
        setStatus("allowed");
        return;
      }

      // Authenticated staff bypass.
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) { setStatus("allowed"); return; }
      } catch { /* ignore */ }

      // Session cache.
      try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { allowed: boolean; country: string | null; ts: number };
          if (Date.now() - parsed.ts < CACHE_TTL_MS) {
            setCountry(parsed.country);
            setStatus(parsed.allowed ? "allowed" : "blocked");
            return;
          }
        }
      } catch { /* ignore */ }

      try {
        const { data, error } = await supabase.functions.invoke<{
          allowed: boolean; country: string | null;
        }>("geo-check", { body: {} });
        if (cancelled) return;
        if (error || !data) { setStatus("allowed"); return; } // fail open
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, ts: Date.now() }));
        } catch { /* ignore */ }
        setCountry(data.country);
        setStatus(data.allowed ? "allowed" : "blocked");
      } catch {
        if (!cancelled) setStatus("allowed"); // fail open
      }
    };

    run();
    return () => { cancelled = true; };
  }, []);

  if (status === "checking") return null;

  if (status === "blocked") {
    return (
      <div
        dir="rtl"
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background text-foreground p-8 text-center"
      >
        <div className="max-w-md space-y-4">
          <div className="text-6xl">🔒</div>
          <h1 className="text-2xl font-bold">גישה מוגבלת לישראל בלבד</h1>
          <p className="text-muted-foreground">
            מטעמי אבטחה, האתר זמין כרגע רק ממדינת ישראל.
          </p>
          {country && (
            <p className="text-xs text-muted-foreground">
              זוהתה גישה ממדינה: {country}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            אם אתם בישראל ורואים את ההודעה בטעות, ייתכן שאתם מחוברים ל-VPN.
            נסו לכבות אותו ולרענן את הדף.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default GeoGate;
