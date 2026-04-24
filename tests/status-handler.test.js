const test = require("node:test");
const assert = require("node:assert/strict");

const { createStatusHandler } = require("../src/handlers/status-handler");
const { BufferJSON } = require("../src/utils/buffer-json");

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

test("status handler resends captured text statuses for send and /send replies", async () => {
  const sent = [];
  const handler = createStatusHandler({
    logger: { info() {}, warn() {}, error() {} },
    services: {
      messages: {
        findStatusRecord: async () => ({
          rawJson: JSON.stringify(
            {
              key: {
                remoteJid: "status@broadcast",
                participant: "123@s.whatsapp.net",
                id: "STATUS2",
              },
              message: {
                conversation: "hello from status",
              },
            },
            BufferJSON.replacer,
          ),
        }),
      },
    },
  });

  const handled = await handler.maybeResend({
    sock: {
      sendMessage: async (jid, payload) => {
        sent.push([jid, payload]);
      },
    },
    message: {
      text: "/send",
      from: "chat@s.whatsapp.net",
      sender: "user@s.whatsapp.net",
      raw: {},
      quoted: {
        id: "STATUS2",
        sender: "123@s.whatsapp.net",
      },
      reply: async () => {},
    },
  });

  assert.equal(handled, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0][1].text, "hello from status");
});
