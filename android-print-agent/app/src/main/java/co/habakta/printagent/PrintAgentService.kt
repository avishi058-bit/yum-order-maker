package co.habakta.printagent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Foreground service that owns the BT connection + the HTTP server.
 * Restart-sticky so Android will revive us after low-memory kills.
 */
class PrintAgentService : Service() {

    private lateinit var printer: BluetoothPrinterClient
    private lateinit var http: HttpServer

    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIF_ID, buildNotification())

        printer = BluetoothPrinterClient(this)
        printer.startAutoConnect()

        http = HttpServer(Config.HTTP_PORT, printer)
        try {
            http.start()
            Log.i(TAG, "HTTP server listening on 127.0.0.1:${Config.HTTP_PORT}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start HTTP server", e)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onDestroy() {
        try { http.stop() } catch (_: Exception) {}
        printer.shutdown()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildNotification(): Notification {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(CHAN_ID, "Print Agent", NotificationManager.IMPORTANCE_LOW)
            nm.createNotificationChannel(ch)
        }
        return NotificationCompat.Builder(this, CHAN_ID)
            .setContentTitle("הבקתה — Print Agent")
            .setContentText(getString(R.string.agent_running))
            .setSmallIcon(android.R.drawable.ic_menu_print)
            .setOngoing(true)
            .build()
    }

    companion object {
        private const val TAG = "PrintAgentService"
        private const val NOTIF_ID = 42
        private const val CHAN_ID = "print-agent"
    }
}
