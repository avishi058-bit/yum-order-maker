package co.habakta.printagent

import android.content.Context
import java.security.SecureRandom

/**
 * Per-install shared secret. Generated with SecureRandom on first launch,
 * stored in private SharedPreferences and shown in [MainActivity] so staff can
 * type it once into the website's /station-setup page.
 */
object AgentSecret {
    private const val PREFS = "agent_prefs"
    private const val KEY = "agent_secret"
    private const val ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

    fun get(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.getString(KEY, null)?.let { return it }
        val rnd = SecureRandom()
        val secret = (1..24).map { ALPHABET[rnd.nextInt(ALPHABET.length)] }.joinToString("")
        prefs.edit().putString(KEY, secret).apply()
        return secret
    }
}
