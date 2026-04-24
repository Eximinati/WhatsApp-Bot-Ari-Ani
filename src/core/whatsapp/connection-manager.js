const { DisconnectReason } = require("@whiskeysockets/baileys");
const constants = require("../../config/constants");
const { MongoAuthStore } = require("./auth-store");
const { createSocket } = require("./socket-factory");

class ConnectionManager {
  constructor({
    config,
    handlers,
    logger,
    runtimeState,
    services,
  }) {
    this.config = config;
    this.handlers = handlers;
    this.logger = logger;
    this.runtimeState = runtimeState;
    this.services = services;
    this.groupMetadataCache = new Map();
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.sock = null;
    this.authSession = null;
  }

  async start() {
    await this.connect();
  }

  async stop() {
    this.clearReconnectTimer();
    await this.disposeSocket();
  }

  async connect() {
    this.clearReconnectTimer();
    await this.disposeSocket();

    const authStore = new MongoAuthStore({
      sessionId: this.config.sessionId,
      logger: this.logger,
      encryptionKey: this.config.security.appEncryptionKey,
    });
    this.authSession = await authStore.getAuthState();

    const { sock } = await createSocket({
      authState: this.authSession.state,
      config: this.config,
      groupMetadataCache: this.groupMetadataCache,
      logger: this.logger.child({ module: "baileys" }),
      messageStore: this.services.messages,
    });

    this.sock = this.instrumentSocket(sock);

    this.sock.ev.on("creds.update", () =>
      this.handlers.connection.onCredsUpdate(this.authSession.saveCreds),
    );
    this.sock.ev.on("connection.update", (update) => this.onConnectionUpdate(update));
    this.sock.ev.on("contacts.update", (update) => this.handlers.contacts?.(update));
    this.sock.ev.on("contacts.upsert", (update) => this.handlers.contacts?.(update));
    this.sock.ev.on("messages.upsert", (event) =>
      this.handlers.messages?.(this.sock, event),
    );
    this.sock.ev.on("messaging-history.set", (event) =>
      this.handlers.messageHistory?.(event),
    );
    this.sock.ev.on("messages.update", (updates) =>
      this.handlers.messageEvents?.onMessagesUpdate(updates),
    );
    this.sock.ev.on("messages.delete", (item) =>
      this.handlers.messageEvents?.onMessagesDelete(item),
    );
    this.sock.ev.on("messages.reaction", (reactions) =>
      this.handlers.messageEvents?.onMessagesReaction(reactions),
    );
    this.sock.ev.on("message-receipt.update", (receipts) =>
      this.handlers.messageEvents?.onMessageReceiptUpdate(receipts),
    );
    this.sock.ev.on("groups.update", (updates) =>
      this.handlers.groupUpdates?.onGroupsUpdate(this.sock, updates),
    );
    this.sock.ev.on("groups.upsert", (upserts) =>
      this.handlers.groupUpdates?.onGroupsUpsert(upserts),
    );
    this.sock.ev.on("group-participants.update", (update) =>
      this.handlers.groupParticipants?.(this.sock, update),
    );
    this.sock.ev.on("blocklist.set", (blocklist) =>
      this.handlers.blocklist?.onSet(blocklist),
    );
    this.sock.ev.on("blocklist.update", (update) =>
      this.handlers.blocklist?.onUpdate(update),
    );
    this.sock.ev.on("call", (callEvent) =>
      this.handlers.call?.(callEvent),
    );
  }

  async onConnectionUpdate(update) {
    this.handlers.connection.onConnectionUpdate(update);

    if (update.connection !== "close") {
      if (update.connection === "open") {
        this.reconnectAttempts = 0;
      }
      return;
    }

    const statusCode = update.lastDisconnect?.error?.output?.statusCode;
    const shouldClearSession =
      statusCode === DisconnectReason.loggedOut ||
      statusCode === DisconnectReason.badSession;

    if (shouldClearSession) {
      this.logger.error({ statusCode }, "Session became invalid, clearing auth state");
      this.runtimeState.connectionStatus = "logged_out";
      if (this.authSession) {
        await this.authSession.clear();
      }
      return;
    }

    this.scheduleReconnect(statusCode);
  }

  scheduleReconnect(statusCode) {
    this.reconnectAttempts += 1;
    const delay = Math.min(
      constants.reconnect.baseDelayMs * this.reconnectAttempts,
      constants.reconnect.maxDelayMs,
    );

    this.logger.warn(
      { delay, statusCode, reconnectAttempts: this.reconnectAttempts },
      "Scheduling reconnect",
    );

    this.runtimeState.connectionStatus = "reconnecting";
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        this.logger.error({ error }, "Reconnect attempt failed");
        this.scheduleReconnect("retry_failure");
      });
    }, delay);
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  async disposeSocket() {
    if (!this.sock) {
      return;
    }

    this.sock.ev.removeAllListeners("creds.update");
    this.sock.ev.removeAllListeners("connection.update");
    this.sock.ev.removeAllListeners("contacts.update");
    this.sock.ev.removeAllListeners("contacts.upsert");
    this.sock.ev.removeAllListeners("messages.upsert");
    this.sock.ev.removeAllListeners("messaging-history.set");
    this.sock.ev.removeAllListeners("messages.update");
    this.sock.ev.removeAllListeners("messages.delete");
    this.sock.ev.removeAllListeners("messages.reaction");
    this.sock.ev.removeAllListeners("message-receipt.update");
    this.sock.ev.removeAllListeners("groups.update");
    this.sock.ev.removeAllListeners("groups.upsert");
    this.sock.ev.removeAllListeners("group-participants.update");
    this.sock.ev.removeAllListeners("blocklist.set");
    this.sock.ev.removeAllListeners("blocklist.update");
    this.sock.ev.removeAllListeners("call");
    this.sock.end(undefined);
    this.sock = null;
  }

  instrumentSocket(sock) {
    const originalSendMessage = sock.sendMessage.bind(sock);
    sock.sendMessage = async (...args) => {
      const sentMessage = await originalSendMessage(...args);
      if (sentMessage) {
        try {
          await this.services.messages.saveMessage(sentMessage, {
            source: "outbound",
          });
        } catch (error) {
          this.logger.warn({ error }, "Failed to persist outbound message");
        }
      }

      return sentMessage;
    };

    return sock;
  }
}

module.exports = {
  ConnectionManager,
};
