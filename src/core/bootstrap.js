const path = require("path");
const { config } = require("../config/env");
const { createLogger } = require("../config/logger");
const { connectDatabase, disconnectDatabase } = require("./database");
const { createHttpServer } = require("./http-server");
const { CommandRegistry } = require("../services/command-registry");
const { CooldownService } = require("../services/cooldown-service");
const { createPermissionService } = require("../services/permission-service");
const { SettingsService } = require("../services/settings-service");
const { UserService } = require("../services/user-service");
const { XpService } = require("../services/xp-service");
const { MessageStoreService } = require("../services/message-store-service");
const { GroupMetadataCacheService } = require("../services/group-metadata-cache-service");
const { GroupModerationService } = require("../services/group-moderation-service");
const {
  GoogleSearchService,
} = require("../services/external/google-search-service");
const {
  WeatherService,
} = require("../services/external/weather-service");
const { createContactsHandler } = require("../handlers/contacts-handler");
const {
  createGroupParticipantsHandler,
} = require("../handlers/group-participants-handler");
const {
  createConnectionEventsHandler,
} = require("../handlers/connection-events");
const {
  createCommandDispatcher,
} = require("../handlers/command-dispatcher");
const {
  createMessagesUpsertHandler,
} = require("../handlers/messages-upsert-handler");
const { createMessageHistoryHandler } = require("../handlers/message-history-handler");
const { createMessageEventsHandler } = require("../handlers/message-events-handler");
const { createGroupUpdatesHandler } = require("../handlers/group-updates-handler");
const { createBlocklistHandler } = require("../handlers/blocklist-handler");
const { createCallHandler } = require("../handlers/call-handler");
const { createStatusHandler } = require("../handlers/status-handler");
const { ConnectionManager } = require("./whatsapp/connection-manager");

async function bootstrap() {
  const logger = createLogger(config);
  const runtimeState = {
    startedAt: new Date().toISOString(),
    connectionStatus: "starting",
    qr: null,
    blocklist: new Set(),
  };

  const dbConnection = await connectDatabase({ config, logger });

  const groupMetadataCache = new GroupMetadataCacheService({ logger });
  const services = {
    user: new UserService(),
    settings: new SettingsService({ logger, rootDir: config.appRoot }),
    xp: new XpService(),
    messages: new MessageStoreService(),
    cooldowns: new CooldownService(),
    permission: createPermissionService(config),
    external: {
      google: new GoogleSearchService({
        apiKey: config.apis.googleKey,
        searchEngineId: config.apis.googleCx,
      }),
      weather: new WeatherService({ apiKey: config.apis.weatherKey }),
    },
  };
  services.groupModeration = new GroupModerationService({
    settings: services.settings,
  });
  services.status = createStatusHandler({ logger, services });

  await services.settings.importLegacyData();

  services.commands = new CommandRegistry({
    commandsRoot: path.join(__dirname, "..", "commands"),
  });
  services.commands.load();

  const http = await createHttpServer({
    config,
    logger,
    runtimeState,
  });

  const dispatcher = createCommandDispatcher({
    config,
    groupMetadataCache,
    logger,
    services,
  });

  const handlers = {
    connection: createConnectionEventsHandler({ config, logger, runtimeState }),
    contacts: createContactsHandler({ logger, services }),
    messageHistory: createMessageHistoryHandler({ logger, services }),
    messageEvents: createMessageEventsHandler({ logger, services }),
    groupUpdates: createGroupUpdatesHandler({ groupMetadataCache, logger }),
    groupParticipants: createGroupParticipantsHandler({
      logger,
      services,
      groupMetadataCache,
    }),
    blocklist: createBlocklistHandler({ logger, runtimeState }),
    call: createCallHandler({ logger }),
    messages: createMessagesUpsertHandler({
      dispatcher,
      logger,
      services,
    }),
  };

  const manager = new ConnectionManager({
    config,
    handlers,
    logger,
    runtimeState,
    services,
  });

  logger.info(
    {
      botName: config.botName,
      qrToken: config.qrToken,
      qrUrl: `http://localhost:${config.port}/qr?token=${config.qrToken}`,
    },
    "Bootstrapping Ari-Ani",
  );

  await manager.start();

  let shuttingDown = false;
  const shutdown = async (signal = "manual") => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, "Shutting down Ari-Ani");
    await Promise.allSettled([
      manager.stop(),
      http.close(),
      disconnectDatabase({ logger }),
    ]);
  };

  process.on("SIGINT", async () => {
    await shutdown("SIGINT");
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await shutdown("SIGTERM");
    process.exit(0);
  });

  return {
    config,
    dbConnection,
    http,
    logger,
    manager,
    runtimeState,
    services,
    shutdown,
  };
}

module.exports = {
  bootstrap,
};
