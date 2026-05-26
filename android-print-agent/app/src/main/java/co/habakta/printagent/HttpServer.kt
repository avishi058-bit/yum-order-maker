package co.habakta.printagent

import android.util.Base64
import android.util.Log
import fi.iki.elonen.NanoHTTPD
import org.json.JSONObject

/**
 * Localhost HTTP server. Binds to 127.0.0.1 only — never reachable from
 * outside the device. Two endpoints: /health (GET) and /print-raw (POST).
 *
 * NanoHTTPD itself doesn't expose a "bind address" parameter on this
 * version, but we restrict access by ignoring any request whose Host
 * header isn't 127.0.0.1 / localhost.
 */
class HttpServer(
    port: Int,
    private val printer: BluetoothPrinterClient,
) : NanoHTTPD("127.0.0.1", port) {

    override fun serve(session: IHTTPSession): Response {
        // CORS — the website is on https://yum-order-maker.lovable.app /
        // https://*.lovableproject.com etc. Allow any origin since this
        // server is bound to loopback only.
        val cors = mapOf(
            "Access-Control-Allow-Origin" to "*",
            "Access-Control-Allow-Methods" to "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers" to "Content-Type",
        )

        if (session.method == Method.OPTIONS) {
            return addHeaders(newFixedLengthResponse(Response.Status.OK, "text/plain", "ok"), cors)
        }

        return try {
            when {
                session.method == Method.GET && session.uri == "/health" -> health(cors)
                session.method == Method.POST && session.uri == "/print-raw" -> printRaw(session, cors)
                else -> addHeaders(
                    newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "not found"),
                    cors,
                )
            }
        } catch (e: Exception) {
            Log.e(TAG, "request failed", e)
            addHeaders(
                newFixedLengthResponse(
                    Response.Status.INTERNAL_ERROR,
                    "application/json",
                    JSONObject().put("error", e.message ?: "internal").toString(),
                ),
                cors,
            )
        }
    }

    private fun health(cors: Map<String, String>): Response {
        val body = JSONObject()
            .put("ok", printer.isConnected())
            .put("connected", printer.isConnected())
            .put("printer", printer.printerName())
            .put("version", Config.VERSION)
            .apply { printer.lastErrorMessage()?.let { put("lastError", it) } }
            .toString()
        return addHeaders(newFixedLengthResponse(Response.Status.OK, "application/json", body), cors)
    }

    private fun printRaw(session: IHTTPSession, cors: Map<String, String>): Response {
        val files = HashMap<String, String>()
        session.parseBody(files)
        val rawJson = files["postData"] ?: throw IllegalArgumentException("missing body")
        val json = JSONObject(rawJson)
        val b64 = json.optString("b64", "")
        if (b64.isEmpty()) throw IllegalArgumentException("missing 'b64' field")

        val bytes = Base64.decode(b64, Base64.DEFAULT)
        if (bytes.isEmpty()) throw IllegalArgumentException("empty payload")

        try {
            printer.writeBytes(bytes)
        } catch (e: Exception) {
            val body = JSONObject().put("error", e.message ?: "print failed").toString()
            return addHeaders(
                newFixedLengthResponse(Response.Status.BAD_GATEWAY, "application/json", body),
                cors,
            )
        }

        val ok = JSONObject().put("ok", true).put("bytes", bytes.size).toString()
        return addHeaders(newFixedLengthResponse(Response.Status.OK, "application/json", ok), cors)
    }

    private fun addHeaders(r: Response, headers: Map<String, String>): Response {
        headers.forEach { (k, v) -> r.addHeader(k, v) }
        return r
    }

    companion object {
        private const val TAG = "HttpServer"
    }
}
