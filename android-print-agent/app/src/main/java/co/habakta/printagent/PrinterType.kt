package co.habakta.printagent

/**
 * Which command dialect the connected printer speaks.
 *
 * - [Generic]: ESC/POS thermal printers such as the existing Xprinter
 *   "Printer001-352C". Bytes from the website are passed to the printer
 *   as-is. This is the original — unchanged — behavior.
 * - [StarLineMode]: Star Micronics mC-Print3 (MCP31LB) in Star Line Mode.
 *   Bytes from the website (ESC/POS raster) are translated by
 *   [EscPosToStar] before being written to the socket.
 */
enum class PrinterType {
    Generic,
    StarLineMode;

    val label: String
        get() = when (this) {
            Generic -> "ESC/POS (Generic)"
            StarLineMode -> "Star Line Mode (mC-Print3)"
        }
}

/**
 * A printer we know how to auto-connect to. The first bonded Bluetooth
 * device whose name matches [namePrefix] wins — matching is case-insensitive
 * and prefix-based so serial suffixes (e.g. "Printer001-352C") are ignored.
 */
data class KnownPrinter(
    val namePrefix: String,
    val type: PrinterType,
)
