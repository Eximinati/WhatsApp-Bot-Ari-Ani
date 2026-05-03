const {
  downloadContentFromMessage,
  getContentType,
  jidDecode,
} = require("@whiskeysockets/baileys");
const {
  extract,
  getUserId,
  learnIdentity,
  resolveIdentity,
} = require("../../utils/identity-resolver");

function decodeJid(jid) {
  if (!jid) {
    return "";
  }

  const decoded = jidDecode(jid);
  if (decoded?.user && decoded?.server) {
    return `${decoded.user}@${decoded.server}`.trim();
  }

  return String(jid).trim();
}

function extractText(container, type) {
  if (!container || !type) {
    return "";
  }

  const content = container[type];
  return (
    container.conversation ||
    content?.text ||
    content?.caption ||
    content?.description ||
    content?.hydratedTemplate?.hydratedContentText ||
    content?.contentText ||
    content?.selectedDisplayText ||
    content?.selectedButtonId ||
    content?.selectedId ||
    content?.singleSelectReply?.selectedRowId ||
    ""
  );
}

function unwrapMessage(message) {
  let current = message || {};
  let type = getContentType(current);

  while (
    type &&
    [
      "ephemeralMessage",
      "viewOnceMessage",
      "viewOnceMessageV2",
      "viewOnceMessageV2Extension",
    ].includes(type)
  ) {
    const next = current[type]?.message;
    if (!next) {
      break;
    }

    current = next;
    type = getContentType(current);
  }

  return {
    message: current,
    type,
  };
}

async function downloadMedia(message, type) {
  const sourceType = String(type || "").replace(/Message$/i, "");
  const stream = await downloadContentFromMessage(message, sourceType);
  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

function buildQuotedMessage({ clientJid, contextInfo, from, sender }) {
  if (!contextInfo?.quotedMessage) {
    return null;
  }

  const unwrapped = unwrapMessage(contextInfo.quotedMessage);
  const quotedMessage = unwrapped.message;
  const quotedType = unwrapped.type;
  const quotedSender = decodeJid(contextInfo.participant || sender);
  const quotedFrom = decodeJid(contextInfo.remoteJid || from);
  const isSelf = quotedSender === decodeJid(clientJid);

  if (!quotedType || !quotedMessage) {
    return null;
  }

  return {
    key: {
      id: contextInfo.stanzaId || "",
      fromMe: isSelf,
      remoteJid: quotedFrom,
      participant: quotedSender,
    },
    id: contextInfo.stanzaId || "",
    sender: quotedSender,
    participant: quotedSender,
    from: quotedFrom,
    fromMe: isSelf,
    isSelf,
    type: quotedType,
    mtype: quotedType,
    message: quotedMessage,
    msg: quotedMessage[quotedType],
    text: extractText(quotedMessage, quotedType),
    stanzaId: contextInfo.stanzaId || "",
    download: async () => downloadMedia(quotedMessage[quotedType], quotedType),
  };
}

async function normalizeMessage(sock, rawMessage) {
  if (!rawMessage?.message || !rawMessage?.key) {
    return null;
  }

  const raw = JSON.parse(JSON.stringify(rawMessage));
  const message = JSON.parse(JSON.stringify(rawMessage));

  message.id = message.key.id;
  message.fromMe = Boolean(message.key.fromMe);
  message.isSelf = message.fromMe;
  message.from = decodeJid(message.key.remoteJid);
  message.isGroup = message.from.endsWith("@g.us");
  message.sender = message.isGroup
    ? decodeJid(message.key.participant || message.from)
    : message.fromMe
      ? decodeJid(sock.user?.id)
      : message.from;

  const unwrapped = unwrapMessage(message.message);
  message.message = unwrapped.message;
  message.type = unwrapped.type;
  message.mtype = unwrapped.type;

  if (!message.type) {
    return null;
  }

  message.msg = message.message[message.type];
  message.body = extractText(message.message, message.type);
  message.text = message.body;
  message.pushName = message.pushName || "";
  message.mentions =
    message.message?.[message.type]?.contextInfo?.mentionedJid?.filter(Boolean) || [];

  message.quoted = buildQuotedMessage({
    clientJid: sock.user?.id,
    contextInfo: message.message?.[message.type]?.contextInfo,
    from: message.from,
    sender: message.sender,
  });

  message.raw = raw;
  // Primary identity: LID (WhatsApp's canonical form)
  message.rawSender = message.sender;
  message.senderId = extract(message.sender);

  // Optional: try to get phone number (best-effort, not required)
  learnIdentity(message.sender, { sender: message.sender });
  const resolvedPhone = await resolveIdentity(message.sender, sock);
  message.phoneId = resolvedPhone !== message.senderId ? resolvedPhone : null;
  message.userId = getUserId({
    senderId: message.senderId,
    phoneId: message.phoneId,
  });

  message.reply = (text, options = {}) =>
    sock.sendMessage(
      message.from,
      { text, ...options },
      { quoted: raw },
    );
  message.download = async () => downloadMedia(message.msg, message.type);
  message.react = (emoji) =>
    sock.sendMessage(message.from, {
      react: {
        text: emoji,
        key: raw.key,
      },
    });

  return message;
}

module.exports = {
  decodeJid,
  normalizeMessage,
};
