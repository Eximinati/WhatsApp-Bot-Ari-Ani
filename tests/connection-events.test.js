const test = require("node:test");
const assert = require("node:assert/strict");

const { createConnectionEventsHandler } = require("../src/handlers/connection-events");

test("connection events handler saves creds and updates runtime state", async () => {
  let saved = false;
  const runtimeState = {
    connectionStatus: "starting",
    qr: "old",
  };

  const handler = createConnectionEventsHandler({
    config: { port: 1234, qrToken: "token" },
    logger: { info() {}, warn() {} },
    runtimeState,
  });

  await handler.onCredsUpdate(async () => {
    saved = true;
  });
  await handler.onConnectionUpdate({ connection: "open" });

  assert.equal(saved, true);
  assert.equal(runtimeState.connectionStatus, "open");
  assert.equal(runtimeState.qr, null);
});
