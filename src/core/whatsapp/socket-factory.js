const {
  default: makeWASocket,
  Browsers,
} = require("@whiskeysockets/baileys");

function buildSocketConfig({ authState, config, groupMetadataCache, logger, messageStore }) {
  const socketConfig = {
    auth: authState,
    browser: Browsers.macOS("Desktop"),
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    defaultQueryTimeoutMs: 60_000,
    logger,
    cachedGroupMetadata: async (jid) => groupMetadataCache.get(jid),
    getMessage: async (key) => messageStore.getMessage(key),
  };

  if (config.baileys.version) {
    socketConfig.version = config.baileys.version;
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
  const socketConfig = buildSocketConfig({
    authState,
    config,
    groupMetadataCache,
    logger,
    messageStore,
  });

  const sock = makeWASocket(socketConfig);

  return { sock };
}

module.exports = {
  buildSocketConfig,
  createSocket,
};
