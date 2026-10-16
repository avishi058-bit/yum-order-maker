// Device secret that lets this kiosk push charges to the physical PinPad.
// Saved once on the kiosk via /station-setup and checked by `pinpad-charge`
// against the KIOSK_DEVICE_KEY server secret.
const STORAGE_KEY = "habakta_kiosk_key";

export function getKioskKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setKioskKey(value: string) {
  try {
    const v = value.trim();
    if (v) localStorage.setItem(STORAGE_KEY, v);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable - kiosk will be rejected and show the error */
  }
}
