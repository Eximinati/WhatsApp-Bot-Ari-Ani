const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createMessagesUpsertHandler,
} = require("../src/handlers/messages-upsert-handler");

test("messages upsert handler normalizes a command message and dispatches it", async () => {
  const calls = [];
  const handler = createMessagesUpsertHandler({
    dispatcher: {
      dispatch: async ({ message }) => {
        calls.push(["dispatch", message.text]);
      },
    },
    logger: { error() {} },
    services: {
      messages: {
        saveMessage: async () => {
          calls.push(["save"]);
        },
      },
      status: {
        capture: async () => {
          calls.push(["status"]);
        },
      },
      user: {
        touchFromMessage: async (message) => {
          calls.push(["touch", message.sender]);
        },
      },
    },
  });

  const sock = {
    user: { id: "bot:1@s.whatsapp.net" },
    sendMessage: async () => {},
  };

  await handler(sock, {
    type: "notify",
    messages: [
      {
        key: {
          remoteJid: "123@s.whatsapp.net",
          fromMe: false,
          id: "ABCD1234",
        },
        pushName: "Tester",
        message: {
          conversation: "/hi",
        },
      },
    ],
  });

  assert.deepEqual(calls, [
    ["save"],
    ["touch", "123@s.whatsapp.net"],
    ["dispatch", "/hi"],
  ]);
});

test("messages upsert handler ignores non-notify traffic but still captures statuses", async () => {
  const calls = [];
  const handler = createMessagesUpsertHandler({
    dispatcher: {
      dispatch: async () => {
        calls.push(["dispatch"]);
      },
    },
    logger: { error() {} },
    services: {
      messages: {
        saveMessage: async () => {
          calls.push(["save"]);
        },
      },
      status: {
        capture: async () => {
          calls.push(["status"]);
        },
      },
      user: {
        touchFromMessage: async () => {
          calls.push(["touch"]);
        },
      },
    },
  });

  const sock = {
    user: { id: "bot:1@s.whatsapp.net" },
    sendMessage: async () => {},
  };

  await handler(sock, {
    type: "append",
    messages: [
      {
        key: {
          remoteJid: "status@broadcast",
          participant: "123@s.whatsapp.net",
          fromMe: false,
          id: "STATUS1",
        },
        pushName: "Tester",
        message: {
          conversation: "hello",
        },
      },
      {
        key: {
          remoteJid: "123@s.whatsapp.net",
          fromMe: false,
          id: "ABCD1234",
        },
        pushName: "Tester",
        message: {
          conversation: "/hi",
        },
      },
    ],
  });

  assert.deepEqual(calls, [
    ["status"],
  ]);
});

test("messages upsert handler skips sender-key and protocol messages", async () => {
  const calls = [];
  const handler = createMessagesUpsertHandler({
    dispatcher: {
      dispatch: async () => {
        calls.push(["dispatch"]);
      },
    },
    logger: { error() { calls.push(["error"]); } },
    services: {
      messages: {
        saveMessage: async () => {
          calls.push(["save"]);
        },
      },
      status: {
        capture: async () => {
          calls.push(["status"]);
        },
      },
      user: {
        touchFromMessage: async () => {
          calls.push(["touch"]);
        },
      },
    },
  });

  await handler(
    { user: { id: "bot@s.whatsapp.net" }, sendMessage: async () => {} },
    {
      type: "notify",
      messages: [
        {
          key: {
            remoteJid: "120363419505337488@g.us",
            participant: "58777214701585@lid",
            fromMe: false,
            id: "SENDERKEY1",
          },
          message: {
            senderKeyDistributionMessage: {
              axolotlSenderKeyDistributionMessage: Buffer.from("abc"),
            },
          },
        },
        {
          key: {
            remoteJid: "120363419505337488@g.us",
            participant: "58777214701585@lid",
            fromMe: false,
            id: "PROTOCOL1",
          },
          message: {
            protocolMessage: {
              type: 0,
            },
          },
        },
      ],
    },
  );

  assert.deepEqual(calls, []);
});

test("messages upsert handler ignores stale backlog messages older than startup cutoff", async () => {
  const calls = [];
  const handler = createMessagesUpsertHandler({
    dispatcher: {
      dispatch: async () => {
        calls.push(["dispatch"]);
      },
    },
    logger: { error() {} },
    services: {
      whatsappSessionHealth: {
        runtimeState: {
          startupCutoffTimestampMs: 2_000_000,
        },
      },
      messages: {
        saveMessage: async () => {
          calls.push(["save"]);
        },
      },
      status: {
        capture: async () => {
          calls.push(["status"]);
        },
      },
      user: {
        touchFromMessage: async () => {
          calls.push(["touch"]);
        },
      },
    },
  });

  await handler(
    { user: { id: "bot@s.whatsapp.net" }, sendMessage: async () => {} },
    {
      type: "notify",
      messages: [
        {
          key: {
            remoteJid: "123@s.whatsapp.net",
            fromMe: false,
            id: "OLD1",
          },
          messageTimestamp: 1000,
          pushName: "Tester",
          message: {
            conversation: "/hi",
          },
        },
      ],
    },
  );

  assert.deepEqual(calls, []);
});
