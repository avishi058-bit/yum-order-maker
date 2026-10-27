import { useEffect, useMemo, useState } from "react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export interface DayHours {
  open: boolean;
  from: string; // "HH:MM"
  to: string;   // "HH:MM"
  /**
   * Saturday only: open this many minutes after Shabbat ends (tzeit hakochavim
   * at Kfar Maimon), instead of the fixed "from". Recomputed every week.
   */
  afterShabbatMin?: number;
}

export type BusinessHours = Record<string, DayHours>; // keys "0"-"6", 0 = Sunday

export const DEFAULT_HOURS: BusinessHours = {
  "0": { open: true, from: "11:00", to: "23:00" },
  "1": { open: true, from: "11:00", to: "23:00" },
  "2": { open: true, from: "11:00", to: "23:00" },
  "3": { open: true, from: "11:00", to: "23:00" },
  "4": { open: true, from: "11:00", to: "23:00" },
  "5": { open: false, from: "11:00", to: "15:00" },
  "6": { open: true, from: "20:00", to: "23:59" },
};

// ─── Motzaei Shabbat opening (Kfar Maimon) ──────────────────────────────
const KFAR_MAIMON = { lat: 31.4347, lon: 34.5417 };
/** Minutes after sunset counted as Shabbat's end (three stars), as Israeli calendars do for the Negev. */
const TZEIT_AFTER_SUNSET_MIN = 35;

/** Sunset (UTC Date) for a calendar day, NOAA solar-position approximation (±1-2 min). */
const sunsetUtc = (y: number, m: number, d: number, lat: number, lon: number): Date => {
  const rad = Math.PI / 180;
  const jd = Date.UTC(y, m - 1, d, 12) / 86400000 + 2440587.5;
  const n = jd - 2451545.0 + 0.0008;
  const jStar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = 2451545.0 + jStar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
  const decl = Math.asin(Math.sin(lambda * rad) * Math.sin(23.4397 * rad));
  const cosH = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(decl)) / (Math.cos(lat * rad) * Math.cos(decl));
  const H = Math.acos(Math.max(-1, Math.min(1, cosH))) / rad;
  const jSet = jTransit + H / 360;
  return new Date((jSet - 2440587.5) * 86400000);
};

/** "HH:MM" in Israel time when we open on the coming (or current) Saturday night. */
export const motzashOpeningHM = (israelNow: Date, afterMin: number): string => {
  const daysToSat = (6 - israelNow.getDay() + 7) % 7;
  const sat = new Date(israelNow.getFullYear(), israelNow.getMonth(), israelNow.getDate() + daysToSat);
  const set = sunsetUtc(sat.getFullYear(), sat.getMonth() + 1, sat.getDate(), KFAR_MAIMON.lat, KFAR_MAIMON.lon);
  const open = new Date(set.getTime() + (TZEIT_AFTER_SUNSET_MIN + afterMin) * 60000);
  const hm = open.toLocaleTimeString("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hour12: false });
  const [h, m] = hm.split(":").map((v) => parseInt(v, 10));
  const total = Math.ceil((h * 60 + m) / 5) * 5; // round up to the next 5 minutes
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

export const DAY_NAMES_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const parseHM = (hm: string): { h: number; m: number } => {
  const [h, m] = hm.split(":").map((v) => parseInt(v, 10));
  return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m };
};

const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();
const toMin = (hm: string) => {
  const { h, m } = parseHM(hm);
  return h * 60 + m;
};

export interface BusinessStatus {
  isOpen: boolean;
  todayHours: DayHours;
  /** Minutes until next open. Null when open or no upcoming open in next 7 days. */
  minutesUntilOpen: number | null;
  /** Day index (0-6) of the next opening. Null when open. */
  nextOpenDay: number | null;
  /** "HH:MM" the next opening. */
  nextOpenAt: string | null;
}

const computeStatus = (hours: BusinessHours, now: Date): BusinessStatus => {
  const dow = now.getDay();
  const today = hours[String(dow)] ?? DEFAULT_HOURS[String(dow)];
  const cur = minutesOfDay(now);

  // Handle overnight windows (e.g. 19:50 → 00:00 or 20:00 → 02:00):
  // when "to" is 00:00 or earlier than "from", treat it as end-of-day / next day.
  const fromMin = toMin(today.from);
  let toMinVal = toMin(today.to);
  if (toMinVal <= fromMin) {
    toMinVal = 24 * 60; // wrap to end of day
  }
  const isOpen = today.open && cur >= fromMin && cur < toMinVal;

  if (isOpen) {
    return { isOpen: true, todayHours: today, minutesUntilOpen: null, nextOpenDay: null, nextOpenAt: null };
  }

  // Look ahead up to 7 days for next opening
  for (let offset = 0; offset < 8; offset++) {
    const dayIdx = (dow + offset) % 7;
    const day = hours[String(dayIdx)] ?? DEFAULT_HOURS[String(dayIdx)];
    if (!day.open) continue;
    const openMin = toMin(day.from);
    if (offset === 0 && cur >= openMin) continue; // already past today's window
    const totalMin = offset * 24 * 60 + openMin - cur;
    if (totalMin <= 0) continue;
    return {
      isOpen: false,
      todayHours: today,
      minutesUntilOpen: totalMin,
      nextOpenDay: dayIdx,
      nextOpenAt: day.from,
    };
  }

  return { isOpen: false, todayHours: today, minutesUntilOpen: null, nextOpenDay: null, nextOpenAt: null };
};

export const formatCountdown = (totalMin: number): string => {
  if (totalMin < 60) return `${totalMin} דקות`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h < 24) return m === 0 ? `${h} שעות` : `${h}ש ${m}ד`;
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH === 0 ? `${d} ימים` : `${d}י ${remH}ש`;
};

export const useBusinessHours = () => {
  const { settings, loading, updateSettings } = useSiteSettings();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000); // 30s tick is plenty
    return () => clearInterval(t);
  }, []);

  // Always evaluate hours in Israel time, regardless of the device's time zone.
  const israelNow = useMemo(() => {
    try {
      const il = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
      return isNaN(il.getTime()) ? now : il;
    } catch {
      return now;
    }
  }, [now]);
  const satKey = `${israelNow.getFullYear()}-${israelNow.getMonth()}-${israelNow.getDate()}`;

  const hours: BusinessHours = useMemo(() => {
    const raw = settings.business_hours as BusinessHours | undefined;
    let merged: BusinessHours = DEFAULT_HOURS;
    if (raw && typeof raw === "object") {
      merged = { ...DEFAULT_HOURS };
      for (const k of Object.keys(DEFAULT_HOURS)) {
        if (raw[k]) merged[k] = { ...DEFAULT_HOURS[k], ...raw[k] };
      }
    }
    const sat = merged["6"];
    if (sat?.open && typeof sat.afterShabbatMin === "number") {
      try {
        merged = { ...merged, "6": { ...sat, from: motzashOpeningHM(israelNow, sat.afterShabbatMin) } };
      } catch { /* keep the stored time */ }
    }
    return merged;
    // satKey: recompute once a day, not on every 30s tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, satKey]);

  const status = useMemo(() => computeStatus(hours, israelNow), [hours, israelNow]);

  return { hours, status, loading, updateSettings };
};
