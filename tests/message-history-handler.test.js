const test = require("node:test");
const assert = require("node:assert/strict");

const { createMessageHistoryHandler } = require("../src/handlers/message-history-handler");

test("message history handler persists contacts and messages from history sync", async () => {
  const calls = [];
  const handler = createMessageHistoryHandler({
    logger: { info() {}, error() {} },
    services: {
      whatsappSessionHealth: {
        runtimeState: {
          historySyncMode: "default",
        },
      },
      user: {
        upsertContacts: async (contacts) => calls.push(["contacts", contacts.length]),
      },
      messages: {
        saveMessages: async (messages, options) => calls.push(["messages", messages.length, options.source]),
      },
    },
  });

  await handler({
    syncType: "INITIAL_BOOTSTRAP",
    chats: [{}],
    contacts: [{ id: "123@s.whatsapp.net" }],
    messages: [{ key: { remoteJid: "123@s.whatsapp.net", id: "A" } }],
  });

  assert.deepEqual(calls, [
    ["contacts", 1],
    ["messages", 1, "history"],
  ]);
});

test("message history handler skips persisted history when backlog policy disables sync", async () => {
  const calls = [];
  const handler = createMessageHistoryHandler({
    logger: { info() { calls.push(["info"]); }, error() {} },
    services: {
      whatsappSessionHealth: {
        runtimeState: {
          historySyncMode: "none",
        },
      },
      user: {
        upsertContacts: async (contacts) => calls.push(["contacts", contacts.length]),
      },
      messages: {
        saveMessages: async (messages, options) => calls.push(["messages", messages.length, options.source]),
      },
    },
  });

  await handler({
    syncType: "INITIAL_BOOTSTRAP",
    chats: [{}],
    contacts: [{ id: "123@s.whatsapp.net" }],
    messages: [{ key: { remoteJid: "123@s.whatsapp.net", id: "A" } }],
  });

  assert.deepEqual(calls, [
    ["info"],
  ]);
});
