const { normalizeMessage } = require("../core/whatsapp/message-normalizer");
const {
  isProtocolMessage,
  isSenderKeyDistributionMessage,
  isSessionError,
} = require("../core/whatsapp/session-errors");

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

        const message = normalizeMessage(sock, rawMessage);
        if (!message || !message.message || !message.type) {
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
        await services.user.touchFromMessage(message);
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
