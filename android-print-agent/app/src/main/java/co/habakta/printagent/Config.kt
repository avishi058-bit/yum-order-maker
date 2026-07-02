package co.habakta.printagent

/**
 * Tweak these values to match the kitchen tablet's printer.
 * After editing, rebuild and reinstall the APK.
 */
object Config {
    /** Exact Bluetooth device name as it appears in Android Settings → Bluetooth. */
    const val PRINTER_NAME = "Printer001-352C"

    /** Local HTTP port the website talks to (matches src/lib/localPrintAgent.ts). */
    const val HTTP_PORT = 9100

    /** Serial Port Profile UUID — standard for ESC/POS BT printers. */
    const val SPP_UUID = "00001101-0000-1000-8000-00805F9B34FB"

    const val VERSION = "1.0.0"
}
