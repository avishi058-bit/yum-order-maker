package co.habakta.printagent

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.util.Log
import java.io.OutputStream
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicReference

/**
 * Keeps one open Bluetooth SPP connection to a paired receipt printer.
 *
 * Supports both:
 *  - The original Xprinter / generic ESC/POS printer (unchanged behavior).
 *  - Star Micronics mC-Print3 (MCP31LB) in Star Line Mode.
 *
 * The concrete printer is chosen by matching bonded device names against
 * [Config.KNOWN_PRINTERS] — the first match wins. The matching entry's
 * [PrinterType] is exposed via [printerType] so the HTTP layer knows
 * whether to pass ESC/POS bytes through or translate them to Star Line
 * Mode via [EscPosToStar].
 *
 * Thread-safe: callers from the HTTP server can invoke [writeBytes]
 * from any thread.
 */
class BluetoothPrinterClient(private val ctx: Context) {

    private val socketRef = AtomicReference<BluetoothSocket?>(null)
    private val executor = Executors.newSingleThreadExecutor()
    @Volatile private var shuttingDown = false
    @Volatile private var lastError: String? = null
    @Volatile private var connectedName: String = Config.PRINTER_NAME
    @Volatile private var connectedType: PrinterType = PrinterType.Generic

    fun startAutoConnect() {
        executor.submit { reconnectLoop() }
    }

    fun shutdown() {
        shuttingDown = true
        closeSocket()
        executor.shutdownNow()
    }

    fun isConnected(): Boolean = socketRef.get()?.isConnected == true

    fun printerName(): String = connectedName

    fun printerType(): PrinterType = connectedType

    fun lastErrorMessage(): String? = lastError

    /**
     * Write raw bytes to the printer. The HTTP layer is responsible for
     * translating bytes to the correct dialect (see [printerType]) — this
     * function is transport-only.
     *
     * Blocks until written or fails. Throws on error so the HTTP layer
     * can return 502.
     */
    @Synchronized
    fun writeBytes(bytes: ByteArray) {
        val sock = socketRef.get() ?: run {
            connectOnce()
            socketRef.get()
        } ?: throw IllegalStateException("printer not connected")

        try {
            val out: OutputStream = sock.outputStream
            out.write(bytes)
            out.flush()
        } catch (e: Exception) {
            Log.w(TAG, "write failed, dropping socket", e)
            lastError = e.message
            closeSocket()
            connectOnce()
            val sock2 = socketRef.get()
                ?: throw IllegalStateException("printer reconnect failed: ${e.message}")
            val out2 = sock2.outputStream
            out2.write(bytes)
            out2.flush()
        }
    }

    // -------- internal --------

    private fun reconnectLoop() {
        while (!shuttingDown) {
            if (!isConnected()) {
                try { connectOnce() } catch (e: Exception) {
                    Log.w(TAG, "connect failed: ${e.message}")
                    lastError = e.message
                }
            }
            try { Thread.sleep(5_000) } catch (_: InterruptedException) { return }
        }
    }

    @SuppressLint("MissingPermission")
    private fun connectOnce() {
        val adapter = BluetoothAdapter.getDefaultAdapter()
            ?: throw IllegalStateException("no Bluetooth adapter")
        if (!adapter.isEnabled) throw IllegalStateException("Bluetooth is off")

        val bonded = adapter.bondedDevices ?: emptySet()

        // Find the first bonded device that matches any KNOWN_PRINTERS entry.
        // We iterate KNOWN_PRINTERS in declaration order so Star wins over
        // Generic when both are paired (deterministic behavior).
        var device: BluetoothDevice? = null
        var matched: KnownPrinter? = null
        outer@ for (known in Config.KNOWN_PRINTERS) {
            for (d in bonded) {
                val name = d.name ?: continue
                if (name.startsWith(known.namePrefix, ignoreCase = true)) {
                    device = d
                    matched = known
                    break@outer
                }
            }
        }

        // Backward-compat fallback: exact match on legacy PRINTER_NAME.
        if (device == null) {
            device = bonded.firstOrNull { it.name == Config.PRINTER_NAME }
            if (device != null) matched = KnownPrinter(Config.PRINTER_NAME, PrinterType.Generic)
        }

        if (device == null || matched == null) {
            throw IllegalStateException("no known printer paired (looking for: ${
                Config.KNOWN_PRINTERS.joinToString { it.namePrefix + "*" }
            })")
        }

        // Cancel discovery — speeds up connect dramatically.
        try { adapter.cancelDiscovery() } catch (_: SecurityException) {}

        val sock = device.createRfcommSocketToServiceRecord(UUID.fromString(Config.SPP_UUID))
        sock.connect()
        socketRef.set(sock)
        connectedName = device.name ?: matched.namePrefix
        connectedType = matched.type
        lastError = null
        Log.i(TAG, "connected to ${device.name} as ${matched.type}")
    }

    private fun closeSocket() {
        val s = socketRef.getAndSet(null) ?: return
        try { s.close() } catch (_: Exception) {}
    }

    companion object {
        private const val TAG = "BTPrinter"
    }
}
