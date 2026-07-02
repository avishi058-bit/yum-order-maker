package co.habakta.printagent

/**
 * Tweak these values to match the kitchen tablet's printer.
 * After editing, rebuild and reinstall the APK.
 */
object Config {
    /**
     * Legacy: the first printer we ever supported. Kept for backward
     * compatibility — [PRINTER_NAMES] is derived from it below.
     */
    const val PRINTER_NAME = "Printer001-352C"

    /**
     * Exact Bluetooth device names to look for among the paired devices,
     * in priority order. The first one that is currently bonded wins.
     * Add more entries here when a new physical printer joins the kitchen.
     *
     * Names must match Android Settings → Bluetooth → paired devices
     * character-for-character (case sensitive).
     */
    val PRINTER_NAMES: List<String> = listOf(
        PRINTER_NAME,          // legacy generic thermal printer
        "mC-Print3-D0011",     // Star Micronics mC-Print3 (MCP31LB) — kitchen
    )

    /**
     * Fallback prefixes. If no device from [PRINTER_NAMES] is currently
     * paired, we accept any bonded device whose name starts with one of
     * these. Lets us swap in an mC-Print3 unit with a different serial
     * suffix without editing the app.
     *
     * Star mC-Print3: "mC-Print3-XXXX"
     * Generic ESC/POS: "Printer001-XXXX"
     */
    val PRINTER_NAME_PREFIXES: List<String> = listOf(
        "mC-Print3",
        "Star",
        "Printer001",
    )

    /** Local HTTP port the website talks to (matches src/lib/localPrintAgent.ts). */
    const val HTTP_PORT = 9100

    /**
     * Serial Port Profile UUID — the standard SPP UUID used by both the
     * generic Printer001 units and the Star mC-Print3 (which exposes SPP
     * for its ESC/POS emulation mode over Bluetooth Classic).
     *
     * The mC-Print3 MCP31LB must have "Emulation" set to ESC/POS in the
     * Star Quick Setup Utility. In StarPRNT native mode the bytes we send
     * would not be interpreted correctly. (RawBT prints fine on this
     * unit, which confirms it's already configured for ESC/POS.)
     */
    const val SPP_UUID = "00001101-0000-1000-8000-00805F9B34FB"

    const val VERSION = "1.1.0"
}
