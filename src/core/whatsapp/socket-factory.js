const {
  default: makeWASocket,
  Browsers,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");

function buildSocketConfig({
  authState,
  config,
  groupMetadataCache,
  logger,
  messageStore,
  version,
}) {
  const socketConfig = {
    auth: authState,
    browser: Browsers.macOS("Desktop"),
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    defaultQueryTimeoutMs: 20_000,
    logger,
    cachedGroupMetadata: async (jid) => groupMetadataCache.get(jid),
    getMessage: async (key) => messageStore.getMessage(key),
  };

  if (version || config.baileys.version) {
    socketConfig.version = version || config.baileys.version;
  }

  if (config.baileys.syncFullHistory && config.baileys.historySyncMode !== "none") {
    socketConfig.syncFullHistory = true;
  }

  if (config.baileys.historySyncMode === "none") {
    socketConfig.shouldSyncHistoryMessage = () => false;
  }

  return socketConfig;
}

async function createSocket({ authState, config, groupMetadataCache, logger, messageStore }) {
  let resolvedVersion = config.baileys.version || null;

  if (!resolvedVersion) {
    try {
      const latest = await fetchLatestBaileysVersion();
      resolvedVersion = latest?.version || null;
    } catch (error) {
      logger.warn({ error }, "Failed to fetch latest Baileys version, using library default");
    }
  }

  const socketConfig = buildSocketConfig({
    authState,
    config,
    groupMetadataCache,
    logger,
    messageStore,
    version: resolvedVersion,
  });

  const sock = makeWASocket(socketConfig);

  return { sock };
}

module.exports = {
  buildSocketConfig,
  createSocket,
};
