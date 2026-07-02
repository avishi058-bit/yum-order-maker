package co.habakta.printagent

import java.io.ByteArrayOutputStream

/**
 * Translates the ESC/POS byte stream produced by the website's Web
 * Bluetooth driver (see `src/lib/bluetoothPrinter.ts` → `buildOpsBytes`)
 * into Star Line Mode commands understood by the Star Micronics
 * mC-Print3 (MCP31LB).
 *
 * The website's payload is almost entirely a single big `GS v 0` raster
 * bitmap (Hebrew text is rasterized on the client), plus a handful of
 * control commands: init, align, bold, feed, cut. We map each one to
 * its Star Line Mode equivalent and rewrite the raster block using
 * Star's `ESC * r A ... b n1 n2 <row> ... ESC * r B` sequence.
 *
 * Command references:
 *   Star Line Mode manual (mC-Print3):
 *   https://star-emea.com/manuals/mcp31l/StarLineMode_CM_en.pdf
 *
 *   Init                ESC @              1B 40
 *   Align               ESC GS a n         1B 1D 61 n     (n = 0/1/2)
 *   Bold on             ESC E              1B 45
 *   Bold off            ESC F              1B 46
 *   Feed n lines        ESC d n            1B 64 n
 *   Enter raster mode   ESC * r A          1B 2A 72 41
 *   Reset raster        ESC * r R          1B 2A 72 52
 *   Raster row          b n1 n2 <data>     62 n1 n2 …
 *   Exit raster mode    ESC * r B          1B 2A 72 42
 *   Cut (partial+feed)  ESC d 3            1B 64 03
 */
object EscPosToStar {

    private val RASTER_ENTER = byteArrayOf(0x1B, 0x2A, 0x72, 0x41)
    private val RASTER_RESET = byteArrayOf(0x1B, 0x2A, 0x72, 0x52)
    private val RASTER_EXIT  = byteArrayOf(0x1B, 0x2A, 0x72, 0x42)
    private val STAR_CUT     = byteArrayOf(0x1B, 0x64, 0x03)

    fun translate(input: ByteArray): ByteArray {
        val out = ByteArrayOutputStream(input.size + 128)
        // Always start clean — safe on both ESC/POS-emulation and Star Line Mode.
        out.write(0x1B); out.write(0x40)

        var i = 0
        var inRaster = false

        fun closeRaster() {
            if (inRaster) {
                out.write(RASTER_EXIT, 0, RASTER_EXIT.size)
                inRaster = false
            }
        }

        while (i < input.size) {
            val b = input[i].toInt() and 0xFF

            // -------- ESC (0x1B) sequences --------
            if (b == 0x1B && i + 1 < input.size) {
                val n = input[i + 1].toInt() and 0xFF
                when (n) {
                    0x40 -> { // ESC @  — init
                        closeRaster()
                        out.write(0x1B); out.write(0x40)
                        i += 2
                    }
                    0x61 -> { // ESC a n — align
                        if (i + 2 < input.size) {
                            val a = input[i + 2].toInt() and 0xFF
                            closeRaster()
                            out.write(0x1B); out.write(0x1D); out.write(0x61); out.write(a)
                            i += 3
                        } else i = input.size
                    }
                    0x45 -> { // ESC E n — bold on/off
                        if (i + 2 < input.size) {
                            val v = input[i + 2].toInt() and 0xFF
                            out.write(0x1B); out.write(if (v != 0) 0x45 else 0x46)
                            i += 3
                        } else i = input.size
                    }
                    0x64 -> { // ESC d n — feed n lines (same on Star)
                        if (i + 2 < input.size) {
                            closeRaster()
                            out.write(0x1B); out.write(0x64); out.write(input[i + 2].toInt() and 0xFF)
                            i += 3
                        } else i = input.size
                    }
                    0x74, 0x52 -> { // ESC t n / ESC R n — code-page / intl charset. Not used by Star raster path.
                        i += 3
                    }
                    0x33 -> { // ESC 3 n — line spacing (n dots). Supported on Star, pass through.
                        if (i + 2 < input.size) {
                            out.write(0x1B); out.write(0x33); out.write(input[i + 2].toInt() and 0xFF)
                            i += 3
                        } else i = input.size
                    }
                    0x32 -> { // ESC 2 — default line spacing
                        out.write(0x1B); out.write(0x32)
                        i += 2
                    }
                    else -> { // Unknown ESC verb — skip verb byte and continue.
                        i += 2
                    }
                }
                continue
            }

            // -------- GS (0x1D) sequences --------
            if (b == 0x1D && i + 1 < input.size) {
                val n = input[i + 1].toInt() and 0xFF
                when (n) {
                    0x21 -> { // GS ! n — text size. Most on-receipt text is rasterized, so drop.
                        i += 3
                    }
                    0x56 -> { // GS V — cut → Star ESC d 3
                        if (i + 2 < input.size) {
                            val m = input[i + 2].toInt() and 0xFF
                            val skip = if (m == 0x41 || m == 0x42 || m == 0x61 || m == 0x62) 4 else 3
                            closeRaster()
                            out.write(STAR_CUT, 0, STAR_CUT.size)
                            i += skip
                        } else i = input.size
                    }
                    0x76 -> { // GS v 0 m xL xH yL yH [data] — raster bit image
                        if (i + 7 < input.size && (input[i + 2].toInt() and 0xFF) == 0x30) {
                            val xL = input[i + 4].toInt() and 0xFF
                            val xH = input[i + 5].toInt() and 0xFF
                            val yL = input[i + 6].toInt() and 0xFF
                            val yH = input[i + 7].toInt() and 0xFF
                            val widthBytes = xL or (xH shl 8)
                            val height = yL or (yH shl 8)
                            val dataStart = i + 8
                            val dataLen = widthBytes * height
                            if (widthBytes > 0 && height > 0 && dataStart + dataLen <= input.size) {
                                if (!inRaster) {
                                    out.write(RASTER_ENTER, 0, RASTER_ENTER.size)
                                    out.write(RASTER_RESET, 0, RASTER_RESET.size)
                                    inRaster = true
                                }
                                val n1 = widthBytes and 0xFF
                                val n2 = (widthBytes shr 8) and 0xFF
                                for (row in 0 until height) {
                                    out.write(0x62) // 'b' — raster row
                                    out.write(n1)
                                    out.write(n2)
                                    out.write(input, dataStart + row * widthBytes, widthBytes)
                                }
                                i = dataStart + dataLen
                            } else {
                                i = input.size
                            }
                        } else {
                            i += 2
                        }
                    }
                    else -> i += 2
                }
                continue
            }

            // -------- plain byte (LF, printable ASCII, etc.) --------
            out.write(b)
            i++
        }

        closeRaster()
        return out.toByteArray()
    }
}
