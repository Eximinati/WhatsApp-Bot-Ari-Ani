const {
  extractMessageContent,
  getContentType,
  jidNormalizedUser,
  proto,
} = require("@whiskeysockets/baileys");
const { downloadMessageBuffer } = require("../../utils/media");

function extractTextFromMessage(message, type) {
  if (!message || !type) {
    return "";
  }

  const content = message[type] || {};
  return (
    message.conversation ||
    content.text ||
    content.caption ||
    content.contentText ||
    content.selectedDisplayText ||
    content.selectedButtonId ||
    content.selectedId ||
    content.singleSelectReply?.selectedRowId ||
    ""
  );
}

function normalizeMessage(sock, rawMessage) {
  if (!rawMessage?.message || !rawMessage?.key) {
    return null;
  }

  const message = proto.WebMessageInfo.fromObject(rawMessage);
  const extracted = extractMessageContent(message.message) || message.message;
  const type = getContentType(extracted);
  const content = type ? extracted[type] : extracted;

  const from = jidNormalizedUser(message.key.remoteJid || "");
  const sender = jidNormalizedUser(
    message.key.fromMe ? sock.user.id : message.key.participant || from,
  );
  const text = extractTextFromMessage(extracted, type);
  const quotedMessage = content?.contextInfo?.quotedMessage || null;
  const quotedType = quotedMessage ? getContentType(quotedMessage) : null;
  const quotedContent = quotedType ? quotedMessage[quotedType] : null;

  const normalized = {
    raw: rawMessage,
    key: message.key,
    id: message.key.id,
    from,
    sender,
    fromMe: message.key.fromMe,
    isGroup: from.endsWith("@g.us"),
    pushName: message.pushName || "",
    message: extracted,
    type,
    msg: content,
    text,
    mentions: content?.contextInfo?.mentionedJid || [],
    quoted: quotedMessage
      ? {
          type: quotedType,
          msg: quotedContent,
          sender: jidNormalizedUser(content.contextInfo.participant || sender),
          id: content.contextInfo.stanzaId,
          download: () =>
            downloadMessageBuffer({
              msg: quotedContent,
              mtype: quotedType,
            }),
        }
      : null,
    reply: (textValue, options = {}) =>
      sock.sendMessage(
        from,
        { text: textValue, ...options },
        { quoted: rawMessage },
      ),
    download: () =>
      downloadMessageBuffer({
        msg: content,
        mtype: type,
      }),
  };

  return normalized;
}

module.exports = {
  normalizeMessage,
};
