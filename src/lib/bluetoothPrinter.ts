// Web Bluetooth ESC/POS thermal printer driver.
// Targets Xprinter / generic 58mm-80mm BLE thermal printers (e.g. Printer001-352C).
//
// Hebrew support: different Xprinter firmwares disagree on the ESC t code-page
// number, so we keep three selectable encoding profiles. The active profile is
// persisted in localStorage; the user picks via a "cycle test print" that
// prints the same Hebrew text under all three profiles labeled A/B/C.

import html2canvas from "html2canvas";
import { buildReceiptHtml, type RoundOrder, buildRoundSummaryHtml, buildRoundChefSummaryHtml } from "./kitchenReceipt";
import type { ReceiptOrder } from "./kitchenReceipt";

type BluetoothServiceUUID = number | string;
type BluetoothDevice = any;
type BluetoothRemoteGATTServer = any;
type BluetoothRemoteGATTCharacteristic = any;

// ---------- ESC/POS constants ----------
const ESC = 0x1b;
const GS = 0x1d;

const CMD_INIT = [ESC, 0x40];
const CMD_INTL_HEBREW = [ESC, 0x52, 7]; // ESC R n — international charset (7 ~ Hebrew on some)
const CMD_ALIGN_LEFT = [ESC, 0x61, 0];
const CMD_ALIGN_CENTER = [ESC, 0x61, 1];
const CMD_ALIGN_RIGHT = [ESC, 0x61, 2];
const CMD_BOLD_ON = [ESC, 0x45, 1];
const CMD_BOLD_OFF = [ESC, 0x45, 0];
const CMD_SIZE_NORMAL = [GS, 0x21, 0x00];
const CMD_SIZE_DOUBLE = [GS, 0x21, 0x11];
const CMD_SIZE_DBL_H = [GS, 0x21, 0x01];
const CMD_FEED_3 = [ESC, 0x64, 3];
const CMD_CUT = [GS, 0x56, 0x42, 0x00];

// ---------- Encoding profiles ----------
// CP862 (Hebrew DOS) — Hebrew letters at 0x80-0x9A
const CP862_HEBREW: Record<string, number> = {
  "א": 0x80, "ב": 0x81, "ג": 0x82, "ד": 0x83, "ה": 0x84,
  "ו": 0x85, "ז": 0x86, "ח": 0x87, "ט": 0x88, "י": 0x89,
  "ך": 0x8a, "כ": 0x8b, "ל": 0x8c, "ם": 0x8d, "מ": 0x8e,
  "ן": 0x8f, "נ": 0x90, "ס": 0x91, "ע": 0x92, "ף": 0x93,
  "פ": 0x94, "ץ": 0x95, "צ": 0x96, "ק": 0x97, "ר": 0x98,
  "ש": 0x99, "ת": 0x9a,
  "₪": 0x9c,
};

// CP1255 (Windows Hebrew) — Hebrew letters at 0xE0-0xFA
const CP1255_HEBREW: Record<string, number> = {
  "א": 0xe0, "ב": 0xe1, "ג": 0xe2, "ד": 0xe3, "ה": 0xe4,
  "ו": 0xe5, "ז": 0xe6, "ח": 0xe7, "ט": 0xe8, "י": 0xe9,
  "ך": 0xea, "כ": 0xeb, "ל": 0xec, "ם": 0xed, "מ": 0xee,
  "ן": 0xef, "נ": 0xf0, "ס": 0xf1, "ע": 0xf2, "ף": 0xf3,
  "פ": 0xf4, "ץ": 0xf5, "צ": 0xf6, "ק": 0xf7, "ר": 0xf8,
  "ש": 0xf9, "ת": 0xfa,
  "₪": 0xa4,
};

export type EncodingProfile = "cp862-21" | "cp862-15" | "cp1255-33";

const PROFILE_LABEL: Record<EncodingProfile, string> = {
  "cp862-21": "CP862 (n=21) — Hebrew DOS",
  "cp862-15": "CP862 (n=15) — Hebrew (Xprinter alt)",
  "cp1255-33": "CP1255 (n=33) — Hebrew Windows",
};

function profileCharset(p: EncodingProfile): Record<string, number> {
  return p.startsWith("cp1255") ? CP1255_HEBREW : CP862_HEBREW;
}

function profileSetCodepageCmd(p: EncodingProfile): number[] {
  // ESC t n
  const n = p === "cp862-21" ? 21 : p === "cp862-15" ? 15 : 33;
  return [ESC, 0x74, n];
}

const ENCODING_KEY = "bt-printer-encoding";

export function getEncoding(): EncodingProfile {
  try {
    const v = localStorage.getItem(ENCODING_KEY) as EncodingProfile | null;
    if (v === "cp862-21" || v === "cp862-15" || v === "cp1255-33") return v;
  } catch {}
  return "cp862-21";
}

export function setEncoding(p: EncodingProfile) {
  try { localStorage.setItem(ENCODING_KEY, p); } catch {}
}

export function getEncodingLabel(p: EncodingProfile = getEncoding()): string {
  return PROFILE_LABEL[p];
}

// ---------- Visual RTL ----------
function visualReverseRtl(line: string): string {
  if (!/[\u0590-\u05FF]/.test(line)) return line;
  const reversed = [...line].reverse().join("");
  return reversed.replace(/[A-Za-z0-9.,:#×₪/\-\+]+/g, (s) => [...s].reverse().join(""));
}

function encodeTextLine(line: string, profile: EncodingProfile): number[] {
  const charset = profileCharset(profile);
  const visual = visualReverseRtl(line);
  const bytes: number[] = [];
  for (const ch of visual) {
    if (ch === "\n") { bytes.push(0x0a); continue; }
    const heb = charset[ch];
    if (heb !== undefined) { bytes.push(heb); continue; }
    const code = ch.charCodeAt(0);
    if (code < 0x80) { bytes.push(code); continue; }
    bytes.push(0x3f);
  }
  return bytes;
}

// ---------- Receipt builder ----------
export interface PrintLine {
  text: string;
  bold?: boolean;
  size?: "normal" | "double" | "doubleH";
  align?: "left" | "center" | "right";
}

function linesToBytes(lines: PrintLine[], profile: EncodingProfile): Uint8Array {
  const out: number[] = [];
  out.push(...CMD_INIT, ...profileSetCodepageCmd(profile), ...CMD_INTL_HEBREW);
  for (const l of lines) {
    out.push(...(l.align === "center" ? CMD_ALIGN_CENTER : l.align === "left" ? CMD_ALIGN_LEFT : CMD_ALIGN_RIGHT));
    out.push(...(l.size === "double" ? CMD_SIZE_DOUBLE : l.size === "doubleH" ? CMD_SIZE_DBL_H : CMD_SIZE_NORMAL));
    out.push(...(l.bold ? CMD_BOLD_ON : CMD_BOLD_OFF));
    out.push(...encodeTextLine(l.text, profile));
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
  const totalItems = order.order_items.reduce((s, i) => s + i.quantity, 0);
  lines.push({ text: `סה״כ פריטים: ${totalItems}`, align: "right" });
  return lines;
}

// ---------- Web Bluetooth connection ----------
const PRINTER_SERVICES: BluetoothServiceUUID[] = [
  0x18f0,
  0xff00,
  0xff12,
  0xffe0,
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
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

async function writeBytes(char: BluetoothRemoteGATTCharacteristic, data: Uint8Array) {
  const CHUNK = 180;
  const useNoResp = !!char.properties.writeWithoutResponse;
  for (let i = 0; i < data.length; i += CHUNK) {
    const slice = data.slice(i, Math.min(i + CHUNK, data.length));
    if (useNoResp) {
      // @ts-ignore
      await (char.writeValueWithoutResponse ? char.writeValueWithoutResponse(slice) : char.writeValue(slice));
    } else {
      await char.writeValue(slice);
    }
    await new Promise((r) => setTimeout(r, 20));
  }
}

export async function printLines(lines: PrintLine[], profile: EncodingProfile = getEncoding()): Promise<void> {
  const char = await ensureConnected();
  const bytes = linesToBytes(lines, profile);
  await writeBytes(char, bytes);
}

export async function printBluetoothReceipt(order: ReceiptOrder): Promise<void> {
  await printLines(buildKitchenBonLines(order));
}

// Test print using the currently selected encoding profile.
export async function printTest(): Promise<void> {
  const profile = getEncoding();
  await printLines([
    { text: "הבקתה", align: "center", size: "double", bold: true },
    { text: SEP, align: "center" },
    { text: "שלום מהבקתה", align: "right", size: "doubleH", bold: true },
    { text: "בדיקת עברית 123", align: "right" },
    { text: SEP, align: "center" },
    { text: `Profile: ${profile}`, align: "left" },
  ], profile);
}

// Cycle test: prints the same Hebrew text three times with different
// encoding profiles, each labeled A/B/C, so the user can see which is
// readable on their Xprinter and lock it.
export async function printTestCycle(): Promise<void> {
  const profiles: EncodingProfile[] = ["cp862-21", "cp862-15", "cp1255-33"];
  const tags = ["A", "B", "C"];
  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i];
    await printLines([
      { text: `=== TEST ${tags[i]} : ${p} ===`, align: "center", bold: true },
      { text: "שלום מהבקתה", align: "right", size: "doubleH", bold: true },
      { text: "בדיקת עברית 123", align: "right" },
      { text: SEP, align: "center" },
    ], p);
  }
}

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
