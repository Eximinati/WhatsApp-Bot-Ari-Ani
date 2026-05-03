const { normalizeMessage } = require("../core/whatsapp/message-normalizer");
const {
  isProtocolMessage,
  isSenderKeyDistributionMessage,
  isSessionError,
} = require("../core/whatsapp/session-errors");

function readMessageTimestampMs(rawMessage) {
  const value = rawMessage?.messageTimestamp;
  if (value === undefined || value === null) {
    return 0;
  }

  if (typeof value === "number") {
    return value > 1e12 ? value : value * 1000;
  }

  if (typeof value === "object" && typeof value.low === "number") {
    return value.low * 1000;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric > 1e12 ? numeric : numeric * 1000;
  }

  return 0;
}

function createMessagesUpsertHandler({ dispatcher, logger, services }) {
  return async function handleMessagesUpsert(sock, event) {
    for (const rawMessage of event.messages || []) {
      try {
        if (event.type && event.type !== "notify" && rawMessage?.key?.remoteJid !== "status@broadcast") {
          continue;
        }

        if (
          isSenderKeyDistributionMessage(rawMessage) ||
          isProtocolMessage(rawMessage)
        ) {
          continue;
        }

        const cutoffMs = Number(services.whatsappSessionHealth?.runtimeState?.startupCutoffTimestampMs || 0);
        const messageTimestampMs = readMessageTimestampMs(rawMessage);
        const isStatus = rawMessage?.key?.remoteJid === "status@broadcast";
        if (!isStatus && cutoffMs > 0 && messageTimestampMs > 0 && messageTimestampMs < cutoffMs) {
          continue;
        }

        const message = await normalizeMessage(sock, rawMessage);
        if (!message || !message.message || !message.type) {
          continue;
        }
        if (message.fromMe || rawMessage?.key?.fromMe) {
          continue;
        }

        if (message.from === "status@broadcast") {
          await services.status.capture(rawMessage);
          continue;
        }

        if (!message.text && !message.msg?.mimetype) {
          continue;
        }

        await services.messages.saveMessage(rawMessage, {
          source: event.type || "upsert",
        });
        const processingClaim = await services.messages.claimMessageProcessing(rawMessage.key);
        if (!processingClaim.claimed) {
          continue;
        }
        await services.user.touchFromMessage(message);
        
        // Auto-learn identity (LID-first)
        await services.user.upsertIdentity({
          id: message.userId || message.senderId,
          phone: message.phoneId || null,
        });
        if (message.phoneId && message.senderId && message.phoneId !== message.senderId) {
          await services.user.upsertIdentity({
            id: message.senderId,
            phone: message.phoneId,
          });
        }
        
        await dispatcher.dispatch({ sock, message });
      } catch (error) {
        if (isSenderKeyDistributionMessage(rawMessage) && isSessionError(error)) {
          services.whatsappSessionHealth?.recordInboundSenderKeyFailure({
            error,
            rawMessage,
          });
          continue;
        }

        logger.error({ error, rawMessage }, "Failed to process message");
      }
    }
  };
}

module.exports = {
  createMessagesUpsertHandler,
};
