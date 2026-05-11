import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Validate Israeli mobile phone: must start with 05 and be exactly 10 digits. */
export function validateIsraeliPhone(phone: string): { valid: boolean; error?: string } {
  const cleaned = phone.replace(/[-\s]/g, "");
  if (!/^05\d{8}$/.test(cleaned)) {
    return { valid: false, error: "מספר הטלפון חייב להתחיל ב-05 ולהכיל 10 ספרות" };
  }
  return { valid: true };
}
