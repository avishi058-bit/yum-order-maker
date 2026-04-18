import { useEffect, useMemo, useState } from "react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export interface DayHours {
  open: boolean;
  from: string; // "HH:MM"
  to: string;   // "HH:MM"
}

export type BusinessHours = Record<string, DayHours>; // keys "0"–"6", 0 = Sunday

export const DEFAULT_HOURS: BusinessHours = {
  "0": { open: true, from: "11:00", to: "23:00" },
  "1": { open: true, from: "11:00", to: "23:00" },
  "2": { open: true, from: "11:00", to: "23:00" },
  "3": { open: true, from: "11:00", to: "23:00" },
  "4": { open: true, from: "11:00", to: "23:00" },
  "5": { open: false, from: "11:00", to: "15:00" },
  "6": { open: true, from: "20:00", to: "23:59" },
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

  const isOpen = today.open && cur >= toMin(today.from) && cur < toMin(today.to);

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

  const hours: BusinessHours = useMemo(() => {
    const raw = settings.business_hours as BusinessHours | undefined;
    if (raw && typeof raw === "object") {
      const merged: BusinessHours = { ...DEFAULT_HOURS };
      for (const k of Object.keys(DEFAULT_HOURS)) {
        if (raw[k]) merged[k] = { ...DEFAULT_HOURS[k], ...raw[k] };
      }
      return merged;
    }
    return DEFAULT_HOURS;
  }, [settings]);

  const status = useMemo(() => computeStatus(hours, now), [hours, now]);

  return { hours, status, loading, updateSettings };
};
