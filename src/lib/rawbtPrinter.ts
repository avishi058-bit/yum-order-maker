// RawBT bridge — sends ESC/POS bytes to the RawBT Android app
// (package: ru.a402d.rawbtprinter), which forwards them to the paired
// Bluetooth printer. Used on the kitchen tablet when window.print() / Web
// Bluetooth are not desired.
//
// Flow: build the same ESC/POS bytes used by the in-app Web Bluetooth driver
// (via buildOpsBytes), base64-encode them, and open an Android intent: URL.
// RawBT registers as the handler for the "rawbt" scheme and prints the
// payload as raw bytes — no UI, no print dialog.

import {
  buildOpsBytes,
  getPaperWidthDots,
} from "./bluetoothPrinter";
import type { ReceiptOrder, RoundOrder } from "./kitchenReceipt";


const MODE_KEY = "kitchen-print-mode"; // "rawbt" | "bt" | "browser"
export type PrintMode = "rawbt" | "bt" | "browser";

export function getPrintMode(): PrintMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === "rawbt" || v === "bt" || v === "browser") return v;
  } catch {}
  return "bt";
}

export function setPrintMode(mode: PrintMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    console.error("Failed to save print mode");
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  // chunked to avoid call-stack overflow on large rasters
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + CHUNK) as unknown as number[],
    );
  }
  return btoa(bin);
}

// Silent / background RawBT printing.
//
// Strategy (in priority order):
//   1. Fully Kiosk Browser exposes window.fully with broadcastIntent() —
//      we send RawBT's broadcast action which the app handles in the
//      background (no UI, no app switch, no return-to-browser flicker).
//      This is the recommended mode for the kitchen tablet.
//   2. Fallback to a hidden iframe loading an intent: URL. The iframe keeps
//      the main page from navigating away. RawBT must be configured with
//      "Background print" / "Silent" enabled in its settings for this to
//      avoid showing its UI.
//
// RawBT broadcast contract:
//   action: ru.a402d.rawbtprinter.action.PRINT_RAWBT
//   extra : msg = "base64,<payload>"  (string)
declare global {
  interface Window {
    fully?: {
      broadcastIntent?: (action: string, extras?: string) => void;
      startIntent?: (url: string) => void;
    };
  }
}

const RAWBT_BROADCAST_ACTION = "ru.a402d.rawbtprinter.action.PRINT_RAWBT";

function sendViaIframe(intentUrl: string): void {
  let iframe = document.getElementById(
    "rawbt-bridge",
  ) as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "rawbt-bridge";
    iframe.style.display = "none";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);
  }
  iframe.src = intentUrl;
}

export function sendBytesToRawBT(bytes: Uint8Array): void {
  if (!bytes || bytes.length === 0) {
    console.error("[RawBT] refusing to send empty payload");
    return;
  }
  const b64 = bytesToBase64(bytes);
  const dataPart = "base64," + b64;

  // FORCED transport: iframe-intent only. Fully broadcastIntent is unreliable
  // on this tablet — skip auto-detect entirely. RawBT must have
  // "Background print" / "Silent" enabled in its settings.
  const intentUrl =
    "intent:" +
    dataPart +
    "#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end";

  console.log("[RawBT] transport forced: iframe-intent", {
    bytesLen: bytes.length,
    b64Len: b64.length,
    urlPreview: intentUrl.slice(0, 120) + (intentUrl.length > 120 ? "…" : ""),
    urlLen: intentUrl.length,
  });

  sendViaIframe(intentUrl);
}

// ---- Public print helpers (mirror bluetoothPrinter.ts API) ----

export async function printRawBTReceipt(order: ReceiptOrder): Promise<void> {
  const { buildKitchenBonOps } = await import("./btReceiptOps");
  sendBytesToRawBT(buildOpsBytes(buildKitchenBonOps(order)));
}

export async function printRawBTRoundSummary(
  orders: RoundOrder[],
): Promise<void> {
  const { buildRoundSummaryOps } = await import("./btReceiptOps");
  sendBytesToRawBT(buildOpsBytes(buildRoundSummaryOps(orders)));
}

export async function printRawBTRoundChef(
  orders: RoundOrder[],
): Promise<void> {
  const { buildRoundChefOps } = await import("./btReceiptOps");
  sendBytesToRawBT(buildOpsBytes(buildRoundChefOps(orders)));
}

export async function printRawBTTest(): Promise<void> {
  const { buildTestOps } = await import("./btReceiptOps");
  sendBytesToRawBT(buildOpsBytes(buildTestOps()));
}

// Diagnostic: send a plain ASCII string + LF + cut. No CP862/CP1255, no
// raster, no Hebrew. If this prints but real receipts don't, the bug is in
// buildOpsBytes / ESC-POS. If this also fails, the bug is in the RawBT
// intent URL or RawBT app settings.
export interface RawBTDebugInfo {
  bytesLen: number;
  b64Len: number;
  urlPreview: string;
  transport: "fully-broadcast" | "iframe-intent";
}

export function printRawBTPlainText(text: string): RawBTDebugInfo {
  const ascii = new TextEncoder().encode(text + "\n\n\n\n");
  const bytes = new Uint8Array(2 + ascii.length + 3);
  bytes[0] = 0x1b; bytes[1] = 0x40; // ESC @ init
  bytes.set(ascii, 2);
  bytes[2 + ascii.length] = 0x1d;     // GS
  bytes[2 + ascii.length + 1] = 0x56; // V
  bytes[2 + ascii.length + 2] = 0x00; // 0 — full cut

  const b64 = bytesToBase64(bytes);
  const intentUrl =
    "intent:base64," + b64 +
    "#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end";
  const fully = window.fully;
  const transport: RawBTDebugInfo["transport"] =
    fully && typeof fully.broadcastIntent === "function"
      ? "fully-broadcast"
      : "iframe-intent";

  sendBytesToRawBT(bytes);

  return {
    bytesLen: bytes.length,
    b64Len: b64.length,
    urlPreview: intentUrl.slice(0, 100),
    transport,
  };
}

// Paper width is shared with the BT driver via getPaperWidthDots(), so the
// receipt layout is identical regardless of which transport is used.
export { getPaperWidthDots };
