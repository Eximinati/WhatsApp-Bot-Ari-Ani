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

function mentionTag(jid) {
  return `@${normalizeJid(jid).split("@")[0]}`;
}

module.exports = {
  normalizeJid,
  mentionTag,
};
