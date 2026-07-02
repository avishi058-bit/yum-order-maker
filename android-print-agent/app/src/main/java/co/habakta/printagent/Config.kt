package co.habakta.printagent

/**
 * Tweak these values to match the kitchen tablet's printer.
 * After editing, rebuild and reinstall the APK.
 */
object Config {
    /**
     * Legacy default — the original Xprinter kept working exactly as before.
     * Used only as a fallback label when no bonded device matches
     * [KNOWN_PRINTERS] below.
     */
    const val PRINTER_NAME = "Printer001-352C"

    /**
     * Auto-detection table. On startup the agent scans bonded Bluetooth
     * devices and connects to the first one whose name starts with one of
     * these prefixes (case-insensitive). The matching entry's [PrinterType]
     * decides which command dialect the HTTP layer speaks.
     *
     * Existing Xprinter setups are unaffected — the "Printer" prefix keeps
     * matching "Printer001-352C" and stays on the [PrinterType.Generic]
     * ESC/POS path.
     */
    val KNOWN_PRINTERS: List<KnownPrinter> = listOf(
        // Star Micronics mC-Print3 — Bluetooth Classic (SPP). Both the
        // "STAR" and "mC-Print3" spellings appear on different firmwares.
        KnownPrinter(namePrefix = "mC-Print3", type = PrinterType.StarLineMode),
        KnownPrinter(namePrefix = "MCP31",    type = PrinterType.StarLineMode),
        KnownPrinter(namePrefix = "STAR",     type = PrinterType.StarLineMode),
        // Original Xprinter / generic ESC/POS thermal printers.
        KnownPrinter(namePrefix = "Printer",  type = PrinterType.Generic),
    )

    /** Local HTTP port the website talks to (matches src/lib/localPrintAgent.ts). */
    const val HTTP_PORT = 9100

    /** Serial Port Profile UUID — standard for ESC/POS + Star SPP BT printers. */
    const val SPP_UUID = "00001101-0000-1000-8000-00805F9B34FB"

    const val VERSION = "1.1.0"
}
