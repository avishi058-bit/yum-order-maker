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
  try {
    const mtu = (char as any).maximumWriteValueLength;
    console.log('[PRINTER] MTU / maximumWriteValueLength:', mtu);
    console.log('[PRINTER] Device name:', device.name, '| id:', device.id);
    console.log('[PRINTER] Characteristic UUID:', char.uuid, '| service:', char.service?.uuid);
    console.log('[PRINTER] Properties:', {
      write: char.properties?.write,
      writeWithoutResponse: char.properties?.writeWithoutResponse,
      notify: char.properties?.notify,
    });
  } catch (e) { console.warn('[PRINTER] could not read MTU', e); }
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
  // CHUNK=240 stays under typical ATT MTU (247-3). subarray = zero-copy.
  // Pipelining: writeWithoutResponse in Chrome buffers locally. Firing several
  // chunks before awaiting lets the BLE stack keep the radio busy instead of
  // waiting RTT between every chunk. PIPELINE=4 is safe across most adapters.
  const useNoResp = !!char.properties.writeWithoutResponse;
  const CHUNK = useNoResp ? 240 : 180;
  const DELAY_MS = useNoResp ? 0 : 4;
  const PIPELINE = useNoResp ? 8 : 1;
  const writeOne = (slice: Uint8Array): Promise<void> => {
    if (useNoResp) {
      // @ts-ignore
      return char.writeValueWithoutResponse ? char.writeValueWithoutResponse(slice) : char.writeValue(slice);
    }
    return char.writeValue(slice);
  };
  let inflight: Promise<void>[] = [];
  for (let i = 0; i < data.length; i += CHUNK) {
    const end = Math.min(i + CHUNK, data.length);
    const slice = data.subarray(i, end);
    inflight.push(writeOne(slice).catch(() => {}));
    if (inflight.length >= PIPELINE) {
      await Promise.all(inflight);
      inflight = [];
      if (DELAY_MS > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }
  if (inflight.length) await Promise.all(inflight);
}

export async function printLines(lines: PrintLine[], profile: EncodingProfile = getEncoding()): Promise<void> {
  const char = await ensureConnected();
  const bytes = linesToBytes(lines, profile);
  await writeBytes(char, bytes);
}

// =====================================================================
// RASTER BITMAP PRINTING (recommended path — bypasses Hebrew codepage)
// Renders existing HTML receipt via html2canvas, converts to 1-bit
// monochrome bitmap, and sends as ESC/POS GS v 0 raster command.
// =====================================================================

// Paper width in dots. 40mm thermal @ 203 dpi ≈ 320 dots (multiple of 8).
// Stored in localStorage so user can adjust per printer if needed.
const WIDTH_KEY = "bt-printer-width-dots";
export function getPaperWidthDots(): number {
  try {
    const v = parseInt(localStorage.getItem(WIDTH_KEY) || "", 10);
    if (v >= 64 && v <= 832 && v % 8 === 0) return v;
  } catch {}
  return 320;
}
export function setPaperWidthDots(dots: number) {
  const clamped = Math.max(64, Math.min(832, Math.floor(dots / 8) * 8));
  try { localStorage.setItem(WIDTH_KEY, String(clamped)); } catch {}
}

// Render arbitrary HTML inside a hidden offscreen iframe to a canvas.
async function renderHtmlToCanvas(html: string, widthCssPx: number): Promise<HTMLCanvasElement> {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = widthCssPx + "px";
  iframe.style.height = "10px";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();
    const isNarrow40mm = widthCssPx <= 320;
    // Force thermal paper width on the printed body regardless of the browser-print CSS.
    // The original bons are designed for preview/window.print (80mm). For Bluetooth
    // raster we need a true dot-width layout so Xprinter does not print a tiny 80mm
    // page squeezed into a 40mm image.
    const style = doc.createElement("style");
    style.textContent = `
      @page { size: ${widthCssPx}px auto !important; margin: 0 !important; }
      html, body {
        width: ${widthCssPx}px !important;
        min-width: ${widthCssPx}px !important;
        max-width: ${widthCssPx}px !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        color: #000 !important;
        direction: rtl !important;
        overflow: hidden visible !important;
      }
      body {
        padding: ${isNarrow40mm ? "2px 4px 8px" : "4px 6px 10px"} !important;
        font-family: Arial, "Heebo", sans-serif !important;
        font-size: ${isNarrow40mm ? "15px" : "17px"} !important;
        line-height: 1.22 !important;
        text-align: right !important;
      }
      * { max-width: 100% !important; box-sizing: border-box !important; }
      a { color: #000 !important; text-decoration: none !important; }
      .order-num { font-size: ${isNarrow40mm ? "32px" : "38px"} !important; line-height: 1 !important; margin: 0 0 6px !important; }
      .order-num small, .head small { font-size: ${isNarrow40mm ? "13px" : "15px"} !important; margin-top: 2px !important; }
      .head { font-size: ${isNarrow40mm ? "23px" : "27px"} !important; margin: 0 0 4px !important; }
      .type, .order-num, .head, .meta, .summary-title, .sum-section-title, .footer, .warn, .paid { text-align: center !important; }
      .type, .order-head .order-num, .owner { padding: ${isNarrow40mm ? "5px 4px" : "7px 6px"} !important; margin-bottom: 6px !important; }
      .customer, .meta { font-size: ${isNarrow40mm ? "14px" : "16px"} !important; padding-bottom: 6px !important; margin-bottom: 6px !important; }
      .customer .name { font-size: ${isNarrow40mm ? "18px" : "21px"} !important; }
      .customer .phone-row { gap: 6px !important; margin-top: 4px !important; }
      .customer .phone-qr { width: ${isNarrow40mm ? "52px" : "62px"} !important; height: ${isNarrow40mm ? "52px" : "62px"} !important; padding: 2px !important; }
      .notes, .warn { padding: ${isNarrow40mm ? "7px" : "9px"} !important; margin: 7px 0 !important; font-size: ${isNarrow40mm ? "17px" : "19px"} !important; }
      .line { padding: ${isNarrow40mm ? "7px 0" : "9px 0"} !important; }
      .line-name { font-size: ${isNarrow40mm ? "21px" : "24px"} !important; line-height: 1.15 !important; }
      .sub { font-size: ${isNarrow40mm ? "16px" : "18px"} !important; padding-right: ${isNarrow40mm ? "10px" : "14px"} !important; line-height: 1.2 !important; margin-top: 3px !important; }
      .summary { margin-top: 9px !important; padding: ${isNarrow40mm ? "7px" : "9px"} !important; border: 3px solid #000 !important; }
      .summary-title { font-size: ${isNarrow40mm ? "20px" : "23px"} !important; padding-bottom: 5px !important; margin-bottom: 7px !important; }
      .sum-section { margin-top: 7px !important; padding-top: 5px !important; }
      .sum-section-title { font-size: ${isNarrow40mm ? "16px" : "18px"} !important; padding: 4px 2px !important; margin-bottom: 4px !important; }
      .sum-row { font-size: ${isNarrow40mm ? "18px" : "21px"} !important; padding: 4px 0 !important; gap: 8px !important; }
      .sum-num { font-size: ${isNarrow40mm ? "22px" : "25px"} !important; min-width: ${isNarrow40mm ? "34px" : "40px"} !important; padding: 0 6px !important; }
      .footer { font-size: ${isNarrow40mm ? "15px" : "17px"} !important; margin-top: 8px !important; padding: 6px 0 10px !important; }
      img, svg { max-width: 100% !important; height: auto !important; }
    `;
    doc.head.appendChild(style);
    // Wait for fonts/images
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      if (doc.readyState === "complete") {
        (doc as any).fonts?.ready?.then(done, done) ?? done();
      } else {
        iframe.addEventListener("load", () => {
          (doc as any).fonts?.ready?.then(done, done) ?? done();
        }, { once: true });
      }
    });
    await new Promise((r) => setTimeout(r, 80));
    const target = doc.body;
    // Match iframe height to content so html2canvas captures everything.
    iframe.style.height = target.scrollHeight + 20 + "px";
    await new Promise((r) => setTimeout(r, 30));
    const canvas = await html2canvas(target, {
      width: widthCssPx,
      windowWidth: widthCssPx,
      backgroundColor: "#ffffff",
      scale: 1,
      useCORS: true,
      logging: false,
    });
    return canvas;
  } finally {
    document.body.removeChild(iframe);
  }
}

// Convert canvas to 1-bit monochrome bytes (MSB-first, row-major).
function canvasToMonoBytes(canvas: HTMLCanvasElement, targetWidthDots: number): { bytes: Uint8Array; widthBytes: number; height: number } {
  // Scale canvas to exact target width.
  const scale = targetWidthDots / canvas.width;
  const outW = targetWidthDots;
  const outH = Math.max(1, Math.round(canvas.height * scale));
  const off = document.createElement("canvas");
  off.width = outW;
  off.height = outH;
  const ctx = off.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(canvas, 0, 0, outW, outH);
  const { data } = ctx.getImageData(0, 0, outW, outH);
  const widthBytes = outW / 8;
  const bytes = new Uint8Array(widthBytes * outH);
  // Floyd–Steinberg-ish simple threshold with luminance.
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const i = (y * outW + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      // Treat transparent as white.
      const lum = a < 128 ? 255 : 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < 160) {
        const byteIdx = y * widthBytes + (x >> 3);
        bytes[byteIdx] |= 0x80 >> (x & 7);
      }
    }
  }
  // Trim trailing all-white rows to avoid printing blank tape.
  let trimmedHeight = outH;
  while (trimmedHeight > 1) {
    const rowStart = (trimmedHeight - 1) * widthBytes;
    let blank = true;
    for (let i = 0; i < widthBytes; i++) {
      if (bytes[rowStart + i] !== 0) { blank = false; break; }
    }
    if (!blank) break;
    trimmedHeight--;
  }
  const trimmed = trimmedHeight === outH ? bytes : bytes.slice(0, trimmedHeight * widthBytes);
  return { bytes: trimmed, widthBytes, height: trimmedHeight };
}

// Build ESC/POS bytes for a raster bitmap. Splits into chunks of N rows so
// large receipts don't overflow printer buffer.
function buildRasterCommands(mono: { bytes: Uint8Array; widthBytes: number; height: number }): Uint8Array {
  const { bytes, widthBytes, height } = mono;
  const ROWS_PER_CHUNK = 128;
  const out: number[] = [];
  out.push(...CMD_INIT, ...CMD_ALIGN_LEFT);
  for (let yStart = 0; yStart < height; yStart += ROWS_PER_CHUNK) {
    const rows = Math.min(ROWS_PER_CHUNK, height - yStart);
    // GS v 0 m xL xH yL yH
    out.push(GS, 0x76, 0x30, 0x00,
      widthBytes & 0xff, (widthBytes >> 8) & 0xff,
      rows & 0xff, (rows >> 8) & 0xff);
    const sliceStart = yStart * widthBytes;
    const sliceEnd = sliceStart + rows * widthBytes;
    for (let i = sliceStart; i < sliceEnd; i++) out.push(bytes[i]);
  }
  // Smaller paper feed before cut — saves time and tape.
  out.push(ESC, 0x64, 2);
  out.push(...CMD_CUT);
  return new Uint8Array(out);
}

// =====================================================================
// HYBRID FAST PRINTING — ESC/POS text + per-line Hebrew bitmaps.
// 10-30x faster than full-page raster, and avoids dense black areas
// that bog down thermal printers.
// =====================================================================

export type FastOp =
  | { kind: "init" }
  | { kind: "text"; text: string; align?: "L" | "C" | "R"; bold?: boolean; size?: 1 | 2 }
  | { kind: "heb"; text: string; align?: "L" | "C" | "R"; bold?: boolean; size?: number }
  | { kind: "header"; name: string; phone?: string; namePx?: number; phonePx?: number }
  | { kind: "twoCol"; right: string; left: string; size?: number; bold?: boolean }
  | { kind: "sep" }
  | { kind: "feed"; n: number }
  | { kind: "cut" };

function _align(a: "L" | "C" | "R" = "L"): number[] {
  return [ESC, 0x61, a === "L" ? 0 : a === "C" ? 1 : 2];
}
function _size(s: 1 | 2 = 1): number[] {
  return [GS, 0x21, s === 2 ? 0x11 : 0x00];
}
function _bold(b: boolean): number[] {
  return [ESC, 0x45, b ? 1 : 0];
}

// Wrap a long Hebrew/Unicode line into multiple sublines that fit the canvas.
function _wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (ctx.measureText(text).width <= maxWidth) return [text];
  const parts = text.split(/(\s+)/);
  const out: string[] = [];
  let cur = "";
  for (const p of parts) {
    const test = cur + p;
    if (ctx.measureText(test).width <= maxWidth) cur = test;
    else {
      if (cur.trim()) out.push(cur.trim());
      cur = p.trim();
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out.length ? out : [text];
}

// Render one Hebrew/Unicode line to a tightly-cropped 1-bit bitmap.
// No background fill, no padding boxes — just the letter ink.
function _renderHebToMono(
  text: string,
  opts: { width: number; px: number; bold: boolean; align: "L" | "C" | "R" },
): { bytes: Uint8Array; widthBytes: number; height: number; offsetX: number } {
  const { width, px, bold, align } = opts;
  const tmp = document.createElement("canvas");
  tmp.width = 10;
  tmp.height = 10;
  const measure = tmp.getContext("2d")!;
  measure.font = `${bold ? "900" : "500"} ${px}px Arial, "Heebo", sans-serif`;
  const lines = _wrapText(measure, text, width - 4);

  const lineH = Math.ceil(px * 1.15);
  const h = lineH * lines.length + 2;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, h);
  ctx.fillStyle = "#000";
  ctx.font = measure.font;
  // RTL so Hebrew flows visually correct on a regular browser canvas.
  (ctx as unknown as { direction: string }).direction = "rtl";
  ctx.textBaseline = "middle";

  let x: number;
  if (align === "R") {
    ctx.textAlign = "right";
    x = width - 2;
  } else if (align === "C") {
    ctx.textAlign = "center";
    x = width / 2;
  } else {
    ctx.textAlign = "left";
    x = 2;
  }
  lines.forEach((ln, i) => ctx.fillText(ln, x, lineH * i + lineH / 2 + 1));

  // Convert to 1-bit MSB-first, pad width to multiple of 8.
  const padW = Math.ceil(width / 8) * 8;
  const widthBytes = padW / 8;
  const { data } = ctx.getImageData(0, 0, width, h);
  const bytes = new Uint8Array(widthBytes * h);
  for (let y = 0; y < h; y++) {
    for (let xp = 0; xp < width; xp++) {
      const i = (y * width + xp) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < 140) bytes[y * widthBytes + (xp >> 3)] |= 0x80 >> (xp & 7);
    }
  }

  // Crop blank rows top + bottom — tight letter band only, no wasted feed.
  const rowBlank = (r: number) => {
    for (let i = 0; i < widthBytes; i++) if (bytes[r * widthBytes + i] !== 0) return false;
    return true;
  };
  let top = 0;
  let bot = h - 1;
  while (top < h && rowBlank(top)) top++;
  while (bot > top && rowBlank(bot)) bot--;
  if (top >= bot) {
    // All blank — emit one feed row.
    return { bytes: new Uint8Array(1), widthBytes: 1, height: 1, offsetX: 0 };
  }

  const colBlank = (c: number) => {
    for (let r = top; r <= bot; r++) if (bytes[r * widthBytes + (c >> 3)] & (0x80 >> (c & 7))) return false;
    return true;
  };
  let left = 0;
  let right = width - 1;
  while (left < width && colBlank(left)) left++;
  while (right > left && colBlank(right)) right--;

  // Tight vertical padding — keeps line spacing but skips wasted blank rows.
  const padT = Math.max(0, top - 2);
  const padB = Math.min(h - 1, bot + 2);
  const padL = Math.max(0, left - 2);
  const padR = Math.min(width - 1, right + 2);
  const newH = padB - padT + 1;
  const croppedW = Math.max(8, Math.ceil((padR - padL + 1) / 8) * 8);
  const croppedWidthBytes = croppedW / 8;
  const cropped = new Uint8Array(croppedWidthBytes * newH);
  for (let y = 0; y < newH; y++) {
    for (let x = 0; x < croppedW && padL + x < width; x++) {
      const srcX = padL + x;
      const srcY = padT + y;
      if (bytes[srcY * widthBytes + (srcX >> 3)] & (0x80 >> (srcX & 7))) {
        cropped[y * croppedWidthBytes + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }
  const offsetX = align === "R" ? Math.max(0, width - croppedW) : align === "C" ? Math.max(0, Math.floor((width - croppedW) / 2)) : 0;
  return { bytes: cropped, widthBytes: croppedWidthBytes, height: newH, offsetX };
}

function _rasterEscPos(mono: { bytes: Uint8Array; widthBytes: number; height: number }): number[] {
  const out: number[] = [];
  const { bytes, widthBytes, height } = mono;
  const ROWS = 255;
  for (let y = 0; y < height; y += ROWS) {
    const rows = Math.min(ROWS, height - y);
    out.push(GS, 0x76, 0x30, 0x00,
      widthBytes & 0xff, (widthBytes >> 8) & 0xff,
      rows & 0xff, (rows >> 8) & 0xff);
    for (let i = y * widthBytes; i < (y + rows) * widthBytes; i++) out.push(bytes[i]);
  }
  return out;
}

// Shared: convert a canvas to 1-bit MSB-first bytes and crop top/bottom (and
// optionally left/right) blank rows. Used by header/twoCol renderers below.
function _canvasToCroppedMono(
  canvas: HTMLCanvasElement,
  width: number,
  cropX: boolean,
): { bytes: Uint8Array; widthBytes: number; height: number; offsetX: number } {
  const h = canvas.height;
  const ctx = canvas.getContext("2d")!;
  const padW = Math.ceil(width / 8) * 8;
  const widthBytes = padW / 8;
  const { data } = ctx.getImageData(0, 0, width, h);
  const bytes = new Uint8Array(widthBytes * h);
  for (let y = 0; y < h; y++) {
    for (let xp = 0; xp < width; xp++) {
      const i = (y * width + xp) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < 140) bytes[y * widthBytes + (xp >> 3)] |= 0x80 >> (xp & 7);
    }
  }
  const rowBlank = (r: number) => {
    for (let i = 0; i < widthBytes; i++) if (bytes[r * widthBytes + i] !== 0) return false;
    return true;
  };
  let top = 0, bot = h - 1;
  while (top < h && rowBlank(top)) top++;
  while (bot > top && rowBlank(bot)) bot--;
  if (top >= bot) return { bytes: new Uint8Array(1), widthBytes: 1, height: 1, offsetX: 0 };
  const padT = Math.max(0, top - 2);
  const padB = Math.min(h - 1, bot + 2);
  const newH = padB - padT + 1;
  if (!cropX) {
    const out = bytes.slice(padT * widthBytes, (padB + 1) * widthBytes);
    return { bytes: out, widthBytes, height: newH, offsetX: 0 };
  }
  // also crop x
  const colBlank = (c: number) => {
    for (let r = padT; r <= padB; r++) if (bytes[r * widthBytes + (c >> 3)] & (0x80 >> (c & 7))) return false;
    return true;
  };
  let left = 0, right = width - 1;
  while (left < width && colBlank(left)) left++;
  while (right > left && colBlank(right)) right--;
  const padL = Math.max(0, left - 2);
  const padR = Math.min(width - 1, right + 2);
  const croppedW = Math.max(8, Math.ceil((padR - padL + 1) / 8) * 8);
  const cBytes = croppedW / 8;
  const cropped = new Uint8Array(cBytes * newH);
  for (let y = 0; y < newH; y++) {
    for (let x = 0; x < croppedW && padL + x < width; x++) {
      const sx = padL + x, sy = padT + y;
      if (bytes[sy * widthBytes + (sx >> 3)] & (0x80 >> (sx & 7))) {
        cropped[y * cBytes + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }
  const offsetX = Math.max(0, width - croppedW);
  return { bytes: cropped, widthBytes: cBytes, height: newH, offsetX };
}

// Customer name (big bold) + (phone) inline at smaller size on the same line.
function _renderHeaderToMono(
  name: string,
  phone: string | undefined,
  namePx: number,
  phonePx: number,
  width: number,
): { bytes: Uint8Array; widthBytes: number; height: number; offsetX: number } {
  const lineH = Math.ceil(namePx * 1.15);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = lineH + 4;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, canvas.height);
  ctx.fillStyle = "#000";
  (ctx as unknown as { direction: string }).direction = "rtl";
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  const y = lineH / 2 + 2;
  ctx.font = `900 ${namePx}px Arial, "Heebo", sans-serif`;
  ctx.fillText(name, width - 2, y);
  if (phone) {
    const nameW = ctx.measureText(name).width;
    ctx.font = `500 ${phonePx}px Arial, "Heebo", sans-serif`;
    ctx.fillText(`(${phone})`, width - 2 - nameW - 8, y);
  }
  return _canvasToCroppedMono(canvas, width, false);
}

// Two-column row: right text right-aligned, left text left-aligned.
function _renderTwoColToMono(
  right: string,
  left: string,
  px: number,
  bold: boolean,
  width: number,
): { bytes: Uint8Array; widthBytes: number; height: number; offsetX: number } {
  const lineH = Math.ceil(px * 1.15);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = lineH + 4;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, canvas.height);
  ctx.fillStyle = "#000";
  (ctx as unknown as { direction: string }).direction = "rtl";
  ctx.textBaseline = "middle";
  ctx.font = `${bold ? "900" : "500"} ${px}px Arial, "Heebo", sans-serif`;
  const y = lineH / 2 + 2;
  if (right) {
    ctx.textAlign = "right";
    ctx.fillText(right, width - 2, y);
  }
  if (left) {
    ctx.textAlign = "left";
    ctx.fillText(left, 2, y);
  }
  return _canvasToCroppedMono(canvas, width, false);
}

// Growing Uint8Array buffer. Faster than number[] + push(...) for large payloads.
class ByteBuf {
  buf: Uint8Array;
  len: number;
  constructor(cap = 4096) { this.buf = new Uint8Array(cap); this.len = 0; }
  private grow(min: number) {
    let cap = this.buf.length;
    while (cap < min) cap *= 2;
    const nb = new Uint8Array(cap);
    nb.set(this.buf.subarray(0, this.len));
    this.buf = nb;
  }
  pushByte(b: number) {
    if (this.len + 1 > this.buf.length) this.grow(this.len + 1);
    this.buf[this.len++] = b;
  }
  pushArr(a: ArrayLike<number>) {
    const n = a.length;
    if (this.len + n > this.buf.length) this.grow(this.len + n);
    for (let i = 0; i < n; i++) this.buf[this.len++] = a[i] as number;
  }
  pushBytes(a: Uint8Array) {
    if (this.len + a.length > this.buf.length) this.grow(this.len + a.length);
    this.buf.set(a, this.len);
    this.len += a.length;
  }
  toUint8(): Uint8Array { return this.buf.subarray(0, this.len); }
}

type Mono = { bytes: Uint8Array; widthBytes: number; height: number; offsetX: number };

// Combine several per-line monos into one full-width bitmap so the whole block
// is sent as ONE GS v 0 raster command instead of N separate commands.
// offsetX from each mono is honoured by placing it at the right byte offset
// (offsetX is always a multiple of 8 because both paper width and crop width
// are 8-aligned). Visually identical to emitting each line separately.
function _combineMonos(monos: Mono[], paperWidth: number): Mono {
  const widthBytes = paperWidth / 8;
  let totalH = 0;
  for (const m of monos) totalH += m.height;
  const out = new Uint8Array(widthBytes * totalH);
  let y = 0;
  for (const m of monos) {
    const byteOff = m.offsetX >> 3;
    for (let r = 0; r < m.height; r++) {
      out.set(
        m.bytes.subarray(r * m.widthBytes, (r + 1) * m.widthBytes),
        (y + r) * widthBytes + byteOff,
      );
    }
    y += m.height;
  }
  return { bytes: out, widthBytes, height: totalH, offsetX: 0 };
}

function _emitRasterInto(buf: ByteBuf, mono: Mono) {
  const { bytes, widthBytes, height } = mono;
  const ROWS = 255;
  for (let y = 0; y < height; y += ROWS) {
    const rows = Math.min(ROWS, height - y);
    buf.pushArr([GS, 0x76, 0x30, 0x00,
      widthBytes & 0xff, (widthBytes >> 8) & 0xff,
      rows & 0xff, (rows >> 8) & 0xff]);
    buf.pushBytes(bytes.subarray(y * widthBytes, (y + rows) * widthBytes));
  }
}

function _estimateRasterBytes(mono: Pick<Mono, "widthBytes" | "height">): number {
  let total = 0;
  const ROWS = 255;
  for (let y = 0; y < mono.height; y += ROWS) {
    const rows = Math.min(ROWS, mono.height - y);
    total += 8 + rows * mono.widthBytes;
  }
  return total;
}

function _emitNarrowRasterInto(buf: ByteBuf, mono: Mono) {
  const offsetDots = Math.max(0, Math.floor(mono.offsetX / 8) * 8);
  buf.pushArr([ESC, 0x24, offsetDots & 0xff, (offsetDots >> 8) & 0xff]);
  _emitRasterInto(buf, mono);
}

export async function printOps(ops: FastOp[]): Promise<void> {
  const char = await ensureConnected();
  const width = getPaperWidthDots();
  const buf = new ByteBuf(8192);
  // Reset + Hebrew code page (CP862 = 15) + right-align (RTL)
  buf.pushArr([ESC, 0x40]);
  buf.pushArr([ESC, 0x74, 0x0F]);
  buf.pushArr([ESC, 0x61, 0x02]);

  // Approximate native-font column width: default font ≈ 12 dots per char @ size 1.
  const cols = Math.max(16, Math.min(48, Math.floor(width / 12)));

  // Always combine pending monos into one full-width raster — safest across
  // printer firmwares (some don't honor ESC $ before GS v 0 and print garbage).
  let pending: Mono[] = [];
  const flush = () => {
    if (pending.length === 0) return;
    buf.pushArr(_align("L"));
    _emitRasterInto(buf, _combineMonos(pending, width));
    pending = [];
  };


  for (const op of ops) {
    switch (op.kind) {
      case "init":
        flush();
        buf.pushArr(CMD_INIT);
        break;
      case "sep":
        flush();
        buf.pushArr(_align("L")); buf.pushArr(_size(1)); buf.pushArr(_bold(false));
        for (let i = 0; i < cols; i++) buf.pushByte(0x2d);
        buf.pushByte(0x0a);
        break;
      case "feed":
        flush();
        for (let i = 0; i < Math.max(1, op.n); i++) buf.pushByte(0x0a);
        break;
      case "text": {
        flush();
        buf.pushArr(_align(op.align ?? "L")); buf.pushArr(_size(op.size ?? 1)); buf.pushArr(_bold(!!op.bold));
        for (const c of op.text) {
          const code = c.charCodeAt(0);
          buf.pushByte(code >= 0x20 && code < 0x80 ? code : 0x3f);
        }
        buf.pushByte(0x0a);
        break;
      }
      case "heb": {
        pending.push(_renderHebToMono(op.text, {
          width,
          px: op.size ?? 22,
          bold: !!op.bold,
          align: op.align ?? "R",
        }));
        break;
      }
      case "header": {
        pending.push(_renderHeaderToMono(
          op.name, op.phone, op.namePx ?? 32, op.phonePx ?? 18, width,
        ));
        break;
      }
      case "twoCol": {
        pending.push(_renderTwoColToMono(op.right, op.left, op.size ?? 20, !!op.bold, width));
        break;
      }
      case "cut":
        flush();
        buf.pushArr([ESC, 0x64, 2]);
        buf.pushArr(CMD_CUT);
        break;
    }
  }
  flush();
  await writeBytes(char, buf.toUint8());
}

// ---- Public printing API — now backed by the fast hybrid pipeline ----

// Lazy import to avoid the circular-import warning (btReceiptOps imports types
// from this module).
async function _ops() {
  return await import("./btReceiptOps");
}

export async function printBluetoothReceipt(order: ReceiptOrder): Promise<void> {
  const { buildKitchenBonOps } = await _ops();
  await printOps(buildKitchenBonOps(order));
}

export async function printBluetoothRoundSummary(orders: RoundOrder[]): Promise<void> {
  const { buildRoundSummaryOps } = await _ops();
  await printOps(buildRoundSummaryOps(orders));
}

export async function printBluetoothRoundChef(orders: RoundOrder[]): Promise<void> {
  const { buildRoundChefOps } = await _ops();
  await printOps(buildRoundChefOps(orders));
}

export async function printTest(): Promise<void> {
  const { buildTestOps } = await _ops();
  await printOps(buildTestOps());
}

export async function printHybridDiagnostic(): Promise<void> {
  await printOps([
    { kind: "text", text: "HYBRID MODE", align: "C", size: 1, bold: true },
    { kind: "sep" },
    { kind: "heb", text: "הבקתה", align: "C", size: 32, bold: true },
    { kind: "heb", text: "שלום מהבקתה", align: "R", size: 26, bold: true },
    { kind: "heb", text: "בדיקת עברית 123", align: "R", size: 22 },
    { kind: "sep" },
    { kind: "text", text: `${getPaperWidthDots()} dots`, align: "C", size: 1 },
    { kind: "feed", n: 2 },
    { kind: "cut" },
  ]);
}

// Legacy slow path kept for diagnostics — prints full HTML via raster.
// Not used by default anymore. Exported so callers that explicitly want the
// pixel-perfect HTML rendering can still reach for it.
export async function printHtmlBluetoothSlow(html: string): Promise<void> {
  const widthDots = getPaperWidthDots();
  const char = await ensureConnected();
  const canvas = await renderHtmlToCanvas(html, widthDots);
  const mono = canvasToMonoBytes(canvas, widthDots);
  const bytes = buildRasterCommands(mono);
  await writeBytes(char, bytes);
}


// Encoding cycle test — kept as a non-Hebrew diagnostic only. Hebrew text-mode
// is disabled because this printer prints CP862/CP1255 bytes as gibberish.
export async function printTestCycle(): Promise<void> {
  await printHybridDiagnostic();
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
