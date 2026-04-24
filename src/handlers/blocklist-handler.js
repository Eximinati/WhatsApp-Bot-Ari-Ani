function createBlocklistHandler({ logger, runtimeState }) {
  return {
    async onSet(blocklist) {
      runtimeState.blocklist = new Set(blocklist || []);
      logger.info({ count: runtimeState.blocklist.size }, "Blocklist set updated");
    },
    async onUpdate(update) {
      const state = runtimeState.blocklist || new Set();
      const entries = update || [];

      for (const entry of entries) {
        if (!entry?.blocklist) {
          continue;
        }

        if (entry.type === "remove") {
          state.delete(entry.blocklist);
        } else {
          state.add(entry.blocklist);
        }
      }

      runtimeState.blocklist = state;
      logger.info({ count: state.size }, "Blocklist diff applied");
    },
  };
}

module.exports = {
  createBlocklistHandler,
};
