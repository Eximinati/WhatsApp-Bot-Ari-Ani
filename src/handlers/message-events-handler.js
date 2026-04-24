function createMessageEventsHandler({ logger, services }) {
  return {
    async onMessagesUpdate(updates) {
      try {
        await services.messages.applyUpdates(updates);
      } catch (error) {
        logger.error({ error }, "Failed to process message updates");
      }
    },
    async onMessagesDelete(item) {
      try {
        await services.messages.markDeleted(item);
      } catch (error) {
        logger.error({ error }, "Failed to process message deletes");
      }
    },
    async onMessagesReaction(reactions) {
      try {
        await services.messages.applyReactions(reactions);
      } catch (error) {
        logger.error({ error }, "Failed to process message reactions");
      }
    },
    async onMessageReceiptUpdate(receipts) {
      try {
        await services.messages.applyReceipts(receipts);
      } catch (error) {
        logger.error({ error }, "Failed to process message receipts");
      }
    },
  };
}

module.exports = {
  createMessageEventsHandler,
};
