// Local Print Agent client — talks to a tiny Android companion app running
// on the same tablet at http://127.0.0.1:9100. The agent holds an open
// Bluetooth connection to the receipt printer and writes raw ESC/POS bytes
// directly — no RawBT, no Fully intent, no app switching.
//
// The agent source lives in /android-print-agent (Kotlin, NanoHTTPD).
// Build once in Android Studio, install the APK on the kitchen tablet, and
// the website talks to it over localhost.
//
// Endpoints (see android-print-agent/README.md for the full contract):
//   GET  /health          → { ok, printer, connected, version }
//   POST /print-raw       → { b64: "<base64-escpos>" }  →  prints bytes as-is
//
// We send the SAME ESC/POS bytes the in-app Web Bluetooth driver produces
// (via buildOpsBytes), so the receipt layout is identical across transports
// and Hebrew rendering (as raster) keeps working without any code changes
// on the Android side.

import { buildOpsBytes } from "./bluetoothPrinter";
import type { ReceiptOrder, RoundOrder } from "./kitchenReceipt";

const AGENT_BASE = "http://127.0.0.1:9100";
const HEALTH_TIMEOUT_MS = 1500;
const PRINT_TIMEOUT_MS = 8000;

export interface AgentHealth {
  ok: boolean;
  reachable: boolean;
  printer?: string;
  connected?: boolean;
  version?: string;
  error?: string;
  at: string;
}

export interface AgentPrintResult {
  status: "sent" | "error";
  transport: "local-agent";
  bytesLen: number;
  error?: string;
  at: string;
  orderNumber?: number;
}

function bytesToBase64(bytes: Uint8Array): string {
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

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

export async function checkAgentHealth(): Promise<AgentHealth> {
  const at = new Date().toISOString();
  try {
    const res = await withTimeout(
      fetch(`${AGENT_BASE}/health`, { method: "GET", cache: "no-store" }),
      HEALTH_TIMEOUT_MS,
      "agent health",
    );
    if (!res.ok) {
      return { ok: false, reachable: true, error: `HTTP ${res.status}`, at };
    }
    const json = await res.json();
    return {
      ok: !!json.ok && !!json.connected,
      reachable: true,
      printer: json.printer,
      connected: !!json.connected,
      version: json.version,
      at,
    };
  } catch (e: any) {
    return { ok: false, reachable: false, error: String(e?.message ?? e), at };
  }
}

export async function sendBytesToAgent(bytes: Uint8Array): Promise<AgentPrintResult> {
  const at = new Date().toISOString();
  if (!bytes || bytes.length === 0) {
    return { status: "error", transport: "local-agent", bytesLen: 0, error: "empty payload", at };
  }
  try {
    const b64 = bytesToBase64(bytes);
    const res = await withTimeout(
      fetch(`${AGENT_BASE}/print-raw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ b64 }),
      }),
      PRINT_TIMEOUT_MS,
      "agent print",
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        status: "error",
        transport: "local-agent",
        bytesLen: bytes.length,
        error: `HTTP ${res.status} ${text}`.trim(),
        at,
      };
    }
    console.log("[Agent] print sent", { bytesLen: bytes.length });
    return { status: "sent", transport: "local-agent", bytesLen: bytes.length, at };
  } catch (e: any) {
    return {
      status: "error",
      transport: "local-agent",
      bytesLen: bytes.length,
      error: String(e?.message ?? e),
      at,
    };
  }
}

// ---- High-level helpers (mirror rawbtPrinter API) ----

export async function printAgentReceipt(order: ReceiptOrder): Promise<AgentPrintResult> {
  const { buildKitchenBonOps } = await import("./btReceiptOps");
  const result = await sendBytesToAgent(buildOpsBytes(buildKitchenBonOps(order)));
  result.orderNumber = (order as any).order_number;
  return result;
}

export async function printAgentRoundSummary(orders: RoundOrder[]): Promise<AgentPrintResult> {
  const { buildRoundSummaryOps } = await import("./btReceiptOps");
  return sendBytesToAgent(buildOpsBytes(buildRoundSummaryOps(orders)));
}

export async function printAgentRoundChef(orders: RoundOrder[]): Promise<AgentPrintResult> {
  const { buildRoundChefOps } = await import("./btReceiptOps");
  return sendBytesToAgent(buildOpsBytes(buildRoundChefOps(orders)));
}

export async function printAgentFridgeRefill(items: { name: string; needed: number }[]): Promise<AgentPrintResult> {
  const { buildFridgeRefillOps } = await import("./btReceiptOps");
  return sendBytesToAgent(buildOpsBytes(buildFridgeRefillOps(items)));
}

export async function printAgentPhoneQr(order: ReceiptOrder): Promise<AgentPrintResult> {
  const { buildPhoneQrOps } = await import("./btReceiptOps");
  const result = await sendBytesToAgent(buildOpsBytes(buildPhoneQrOps(order)));
  result.orderNumber = (order as any).order_number;
  return result;
}

export async function printAgentTest(): Promise<AgentPrintResult> {
  const { buildTestOps } = await import("./btReceiptOps");
  return sendBytesToAgent(buildOpsBytes(buildTestOps()));
}
