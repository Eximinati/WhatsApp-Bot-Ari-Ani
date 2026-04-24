const test = require("node:test");
const assert = require("node:assert/strict");

const { DisconnectReason } = require("@whiskeysockets/baileys");
const { ConnectionManager } = require("../src/core/whatsapp/connection-manager");

test("connection manager schedules reconnect on restart-required close", async () => {
  let scheduled = null;
  const manager = new ConnectionManager({
    config: { sessionId: "session" },
    handlers: { connection: { onConnectionUpdate() {} } },
    logger: { warn() {}, error() {}, child() { return this; } },
    runtimeState: { connectionStatus: "open" },
    services: {},
  });

  manager.scheduleReconnect = (statusCode) => {
    scheduled = statusCode;
  };

  await manager.onConnectionUpdate({
    connection: "close",
    lastDisconnect: {
      error: {
        output: {
          statusCode: DisconnectReason.restartRequired,
        },
      },
    },
  });

  assert.equal(scheduled, DisconnectReason.restartRequired);
});

test("connection manager clears auth state on logged out", async () => {
  let cleared = false;
  const manager = new ConnectionManager({
    config: { sessionId: "session" },
    handlers: { connection: { onConnectionUpdate() {} } },
    logger: { warn() {}, error() {}, child() { return this; } },
    runtimeState: { connectionStatus: "open" },
    services: {},
  });

  manager.authSession = {
    clear: async () => {
      cleared = true;
    },
  };

  await manager.onConnectionUpdate({
    connection: "close",
    lastDisconnect: {
      error: {
        output: {
          statusCode: DisconnectReason.loggedOut,
        },
      },
    },
  });

  assert.equal(cleared, true);
  assert.equal(manager.runtimeState.connectionStatus, "logged_out");
});
