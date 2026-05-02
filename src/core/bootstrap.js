const path = require("path");
const { config } = require("../config/env");
const { createLogger } = require("../config/logger");
const { initIdentityResolver, loadMappingsFromStore } = require("../utils/identity-resolver");
const UserIdentity = require("../models/user-identity");
const { connectDatabase, disconnectDatabase, pingDatabase } = require("./database");
const { createHttpServer } = require("./http-server");
const { CommandRegistry } = require("../services/command-registry");
const { CooldownService } = require("../services/cooldown-service");
const { createPermissionService } = require("../services/permission-service");
const { SettingsService } = require("../services/settings-service");
const { UserService } = require("../services/user-service");
const { XpService } = require("../services/xp-service");
const { EconomyService } = require("../services/economy-service");
const { NotesService } = require("../services/notes-service");
const { ReminderService } = require("../services/reminder-service");
const { GameService } = require("../services/game-service");
const { SchedulerService } = require("../services/scheduler-service");
const { ActiveInstanceService } = require("../services/active-instance-service");
const { KeepaliveService } = require("../services/keepalive-service");
const { MessageStoreService } = require("../services/message-store-service");
const { GroupMetadataCacheService } = require("../services/group-metadata-cache-service");
const { GroupModerationService } = require("../services/group-moderation-service");
const { VisualCardService } = require("../services/visual-card-service");
const { IslamicService } = require("../services/islamic-service");
const { MediaInteractionService } = require("../services/media-interaction-service");
const {
  WhatsAppSessionHealthService,
} = require("../services/whatsapp-session-health-service");
const {
  GoogleSearchService,
} = require("../services/external/google-search-service");
const { WikiService } = require("../services/external/wiki-service");
const { DictionaryService } = require("../services/external/dictionary-service");
const { TranslateService } = require("../services/external/translate-service");
const {
  WeatherService,
} = require("../services/external/weather-service");
const { VuService } = require("../services/vu-service");
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
  const { setLogger } = require("../utils/identity-resolver");
  setLogger(logger);
  const qrBaseUrl = config.publicBaseUrl || `http://localhost:${config.port}`;
  const runtimeState = {
    startedAt: new Date().toISOString(),
    startupCutoffTimestampMs: Date.now() - (config.startup.waBacklogGraceSeconds * 1000),
    connectionStatus: "starting",
    whatsappSessionHealth: "healthy",
    historySyncMode: config.baileys.historySyncMode,
    qr: null,
    blocklist: new Set(),
    instanceId: config.runtime.instanceId,
  };

  const dbConnection = await connectDatabase({ config, logger });

  initIdentityResolver({
    upsert: async (id, phone) => {
      if (!id || id === "status") return;
      await UserIdentity.updateOne(
        { id },
        {
          $set: { phone: phone || undefined },
          $setOnInsert: { id, role: "user", createdAt: new Date() },
        },
        { upsert: true },
      );
    },
    loadAll: async () => UserIdentity.find({}).lean(),
  });
  await loadMappingsFromStore();

  const groupMetadataCache = new GroupMetadataCacheService({ logger });
  const services = {
    user: new UserService(),
    settings: new SettingsService({ logger, rootDir: config.appRoot }),
    xp: new XpService(),
    economy: new EconomyService(),
    notes: new NotesService(),
    reminders: new ReminderService({ config, logger }),
    games: new GameService(),
    visuals: new VisualCardService(),
    islamic: new IslamicService({ logger }),
    messages: new MessageStoreService(),
    cooldowns: new CooldownService(),
    vu: new VuService({ config, logger }),
    external: {
      google: new GoogleSearchService({
        apiKey: config.apis.googleKey,
        searchEngineId: config.apis.googleCx,
      }),
      wiki: new WikiService(),
      dictionary: new DictionaryService(),
      translate: new TranslateService(),
      weather: new WeatherService({ apiKey: config.apis.weatherKey }),
    },
  };
  services.media = new MediaInteractionService({
    logger,
    settings: services.settings,
  });
  services.whatsappSessionHealth = new WhatsAppSessionHealthService({
    logger,
    runtimeState,
    sessionId: config.sessionId,
  });
  services.groupModeration = new GroupModerationService({
    settings: services.settings,
  });
  services.status = createStatusHandler({ logger, services });
  services.playlist = require("../services/playlist-service");
  services.playlistZip = require("../services/playlist-zip-service");

  // Initialize permission service AFTER services object is complete
  services.permission = createPermissionService(config, services.user);

  await services.settings.importLegacyData();

  const activeInstance = new ActiveInstanceService({
    config,
    logger,
    key: `whatsapp-session:${config.sessionId}`,
    ownerId: config.runtime.instanceId,
    ownerLabel: `${config.platform}:${config.runtime.instanceId}`,
  });

  const lockAcquired = await activeInstance.waitForAcquire();
  if (!lockAcquired) {
    const lease = await activeInstance.getCurrentLease().catch(() => null);
    await disconnectDatabase({ logger }).catch(() => {});
    const retryAfterSeconds = lease?.expiresAt
      ? Math.max(0, Math.ceil((new Date(lease.expiresAt).getTime() - Date.now()) / 1000))
      : null;
    const ownerLabel = lease?.ownerLabel || lease?.ownerId || "unknown";
    throw new Error(
      `Another active bot instance is still using SESSION_ID=${config.sessionId}. Active lease owner=${ownerLabel}.`
        + (retryAfterSeconds !== null ? ` Retry after about ${retryAfterSeconds}s.` : "")
        + " If you already stopped the bot on this machine, run `npm run session:unlock -- --confirm` to clear the stale runtime lease.",
    );
  }

  let http = null;
  let manager = null;
  let scheduler = null;
  let keepalive = null;

  try {
    services.commands = new CommandRegistry({
      commandsRoot: path.join(__dirname, "..", "commands"),
    });
    services.commands.load();

    http = await createHttpServer({
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

    manager = new ConnectionManager({
      config,
      groupMetadataCache,
      handlers,
      logger,
      runtimeState,
      services,
    });

    logger.info(
      {
        botName: config.botName,
        instanceId: config.runtime.instanceId,
        platform: config.platform,
        qrToken: config.qrToken,
        qrUrl: `${qrBaseUrl}/qr?token=${config.qrToken}`,
      },
      "Bootstrapping Ari-Ani",
    );

    await manager.start();

    scheduler = new SchedulerService({
      config,
      logger,
      services,
      getSocket: () => manager.sock,
    });
    scheduler.start();

    keepalive = new KeepaliveService({
      config,
      logger,
      pingMongo: pingDatabase,
    });
    keepalive.start();
  } catch (error) {
    await Promise.allSettled([
      Promise.resolve().then(() => keepalive?.stop()),
      Promise.resolve().then(() => scheduler?.stop()),
      Promise.resolve().then(() => manager?.stop()),
      Promise.resolve().then(() => http?.close()),
      disconnectDatabase({ logger }),
    ]);
    await activeInstance.release().catch(() => {});
    throw error;
  }

  let shuttingDown = false;
  const shutdown = async (signal = "manual") => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, "Shutting down Ari-Ani");
    clearInterval(leaseHeartbeat);

    // Release the active instance lease FIRST with its own timeout so
    // hung socket / DB operations below cannot block it.
    await Promise.race([
      activeInstance.release(),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]).catch((error) => {
      logger.error({ error }, "Failed to release active instance lease during shutdown");
    });

    await Promise.allSettled([
      Promise.resolve().then(() => keepalive?.stop()),
      Promise.resolve().then(() => scheduler?.stop()),
      Promise.resolve().then(() => manager?.stop()),
      Promise.resolve().then(() => http?.close()),
      disconnectDatabase({ logger }),
    ]);
  };

  const leaseHeartbeat = setInterval(() => {
    activeInstance.renew().then((renewed) => {
      if (!renewed) {
        logger.error(
          {
            area: "RUNTIME",
            instanceId: config.runtime.instanceId,
            sessionId: config.sessionId,
          },
          "Active instance lease was lost. Shutting down to avoid duplicate WhatsApp sessions.",
        );
        shutdown("lease-lost").finally(() => {
          process.exit(1);
        });
      }
    }).catch((error) => {
      logger.error({ area: "RUNTIME", error }, "Failed to renew active instance lease");
    });
  }, config.runtime.renewIntervalMs);

  const gracefulShutdown = async (signal) => {
    // Force exit if anything hangs. The lease has already been released
    // separately in shutdown().
    const forceExitTimeout = setTimeout(() => {
      logger.error({ signal }, "Shutdown timed out after 10s, forcing exit");
      process.exit(1);
    }, 10_000);

    try {
      await shutdown(signal);
    } finally {
      clearTimeout(forceExitTimeout);
    }

    process.exit(0);
  };

  process.on("SIGINT", () => {
    gracefulShutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    gracefulShutdown("SIGTERM");
  });

  return {
    config,
    dbConnection,
    http,
    logger,
    manager,
    runtimeState,
    services,
    scheduler,
    keepalive,
    activeInstance,
    shutdown,
  };
}

module.exports = {
  bootstrap,
};
