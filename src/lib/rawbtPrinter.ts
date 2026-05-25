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

// Open a RawBT intent: URL. Uses the Android Intent scheme so Chrome on
// Android hands the payload off to RawBT without any visible UI.
export function sendBytesToRawBT(bytes: Uint8Array): void {
  const b64 = bytesToBase64(bytes);
  // RawBT accepts both `rawbt:base64,<b64>` and a full intent URL. The intent
  // form is the most reliable across Chrome versions on Android.
  const url =
    "intent:base64," +
    encodeURIComponent(b64) +
    "#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;";
  // Navigating top.location keeps it silent (no popup blocker, no new tab).
  // Chrome on Android resolves the intent: URL to RawBT and returns to the
  // current page when done.
  window.location.href = url;
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
