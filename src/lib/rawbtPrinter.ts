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
  const b64 = bytesToBase64(bytes);
  const payload = "base64," + b64;

  // 1) Fully Kiosk Browser — true background print, no UI switch.
  const fully = window.fully;
  if (fully && typeof fully.broadcastIntent === "function") {
    try {
      // extras format used by Fully Kiosk: "key=value"
      fully.broadcastIntent(RAWBT_BROADCAST_ACTION, "msg=" + payload);
      return;
    } catch (e) {
      console.warn("Fully broadcastIntent failed, falling back to iframe", e);
    }
  }

  // 2) Hidden-iframe intent URL. Keeps the main page from navigating.
  //    RawBT must have "Background print" enabled to stay silent.
  const intentUrl =
    "intent:" +
    encodeURIComponent(payload) +
    "#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;";
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

// Paper width is shared with the BT driver via getPaperWidthDots(), so the
// receipt layout is identical regardless of which transport is used.
export { getPaperWidthDots };
