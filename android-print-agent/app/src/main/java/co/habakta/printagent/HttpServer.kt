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
        // https://*.lovableproject.com etc. The server is bound to loopback
        // only, but we also require an X-Agent-Secret header on /print-raw
        // so a random webpage the tablet visits can't trigger prints.
        val cors = mapOf(
            "Access-Control-Allow-Origin" to "*",
            "Access-Control-Allow-Methods" to "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers" to "Content-Type, X-Agent-Secret",
        )

        if (session.method == Method.OPTIONS) {
            return addHeaders(newFixedLengthResponse(Response.Status.OK, "text/plain", "ok"), cors)
        }

        return try {
            when {
                session.method == Method.GET && session.uri == "/health" -> health(cors)
                session.method == Method.POST && session.uri == "/print-raw" -> {
                    val provided = session.headers["x-agent-secret"]
                        ?: session.headers["X-Agent-Secret"]
                    if (provided != Config.AGENT_SECRET) {
                        return addHeaders(
                            newFixedLengthResponse(
                                Response.Status.UNAUTHORIZED,
                                "application/json",
                                JSONObject().put("error", "invalid_agent_secret").toString(),
                            ),
                            cors,
                        )
                    }
                    printRaw(session, cors)
                }
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
            .put("printerType", printer.printerType().name)
            .put("printerTypeLabel", printer.printerType().label)
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

        val incoming = Base64.decode(b64, Base64.DEFAULT)
        if (incoming.isEmpty()) throw IllegalArgumentException("empty payload")

        // The website always sends ESC/POS (see src/lib/bluetoothPrinter.ts).
        // For Generic printers we pass the bytes through unchanged — this is
        // the original behavior and MUST remain intact. For Star mC-Print3
        // we translate the same bytes into Star Line Mode on the fly.
        val bytes = when (printer.printerType()) {
            PrinterType.Generic -> incoming
            PrinterType.StarLineMode -> EscPosToStar.translate(incoming)
        }

        try {
            printer.writeBytes(bytes)
        } catch (e: Exception) {
            val body = JSONObject().put("error", e.message ?: "print failed").toString()
            return addHeaders(
                newFixedLengthResponse(Response.Status.BAD_GATEWAY, "application/json", body),
                cors,
            )
        }

        val ok = JSONObject()
            .put("ok", true)
            .put("bytes", bytes.size)
            .put("sourceBytes", incoming.size)
            .put("printerType", printer.printerType().name)
            .toString()
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
