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
        updateUserSettings: async () => {},
      },
      permission: {
        getPermissionContext: () => ({}),
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
