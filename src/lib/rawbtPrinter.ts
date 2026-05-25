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

// Loads a URI in the hidden iframe. Android Chrome / Fully Kiosk will
// resolve registered scheme handlers (rawbt:, intent:) to the appropriate
// app without navigating the host page away.
// Uses ACTION_SEND/text/plain → RawBT ShareActivity (the T3 path the user
// confirmed works on this device). The payload is sent as the text extra in
// RawBT's documented "base64,<...>" format, which ShareActivity decodes to
// raw ESC/POS bytes. Enable "Background print" / "Silent" in RawBT settings
// to avoid the RawBT window appearing on each print.
export function sendBytesToRawBT(bytes: Uint8Array): RawBTDebugInfo {
  if (!bytes || bytes.length === 0) {
    console.error("[RawBT] refusing to send empty payload");
    return {
      bytesLen: 0,
      b64Len: 0,
      urlPreview: "",
      transport: "ACTION_SEND/base64",
      status: "error",
      error: "empty payload",
      at: new Date().toISOString(),
    };
  }
  const b64 = bytesToBase64(bytes);
  const text = "base64," + b64;
  const encoded = encodeURIComponent(text);
  const uri =
    "intent://send/#Intent;" +
    "action=android.intent.action.SEND;" +
    "type=text/plain;" +
    "package=ru.a402d.rawbtprinter;" +
    "S.android.intent.extra.TEXT=" + encoded + ";end";

  console.log("[RawBT] transport: ACTION_SEND/text → RawBT (base64 payload)", {
    bytesLen: bytes.length,
    b64Len: b64.length,
    urlPreview: uri.slice(0, 160),
    urlLen: uri.length,
  });

  try {
    sendViaIframe(uri);
    return {
      bytesLen: bytes.length,
      b64Len: b64.length,
      urlPreview: uri.slice(0, 100),
      transport: "ACTION_SEND/base64",
      status: "sent",
      at: new Date().toISOString(),
    };
  } catch (e: any) {
    return {
      bytesLen: bytes.length,
      b64Len: b64.length,
      urlPreview: uri.slice(0, 100),
      transport: "ACTION_SEND/base64",
      status: "error",
      error: String(e?.message ?? e),
      at: new Date().toISOString(),
    };
  }
}

// ---- Public print helpers (mirror bluetoothPrinter.ts API) ----

export async function printRawBTReceipt(
  order: ReceiptOrder,
): Promise<RawBTDebugInfo> {
  const { buildKitchenBonOps } = await import("./btReceiptOps");
  const info = sendBytesToRawBT(buildOpsBytes(buildKitchenBonOps(order)));
  info.orderNumber = (order as any).order_number;
  return info;
}

export async function printRawBTRoundSummary(
  orders: RoundOrder[],
): Promise<RawBTDebugInfo> {
  const { buildRoundSummaryOps } = await import("./btReceiptOps");
  return sendBytesToRawBT(buildOpsBytes(buildRoundSummaryOps(orders)));
}

export async function printRawBTRoundChef(
  orders: RoundOrder[],
): Promise<RawBTDebugInfo> {
  const { buildRoundChefOps } = await import("./btReceiptOps");
  return sendBytesToRawBT(buildOpsBytes(buildRoundChefOps(orders)));
}

export async function printRawBTTest(): Promise<RawBTDebugInfo> {
  const { buildTestOps } = await import("./btReceiptOps");
  return sendBytesToRawBT(buildOpsBytes(buildTestOps()));
}

// ---- Diagnostics ----

export interface RawBTDebugInfo {
  bytesLen: number;
  b64Len: number;
  urlPreview: string;
  transport: string;
  status?: "sent" | "error";
  error?: string;
  at?: string;
  orderNumber?: number;
}

// Test #1: ASCII text + ESC/POS (init + text + cut), wrapped as base64 and
// sent via the same `rawbt:base64,...` path used by real receipts. If this
// prints but real receipts don't → bug is in raster/CP862 generation.
// If this ALSO leaves PRINT grey → the rawbt: scheme itself isn't being
// resolved (RawBT not installed as scheme handler, or Fully blocking it).
export function printRawBTPlainText(text: string): RawBTDebugInfo {
  const ascii = new TextEncoder().encode(text + "\n\n\n\n");
  const bytes = new Uint8Array(2 + ascii.length + 3);
  bytes[0] = 0x1b; bytes[1] = 0x40;                     // ESC @ init
  bytes.set(ascii, 2);
  bytes[2 + ascii.length] = 0x1d;                       // GS
  bytes[2 + ascii.length + 1] = 0x56;                   // V
  bytes[2 + ascii.length + 2] = 0x00;                   // 0 — full cut

  const b64 = bytesToBase64(bytes);
  const uri = "rawbt:base64," + b64;

  console.log("[RawBT] test #1: rawbt:base64,<escpos-ascii>", {
    bytesLen: bytes.length,
    b64Len: b64.length,
    urlPreview: uri.slice(0, 120),
  });

  sendViaIframe(uri);

  return {
    bytesLen: bytes.length,
    b64Len: b64.length,
    urlPreview: uri.slice(0, 100),
    transport: "rawbt:base64",
  };
}

// Test #2: bypass base64 entirely. RawBT's URI parser also accepts plain
// text after the scheme: `rawbt:<utf8-text>`. No ESC/POS, no encoding.
// This is the simplest possible payload — if PRINT activates here, the
// rawbt: scheme works and the issue is purely in how we build the binary
// payload. If PRINT still stays grey, RawBT isn't receiving any data via
// the rawbt: scheme on this device (try ACTION_SEND fallback below).
export function printRawBTPlainTextDirect(text: string): RawBTDebugInfo {
  const uri = "rawbt:" + encodeURIComponent(text);

  console.log("[RawBT] test #2: rawbt:<plain text> (no base64)", {
    textLen: text.length,
    urlPreview: uri.slice(0, 120),
  });

  sendViaIframe(uri);

  return {
    bytesLen: text.length,
    b64Len: 0,
    urlPreview: uri.slice(0, 100),
    transport: "rawbt:plain",
  };
}

// Test #3: ACTION_SEND share intent with type=text/plain targeted at RawBT.
// This is a completely different code path inside RawBT (ShareActivity vs
// MainActivity). If tests #1 and #2 fail but this one works, the rawbt:
// scheme isn't registered on this RawBT build — we'd switch the main
// transport to this share-intent format.
export function printRawBTPlainTextShare(text: string): RawBTDebugInfo {
  const encoded = encodeURIComponent(text);
  const uri =
    "intent://send/#Intent;" +
    "action=android.intent.action.SEND;" +
    "type=text/plain;" +
    "package=ru.a402d.rawbtprinter;" +
    "S.android.intent.extra.TEXT=" + encoded + ";end";

  console.log("[RawBT] test #3: ACTION_SEND text/plain → RawBT", {
    textLen: text.length,
    urlPreview: uri.slice(0, 160),
  });

  sendViaIframe(uri);

  return {
    bytesLen: text.length,
    b64Len: 0,
    urlPreview: uri.slice(0, 100),
    transport: "ACTION_SEND/text",
  };
}

// Paper width is shared with the BT driver via getPaperWidthDots(), so the
// receipt layout is identical regardless of which transport is used.
export { getPaperWidthDots };
