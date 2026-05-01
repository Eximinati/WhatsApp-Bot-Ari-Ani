function normalizeJid(jid) {
  if (!jid) {
    return jid;
  }

  if (jid.includes("@")) {
    return jid;
  }

  const digits = String(jid).replace(/\D/g, "");
  return digits ? `${digits}@s.whatsapp.net` : jid;
}

/**
 * Extract the bare user ID from any JID format, stripping device suffix and
 * server domain. Useful for cross-format comparison (e.g., @s.whatsapp.net vs @lid).
 *
 * "923265825610:1@s.whatsapp.net" → "923265825610"
 * "52051094585491@lid"           → "52051094585491"
 * "52051094585491@s.whatsapp.net" → "52051094585491"
 */
function extractUserId(jid) {
  if (!jid) {
    return "";
  }
  const str = String(jid);
  const atIndex = str.indexOf("@");
  const userPart = atIndex > -1 ? str.slice(0, atIndex) : str;
  const colonIndex = userPart.indexOf(":");
  return colonIndex > -1 ? userPart.slice(0, colonIndex) : userPart;
}

function sameUser(jidA, jidB) {
  return extractUserId(jidA) === extractUserId(jidB);
}

function mentionTag(jid) {
  return `@${normalizeJid(jid).split("@")[0]}`;
}

module.exports = {
  extractUserId,
  mentionTag,
  normalizeJid,
  sameUser,
};
