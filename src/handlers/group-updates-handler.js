function createGroupUpdatesHandler({ groupMetadataCache, logger }) {
  return {
    async onGroupsUpdate(sock, updates) {
      try {
        await groupMetadataCache.handleGroupsUpdate(sock, updates);
      } catch (error) {
        logger.error({ error }, "Failed to process group updates");
      }
    },
    async onGroupsUpsert(upserts) {
      try {
        groupMetadataCache.handleGroupsUpsert(upserts);
      } catch (error) {
        logger.error({ error }, "Failed to process group upserts");
      }
    },
  };
}

module.exports = {
  createGroupUpdatesHandler,
};
