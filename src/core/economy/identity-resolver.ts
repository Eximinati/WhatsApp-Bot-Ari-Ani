/**
 * Extracts the bare JID from a WhatsApp JID string.
 *
 * WhatsApp JIDs come in forms like:
 *   - "123456789@s.whatsapp.net"
 *   - "123456789-123456789@g.us"
 *
 * This helper strips any suffix after `@` (keeping the `@` part
 * intact for group/server JIDs) — it simply returns the raw JID
 * without any device or agent suffixes like ":1" or ":0".
 *
 * In the original JS code, this was imported from
 * `../utils/identity-resolver`. We inline it here for the
 * economy module since it's a one-liner.
 */
export function extract(jid: string): string {
    // Strip ":device" suffix if present (e.g. "123@s.whatsapp.net:1" → "123@s.whatsapp.net")
    const colonIdx = jid.lastIndexOf(':')
    if (colonIdx > jid.lastIndexOf('@')) {
        return jid.slice(0, colonIdx)
    }
    return jid
}