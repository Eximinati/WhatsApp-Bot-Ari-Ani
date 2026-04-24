const { normalizeMessage } = require("../core/whatsapp/message-normalizer");

function createMessagesUpsertHandler({ dispatcher, logger, services }) {
  return async function handleMessagesUpsert(sock, event) {
    for (const rawMessage of event.messages || []) {
      try {
        const message = normalizeMessage(sock, rawMessage);
        if (!message || !message.message) {
          continue;
        }

        if (message.from === "status@broadcast") {
          await services.status.capture(rawMessage);
          continue;
        }

        await services.messages.saveMessage(rawMessage, {
          source: event.type || "upsert",
        });
        await services.user.touchFromMessage(message);
        if (!event.type || event.type === "notify") {
          await dispatcher.dispatch({ sock, message });
        }
      } catch (error) {
        logger.error({ error, rawMessage }, "Failed to process message");
      }
    }
  };
}

module.exports = {
  createMessagesUpsertHandler,
};
