const test = require("node:test");
const assert = require("node:assert/strict");

const { createStatusHandler } = require("../src/handlers/status-handler");

test("status handler persists captured status messages", async () => {
  let captured = null;
  const handler = createStatusHandler({
    logger: { info() {}, error() {} },
    services: {
      messages: {
        saveMessage: async (rawMessage, options) => {
          captured = [rawMessage.key.id, options.isStatus, Boolean(options.expiresAt)];
        },
      },
    },
  });

  await handler.capture({
    key: {
      remoteJid: "status@broadcast",
      participant: "123@s.whatsapp.net",
      id: "STATUS1",
    },
  });

  assert.deepEqual(captured, ["STATUS1", true, true]);
});
