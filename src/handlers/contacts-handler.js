function createContactsHandler({ logger, services }) {
  return async function handleContacts(update) {
    try {
      await services.user.upsertContacts(update);
    } catch (error) {
      logger.warn({ error }, "Failed to upsert contacts");
    }
  };
}

module.exports = {
  createContactsHandler,
};
