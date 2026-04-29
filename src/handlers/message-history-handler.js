function createMessageHistoryHandler({ logger, services }) {
  return async function handleMessageHistory(event) {
    try {
      const historySyncMode = services.whatsappSessionHealth?.runtimeState?.historySyncMode || "none";
      if (historySyncMode === "none") {
        logger.info(
          {
            syncType: event.syncType,
            chats: (event.chats || []).length,
            contacts: (event.contacts || []).length,
            messages: (event.messages || []).length,
          },
          "History sync skipped by startup backlog policy",
        );
        return;
      }

      await services.user.upsertContacts(event.contacts || []);
      await services.messages.saveMessages(event.messages || [], {
        source: "history",
      });

      logger.info(
        {
          syncType: event.syncType,
          chats: (event.chats || []).length,
          contacts: (event.contacts || []).length,
          messages: (event.messages || []).length,
        },
        "History sync processed",
      );
    } catch (error) {
      logger.error({ error }, "Failed to process history sync");
    }
  };
}

module.exports = {
  createMessageHistoryHandler,
};
