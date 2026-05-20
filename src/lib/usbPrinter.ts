// WebUSB ESC/POS thermal printer transport.
// Works on Chrome/Edge (desktop + Android). On Android requires OTG.
// Much faster than BLE — USB Full Speed = ~1 MB/s vs BLE ~10-20 KB/s.

type USBDevice = any;

const STORAGE_KEY = "usb-printer-device-serial";

let cachedDevice: USBDevice | null = null;
let cachedEndpoint: number | null = null;
let cachedInterface: number | null = null;
const listeners = new Set<(connected: boolean) => void>();

function notify(connected: boolean) {
  listeners.forEach((l) => { try { l(connected); } catch {} });
}

export function onUsbStatusChange(fn: (connected: boolean) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function isWebUsbSupported(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as any).usb;
}

export function isUsbPrinterConnected(): boolean {
  return !!(cachedDevice?.opened && cachedEndpoint !== null);
}

// Find a printer-class interface (classCode 7) or first interface with bulk OUT endpoint.
function findBulkOutEndpoint(device: USBDevice): { interfaceNumber: number; endpointNumber: number } | null {
  const cfg = device.configuration;
  if (!cfg) return null;
  // Prefer printer class (7).
  for (const iface of cfg.interfaces) {
    for (const alt of iface.alternates) {
      const isPrinter = alt.interfaceClass === 7;
      for (const ep of alt.endpoints) {
        if (ep.direction === "out" && ep.type === "bulk") {
          if (isPrinter) return { interfaceNumber: iface.interfaceNumber, endpointNumber: ep.endpointNumber };
        }
      }
    }
  }
  // Fallback: any bulk OUT.
  for (const iface of cfg.interfaces) {
    for (const alt of iface.alternates) {
      for (const ep of alt.endpoints) {
        if (ep.direction === "out" && ep.type === "bulk") {
          return { interfaceNumber: iface.interfaceNumber, endpointNumber: ep.endpointNumber };
        }
      }
    }
  }
  return null;
}

async function openDevice(device: USBDevice): Promise<void> {
  if (!device.opened) await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);
  const ep = findBulkOutEndpoint(device);
  if (!ep) throw new Error("לא נמצא endpoint כתיבה במדפסת USB");
  try { await device.claimInterface(ep.interfaceNumber); }
  catch (e: any) {
    // Some Android browsers need releaseInterface first if previously claimed.
    try { await device.releaseInterface(ep.interfaceNumber); } catch {}
    await device.claimInterface(ep.interfaceNumber);
  }
  cachedDevice = device;
  cachedEndpoint = ep.endpointNumber;
  cachedInterface = ep.interfaceNumber;
  try {
    const serial = device.serialNumber || `${device.vendorId}:${device.productId}`;
    localStorage.setItem(STORAGE_KEY, serial);
  } catch {}
  notify(true);
}

export async function pairUsbPrinter(): Promise<void> {
  if (!isWebUsbSupported()) {
    throw new Error("הדפדפן הזה לא תומך ב-WebUSB. השתמש ב-Chrome / Edge.");
  }
  const usb: any = (navigator as any).usb;
  let device: USBDevice;
  try {
    // Try printer class first.
    device = await usb.requestDevice({ filters: [{ classCode: 7 }] });
  } catch (e: any) {
    if (e?.name === "NotFoundError") {
      // User may have a vendor-class printer; offer all devices.
      device = await usb.requestDevice({ filters: [] });
    } else {
      throw e;
    }
  }
  await openDevice(device);
}

export async function tryAutoReconnectUsb(): Promise<boolean> {
  if (!isWebUsbSupported()) return false;
  const usb: any = (navigator as any).usb;
  try {
    const devices: USBDevice[] = await usb.getDevices();
    if (!devices?.length) return false;
    const savedSerial = (() => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } })();
    const dev =
      (savedSerial && devices.find((d) =>
        (d.serialNumber && d.serialNumber === savedSerial) ||
        `${d.vendorId}:${d.productId}` === savedSerial,
      )) || devices[0];
    if (!dev) return false;
    await openDevice(dev);
    return true;
  } catch {
    return false;
  }
}

export async function disconnectUsbPrinter(): Promise<void> {
  try {
    if (cachedDevice && cachedInterface !== null) {
      try { await cachedDevice.releaseInterface(cachedInterface); } catch {}
    }
    if (cachedDevice?.opened) {
      try { await cachedDevice.close(); } catch {}
    }
  } catch {}
  cachedDevice = null;
  cachedEndpoint = null;
  cachedInterface = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  notify(false);
}

// Write bytes via WebUSB bulk OUT. USB is fast enough that we can send large
// chunks at once (64KB typical max transferOut size).
export async function writeBytesUsb(data: Uint8Array): Promise<void> {
  if (!cachedDevice || cachedEndpoint === null) {
    throw new Error("מדפסת USB לא מחוברת");
  }
  const CHUNK = 16 * 1024; // 16 KB chunks — well below USB limits, no perceivable overhead.
  for (let i = 0; i < data.length; i += CHUNK) {
    const slice = data.subarray(i, Math.min(i + CHUNK, data.length));
    await cachedDevice.transferOut(cachedEndpoint, slice);
  }
}
