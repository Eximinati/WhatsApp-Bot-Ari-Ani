const test = require("node:test");
const assert = require("node:assert/strict");

const { createCommandDispatcher } = require("../src/handlers/command-dispatcher");

test("command dispatcher routes plain-number replies into the active VU menu", async () => {
  const replies = [];
  const dispatcher = createCommandDispatcher({
    config: { prefix: "/", timezone: "UTC" },
    groupMetadataCache: {
      getOrFetch: async () => null,
    },
    logger: {
      info() {},
      warn() {},
      error() {},
    },
    services: {
      settings: {
        getUserSettings: async () => ({
          banned: false,
          vuMenuStateJson: JSON.stringify({ step: "main" }),
        }),
        getBotSettings: async () => ({
          chatMode: "all",
        }),
        updateUserSettings: async () => {},
      },
      permission: {
        getPermissionContext: () => ({}),
        botChatAllowed: () => true,
        canUseBot: () => true,
        chatAllowed: () => true,
        hasAccess: () => true,
      },
      groupModeration: {
        enforce: async () => ({ handled: false }),
      },
      status: {
        maybeResend: async () => false,
      },
      media: {
        maybeHandleReply: async () => false,
      },
      vu: {
        getAssignments: async () => [
          {
            title: "CS301: Assignment# 1",
            dueText: "23 Apr 2026 to 01 May 2026",
          },
        ],
        getStatus: async () => ({
          connected: true,
          username: "BC260230194",
          alertsMode: "off",
          dailyDigestEnabled: false,
          deadlineReminderLabels: [],
          lastSyncAt: null,
          lastError: "",
        }),
      },
      commands: {
        get: () => null,
      },
      cooldowns: {
        check: () => ({ active: false }),
      },
      xp: {
        awardCommandXp: async () => {},
      },
    },
  });

  await dispatcher.dispatch({
    sock: {
      user: { id: "bot:1@s.whatsapp.net" },
      sendMessage: async () => {},
    },
    message: {
      text: "3",
      sender: "user@s.whatsapp.net",
      from: "user@s.whatsapp.net",
      isGroup: false,
      pushName: "Tester",
      reply: async (text) => {
        replies.push(text);
      },
    },
  });

  assert.equal(replies.length, 1);
  assert.match(replies[0], /\*VU Assignments\*/);
  assert.match(replies[0], /\*VU Menu\*/);
});

test("command dispatcher ignores group messages when bot chat mode is private", async () => {
  const replies = [];
  const dispatcher = createCommandDispatcher({
    config: { prefix: "/", timezone: "UTC" },
    groupMetadataCache: {
      getOrFetch: async () => null,
    },
    logger: {
      info() {},
      warn() {},
      error() {},
    },
    services: {
      settings: {
        getUserSettings: async () => ({
          banned: false,
          vuMenuStateJson: "",
        }),
        getBotSettings: async () => ({
          chatMode: "private",
        }),
      },
      permission: {
        getPermissionContext: () => ({}),
        botChatAllowed: (chatMode, message) => chatMode !== "private" || !message.isGroup,
        canUseBot: () => true,
        chatAllowed: () => true,
        hasAccess: () => true,
      },
      groupModeration: {
        enforce: async () => ({ handled: false }),
      },
      status: {
        maybeResend: async () => false,
      },
      media: {
        maybeHandleReply: async () => false,
      },
      commands: {
        get: () => {
          throw new Error("group commands should not be resolved in private-only mode");
        },
      },
      cooldowns: {
        check: () => ({ active: false }),
      },
      xp: {
        awardCommandXp: async () => {},
      },
    },
  });

  await dispatcher.dispatch({
    sock: {
      user: { id: "bot:1@s.whatsapp.net" },
    },
    message: {
      text: "/help",
      sender: "user@s.whatsapp.net",
      from: "group@g.us",
      isGroup: true,
      pushName: "Tester",
      reply: async (text) => {
        replies.push(text);
      },
    },
  });

  assert.equal(replies.length, 0);
});

test("command dispatcher routes plain replies into an active media menu before VU", async () => {
  const replies = [];
  let mediaHandled = 0;
  let vuCalled = 0;
  const dispatcher = createCommandDispatcher({
    config: { prefix: "/", timezone: "UTC" },
    groupMetadataCache: {
      getOrFetch: async () => null,
    },
    logger: {
      info() {},
      warn() {},
      error() {},
    },
    services: {
      settings: {
        getUserSettings: async () => ({
          banned: false,
          vuMenuStateJson: JSON.stringify({ step: "main" }),
          mediaMenuStateJson: JSON.stringify({ step: "format", commandName: "video", chatJid: "user@s.whatsapp.net" }),
        }),
        getBotSettings: async () => ({
          chatMode: "all",
        }),
      },
      permission: {
        getPermissionContext: () => ({}),
        botChatAllowed: () => true,
        canUseBot: () => true,
        chatAllowed: () => true,
        hasAccess: () => true,
      },
      groupModeration: {
        enforce: async () => ({ handled: false }),
      },
      status: {
        maybeResend: async () => false,
      },
      media: {
        maybeHandleReply: async () => {
          mediaHandled += 1;
          replies.push("media");
          return true;
        },
      },
      vu: {
        getAssignments: async () => {
          vuCalled += 1;
          return [];
        },
        getStatus: async () => ({
          connected: true,
          username: "tester",
          alertsMode: "off",
          dailyDigestEnabled: false,
          deadlineReminderLabels: [],
          lastSyncAt: null,
          lastError: "",
        }),
      },
      commands: {
        get: () => null,
      },
      cooldowns: {
        check: () => ({ active: false }),
      },
      xp: {
        awardCommandXp: async () => {},
      },
    },
  });

  await dispatcher.dispatch({
    sock: {
      user: { id: "bot:1@s.whatsapp.net" },
      sendMessage: async () => {},
    },
    message: {
      text: "1",
      sender: "user@s.whatsapp.net",
      from: "user@s.whatsapp.net",
      isGroup: false,
      pushName: "Tester",
      reply: async (text) => {
        replies.push(text);
      },
    },
  });

  assert.equal(mediaHandled, 1);
  assert.equal(vuCalled, 0);
  assert.deepEqual(replies, ["media"]);
});
