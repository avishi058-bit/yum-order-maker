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

    fun startAutoConnect() {
        executor.submit { reconnectLoop() }
    }

    fun shutdown() {
        shuttingDown = true
        closeSocket()
        executor.shutdownNow()
    }

    fun isConnected(): Boolean = socketRef.get()?.isConnected == true

    fun printerName(): String = Config.PRINTER_NAME

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

        val device: BluetoothDevice = adapter.bondedDevices
            .firstOrNull { it.name == Config.PRINTER_NAME }
            ?: throw IllegalStateException("printer '${Config.PRINTER_NAME}' not paired")

        // Cancel discovery — speeds up connect dramatically
        try { adapter.cancelDiscovery() } catch (_: SecurityException) {}

        val sock = device.createRfcommSocketToServiceRecord(UUID.fromString(Config.SPP_UUID))
        sock.connect()
        socketRef.set(sock)
        lastError = null
        Log.i(TAG, "connected to ${device.name}")
    }

    private fun closeSocket() {
        val s = socketRef.getAndSet(null) ?: return
        try { s.close() } catch (_: Exception) {}
    }

    companion object {
        private const val TAG = "BTPrinter"
    }
}
