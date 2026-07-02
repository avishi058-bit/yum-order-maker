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
 * Keeps one open Bluetooth SPP connection to the receipt printer.
 * Auto-reconnects in the background. Thread-safe: callers from the HTTP
 * server can invoke [writeBytes] from any thread.
 */
class BluetoothPrinterClient(private val ctx: Context) {

    private val socketRef = AtomicReference<BluetoothSocket?>(null)
    private val executor = Executors.newSingleThreadExecutor()
    @Volatile private var shuttingDown = false
    @Volatile private var lastError: String? = null
    @Volatile private var connectedName: String? = null

    fun startAutoConnect() {
        executor.submit { reconnectLoop() }
    }

    fun shutdown() {
        shuttingDown = true
        closeSocket()
        executor.shutdownNow()
    }

    fun isConnected(): Boolean = socketRef.get()?.isConnected == true

    /** Name of the paired device we are actually talking to (mC-Print3, Printer001, ...). */
    fun printerName(): String = connectedName ?: Config.PRINTER_NAMES.firstOrNull() ?: Config.PRINTER_NAME

    fun lastErrorMessage(): String? = lastError

    /**
     * Write raw bytes (ESC/POS) to the printer. Blocks until written or
     * fails. Throws on error so the HTTP layer can return 502.
     */
    @Synchronized
    fun writeBytes(bytes: ByteArray) {
        val sock = socketRef.get() ?: run {
            // try one-shot connect on demand
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
            // try to reconnect once and resend
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

        // 1. Prefer an exact-name match, in priority order from Config.
        var device: BluetoothDevice? = Config.PRINTER_NAMES
            .asSequence()
            .mapNotNull { wanted -> bonded.firstOrNull { it.name == wanted } }
            .firstOrNull()

        // 2. Otherwise, accept any paired device whose name starts with
        //    one of the known printer prefixes (mC-Print3, Star, Printer001).
        if (device == null) {
            device = Config.PRINTER_NAME_PREFIXES
                .asSequence()
                .mapNotNull { pfx -> bonded.firstOrNull { it.name?.startsWith(pfx) == true } }
                .firstOrNull()
        }

        if (device == null) {
            val pairedList = bonded.joinToString(", ") { it.name ?: "?" }
            throw IllegalStateException(
                "no supported printer paired (looking for ${Config.PRINTER_NAMES}; " +
                    "paired: [$pairedList])",
            )
        }

        // Cancel discovery — speeds up connect dramatically
        try { adapter.cancelDiscovery() } catch (_: SecurityException) {}

        val sock = device.createRfcommSocketToServiceRecord(UUID.fromString(Config.SPP_UUID))
        try {
            sock.connect()
        } catch (e: Exception) {
            // Some Bluetooth stacks (notably older Android on certain OEM
            // tablets) fail the SDP-based SPP connect against the Star
            // mC-Print3. Fall back to the reflective RFCOMM channel 1
            // route, which bypasses SDP and dials the SPP channel directly.
            Log.w(TAG, "SDP SPP connect to ${device.name} failed, trying channel-1 fallback: ${e.message}")
            try { sock.close() } catch (_: Exception) {}
            val fallback = try {
                val m = device.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType)
                m.invoke(device, 1) as BluetoothSocket
            } catch (re: Exception) {
                throw IllegalStateException(
                    "connect to ${device.name} failed: ${e.message} (fallback unavailable: ${re.message})",
                )
            }
            fallback.connect()
            socketRef.set(fallback)
            connectedName = device.name
            lastError = null
            Log.i(TAG, "connected to ${device.name} (channel-1 fallback)")
            return
        }
        socketRef.set(sock)
        connectedName = device.name
        lastError = null
        Log.i(TAG, "connected to ${device.name}")
    }

    private fun closeSocket() {
        val s = socketRef.getAndSet(null) ?: return
        connectedName = null
        try { s.close() } catch (_: Exception) {}
    }

    companion object {
        private const val TAG = "BTPrinter"
    }
}
