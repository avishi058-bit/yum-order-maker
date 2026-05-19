// Web Bluetooth ESC/POS thermal printer driver.
// Targets Xprinter / generic 58mm-80mm BLE thermal printers (e.g. Printer001-352C).
// Hebrew is encoded via CP862 (ESC t 21) with manual visual reversal (RTL).
//
// Persists last device id in localStorage so we can try to reconnect silently
// via navigator.bluetooth.getDevices() (supported on Chrome/Edge on Android).

import type { ReceiptOrder, ReceiptOrderItem } from "./kitchenReceipt";

// ---------- ESC/POS constants ----------
const ESC = 0x1b;
const GS = 0x1d;

const CMD_INIT = [ESC, 0x40];
const CMD_CP862 = [ESC, 0x74, 21]; // PC862 Hebrew
const CMD_ALIGN_LEFT = [ESC, 0x61, 0];
const CMD_ALIGN_CENTER = [ESC, 0x61, 1];
const CMD_ALIGN_RIGHT = [ESC, 0x61, 2];
const CMD_BOLD_ON = [ESC, 0x45, 1];
const CMD_BOLD_OFF = [ESC, 0x45, 0];
const CMD_SIZE_NORMAL = [GS, 0x21, 0x00];
const CMD_SIZE_DOUBLE = [GS, 0x21, 0x11]; // 2x width + 2x height
const CMD_SIZE_DBL_H = [GS, 0x21, 0x01]; // 2x height only
const CMD_FEED_3 = [ESC, 0x64, 3];
const CMD_CUT = [GS, 0x56, 0x42, 0x00]; // partial cut with feed

// ---------- CP862 (Hebrew) encoding map ----------
// Maps Unicode Hebrew letters to CP862 bytes.
const CP862_HEBREW: Record<string, number> = {
  "א": 0x80, "ב": 0x81, "ג": 0x82, "ד": 0x83, "ה": 0x84,
  "ו": 0x85, "ז": 0x86, "ח": 0x87, "ט": 0x88, "י": 0x89,
  "ך": 0x8a, "כ": 0x8b, "ל": 0x8c, "ם": 0x8d, "מ": 0x8e,
  "ן": 0x8f, "נ": 0x90, "ס": 0x91, "ע": 0x92, "ף": 0x93,
  "פ": 0x94, "ץ": 0x95, "צ": 0x96, "ק": 0x97, "ר": 0x98,
  "ש": 0x99, "ת": 0x9a,
  "₪": 0x9c,
};

const isHebrewChar = (c: string) => {
  const code = c.charCodeAt(0);
  return code >= 0x0590 && code <= 0x05ff;
};

// Visual RTL: reverse the whole line, then flip any digit/Latin runs back so
// numbers and English read left-to-right inside the reversed Hebrew flow.
// Good enough for short kitchen receipts (no nested BiDi cases here).
function visualReverseRtl(line: string): string {
  if (!/[\u0590-\u05FF]/.test(line)) return line; // pure latin/digits — leave as-is
  const reversed = [...line].reverse().join("");
  // Re-flip runs of [A-Za-z0-9.,:/#×₪-] sequences so they read forward.
  return reversed.replace(/[A-Za-z0-9.,:#×₪/\-\+]+/g, (s) => [...s].reverse().join(""));
}

function encodeTextLine(line: string): number[] {
  const visual = visualReverseRtl(line);
  const bytes: number[] = [];
  for (const ch of visual) {
    if (ch === "\n") { bytes.push(0x0a); continue; }
    const heb = CP862_HEBREW[ch];
    if (heb !== undefined) { bytes.push(heb); continue; }
    const code = ch.charCodeAt(0);
    if (code < 0x80) { bytes.push(code); continue; }
    // Unsupported glyph — replace with '?' rather than emit broken bytes.
    bytes.push(0x3f);
  }
  return bytes;
}

// ---------- Receipt builder (ESC/POS bytes) ----------
export interface PrintLine {
  text: string;
  bold?: boolean;
  size?: "normal" | "double" | "doubleH";
  align?: "left" | "center" | "right";
}

function linesToBytes(lines: PrintLine[]): Uint8Array {
  const out: number[] = [];
  out.push(...CMD_INIT, ...CMD_CP862);
  for (const l of lines) {
    out.push(...(l.align === "center" ? CMD_ALIGN_CENTER : l.align === "left" ? CMD_ALIGN_LEFT : CMD_ALIGN_RIGHT));
    out.push(...(l.size === "double" ? CMD_SIZE_DOUBLE : l.size === "doubleH" ? CMD_SIZE_DBL_H : CMD_SIZE_NORMAL));
    out.push(...(l.bold ? CMD_BOLD_ON : CMD_BOLD_OFF));
    out.push(...encodeTextLine(l.text));
    out.push(0x0a);
  }
  out.push(...CMD_SIZE_NORMAL, ...CMD_BOLD_OFF, ...CMD_ALIGN_LEFT);
  out.push(...CMD_FEED_3);
  out.push(...CMD_CUT);
  return new Uint8Array(out);
}

const SEP = "--------------------------------";

export function buildKitchenBonLines(order: ReceiptOrder): PrintLine[] {
  const time = new Date(order.created_at).toLocaleTimeString("he-IL", {
    hour: "2-digit", minute: "2-digit",
  });
  const lines: PrintLine[] = [];
  lines.push({ text: "הבקתה", align: "center", size: "double", bold: true });
  lines.push({ text: SEP, align: "center" });
  lines.push({ text: `הזמנה #${order.order_number}`, align: "right", size: "doubleH", bold: true });
  lines.push({ text: `שעה: ${time}`, align: "right" });
  if (order.customer_name) lines.push({ text: `שם: ${order.customer_name}`, align: "right" });
  if (order.customer_phone) lines.push({ text: `טלפון: ${order.customer_phone}`, align: "right" });
  lines.push({ text: SEP, align: "center" });

  for (const it of order.order_items) {
    const qty = it.quantity > 1 ? ` ×${it.quantity}` : "";
    lines.push({ text: `${it.item_name}${qty}`, align: "right", bold: true });
    // doneness / removals (owner name we keep simple)
    if (it.removals && it.removals.length > 0) {
      lines.push({ text: `- ${it.removals.join(", ")}`, align: "right" });
    }
    if (it.toppings && it.toppings.length > 0) {
      lines.push({ text: `+ ${it.toppings.join(", ")}`, align: "right" });
    }
    if (it.with_meal) {
      let m = "ארוחה";
      if (it.meal_side) m += ` — ${it.meal_side}`;
      if (it.meal_drink) m += `, ${it.meal_drink}`;
      lines.push({ text: `→ ${m}`, align: "right" });
    }
    if (Array.isArray(it.deal_burgers)) {
      it.deal_burgers.forEach((b: any, i: number) => {
        lines.push({ text: `${i + 1}. ${b.name || ""}`, align: "right" });
        if (b.removals?.length > 0) lines.push({ text: `- ${b.removals.join(", ")}`, align: "right" });
      });
    }
    if (Array.isArray(it.deal_drinks)) {
      it.deal_drinks.forEach((d: any) => lines.push({ text: `+ ${d.name}`, align: "right" }));
    }
  }

  if (order.notes) {
    lines.push({ text: SEP, align: "center" });
    lines.push({ text: `הערות: ${order.notes}`, align: "right", bold: true });
  }
  lines.push({ text: SEP, align: "center" });
  // Patty / bun summary at the bottom (quick chef glance)
  const totalItems = order.order_items.reduce((s, i) => s + i.quantity, 0);
  lines.push({ text: `סה״כ פריטים: ${totalItems}`, align: "right" });
  return lines;
}

// ---------- Web Bluetooth connection ----------
// Common BLE printer GATT services. We list them all in optionalServices so
// the user only has to pair once, regardless of which model they bring.
const PRINTER_SERVICES: BluetoothServiceUUID[] = [
  0x18f0,
  0xff00,
  0xff12,
  0xffe0,
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC/Microchip
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

const STORAGE_KEY = "bt-printer-device-id";

let cachedDevice: BluetoothDevice | null = null;
let cachedChar: BluetoothRemoteGATTCharacteristic | null = null;
const listeners = new Set<(connected: boolean) => void>();

function notify(connected: boolean) {
  listeners.forEach((l) => { try { l(connected); } catch {} });
}

export function onPrinterStatusChange(fn: (connected: boolean) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function isPrinterConnected(): boolean {
  return !!(cachedDevice?.gatt?.connected && cachedChar);
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as any).bluetooth;
}

async function findWritableCharacteristic(server: BluetoothRemoteGATTServer): Promise<BluetoothRemoteGATTCharacteristic> {
  const services = await server.getPrimaryServices();
  for (const svc of services) {
    try {
      const chars = await svc.getCharacteristics();
      for (const c of chars) {
        if (c.properties.write || c.properties.writeWithoutResponse) return c;
      }
    } catch {}
  }
  throw new Error("לא נמצאה תכונת כתיבה במדפסת");
}

async function connectDevice(device: BluetoothDevice): Promise<BluetoothRemoteGATTCharacteristic> {
  if (!device.gatt) throw new Error("אין GATT למדפסת");
  device.addEventListener("gattserverdisconnected", () => {
    cachedChar = null;
    notify(false);
  });
  const server = await device.gatt.connect();
  const char = await findWritableCharacteristic(server);
  cachedDevice = device;
  cachedChar = char;
  try { localStorage.setItem(STORAGE_KEY, device.id); } catch {}
  notify(true);
  return char;
}

export async function pairPrinter(): Promise<void> {
  if (!isWebBluetoothSupported()) {
    throw new Error("הדפדפן הזה לא תומך ב-Web Bluetooth. השתמש ב-Chrome / Edge על אנדרואיד.");
  }
  const device = await (navigator as any).bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICES,
  });
  await connectDevice(device);
}

// Best-effort silent reconnect after page reload (Chrome on Android only).
export async function tryAutoReconnect(): Promise<boolean> {
  if (!isWebBluetoothSupported()) return false;
  const savedId = (() => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } })();
  if (!savedId) return false;
  const bt: any = (navigator as any).bluetooth;
  if (typeof bt.getDevices !== "function") return false;
  try {
    const devices: BluetoothDevice[] = await bt.getDevices();
    const dev = devices.find((d) => d.id === savedId);
    if (!dev) return false;
    await connectDevice(dev);
    return true;
  } catch {
    return false;
  }
}

export async function disconnectPrinter(): Promise<void> {
  try { cachedDevice?.gatt?.disconnect(); } catch {}
  cachedDevice = null;
  cachedChar = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  notify(false);
}

async function ensureConnected(): Promise<BluetoothRemoteGATTCharacteristic> {
  if (cachedChar && cachedDevice?.gatt?.connected) return cachedChar;
  if (cachedDevice) {
    try { return await connectDevice(cachedDevice); } catch {}
  }
  const reconnected = await tryAutoReconnect();
  if (reconnected && cachedChar) return cachedChar;
  throw new Error("המדפסת לא מחוברת. לחץ על 'חיבור מדפסת' כדי לבחור אותה.");
}

// Send bytes in small chunks — BLE MTU is ~20-180 bytes.
async function writeBytes(char: BluetoothRemoteGATTCharacteristic, data: Uint8Array) {
  const CHUNK = 180;
  const useNoResp = !!char.properties.writeWithoutResponse;
  for (let i = 0; i < data.length; i += CHUNK) {
    const slice = data.slice(i, Math.min(i + CHUNK, data.length));
    if (useNoResp) {
      // @ts-ignore — older typings
      await (char.writeValueWithoutResponse ? char.writeValueWithoutResponse(slice) : char.writeValue(slice));
    } else {
      await char.writeValue(slice);
    }
    // Small delay between chunks helps slower printers
    await new Promise((r) => setTimeout(r, 20));
  }
}

export async function printLines(lines: PrintLine[]): Promise<void> {
  const char = await ensureConnected();
  const bytes = linesToBytes(lines);
  await writeBytes(char, bytes);
}

export async function printBluetoothReceipt(order: ReceiptOrder): Promise<void> {
  await printLines(buildKitchenBonLines(order));
}

export async function printTest(): Promise<void> {
  await printLines([
    { text: "הבקתה", align: "center", size: "double", bold: true },
    { text: SEP, align: "center" },
    { text: "בדיקת הדפסה", align: "center", size: "doubleH", bold: true },
    { text: SEP, align: "center" },
    { text: new Date().toLocaleString("he-IL"), align: "center" },
  ]);
}

// Convenience helper used by Kitchen.tsx: try BT, fallback to window.print HTML.
export async function printReceiptAuto(
  order: ReceiptOrder,
  fallback: (o: ReceiptOrder) => Promise<void> | void,
): Promise<{ method: "bluetooth" | "browser" }> {
  if (isPrinterConnected()) {
    try {
      await printBluetoothReceipt(order);
      return { method: "bluetooth" };
    } catch (e) {
      console.warn("[bt-printer] failed, falling back to browser print", e);
    }
  }
  await fallback(order);
  return { method: "browser" };
}
