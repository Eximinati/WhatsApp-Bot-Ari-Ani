const test = require("node:test");
const assert = require("node:assert/strict");

const helpCommand = require("../src/commands/general/help");
const arianiCommand = require("../src/commands/general/ariani");
const profileCommand = require("../src/commands/general/profile");
const rankCommand = require("../src/commands/general/rank");
const botCommand = require("../src/commands/access/bot");
const banCommand = require("../src/commands/mods/ban");
const weatherCommand = require("../src/commands/utils/weather");
const googleCommand = require("../src/commands/utils/google");
const vuCommand = require("../src/commands/study/vu");

function createCtx(overrides = {}) {
  const sent = [];
  const replies = [];
  const ctx = {
    args: [],
    text: "",
    config: {
      prefix: "/",
      botName: "Ari-Ani",
      timezone: "UTC",
      ownerJids: ["owner@s.whatsapp.net"],
      modJids: [],
    },
    logger: {
      info() {},
      warn() {},
      error() {},
    },
    msg: {
      from: "chat@s.whatsapp.net",
      sender: "user@s.whatsapp.net",
      mentions: [],
      quoted: null,
      raw: {},
    },
    services: {
      commands: {
        get: () => null,
        grouped: () => ({
          general: [helpCommand],
        }),
      },
      user: {
        getDisplayName: async () => "Tester",
      },
      xp: {
        getProfile: async () => ({ xp: 10, level: 2, banned: false, bio: "" }),
        getRank: async () => ({ currentXp: 10, nextLevelXp: 25, level: 2, rankTitle: "Beginner" }),
        getRole: () => "Beginner",
      },
      settings: {
        banUser: async () => {},
        updateUserSettings: async () => {},
        getBotSettings: async () => ({ chatMode: "all" }),
        setBotChatMode: async (chatMode) => ({ chatMode }),
      },
      vu: {
        login: async () => ({ assignments: [] }),
        getStatus: async () => ({
          connected: false,
          username: "",
          alertsMode: "off",
          dailyDigestEnabled: false,
          deadlineReminderLabels: [],
          lastSyncAt: null,
          lastError: "",
        }),
      },
      external: {
        weather: {
          isConfigured: () => false,
          current: async () => ({}),
        },
        google: {
          isConfigured: () => false,
          search: async () => [],
        },
      },
    },
    sock: {
      fetchStatus: async () => ({ status: "About me" }),
      profilePictureUrl: async () => "https://placehold.co/256x256/png",
    },
    reply: async (text) => {
      replies.push(text);
    },
    send: async (_jid, payload) => {
      sent.push(payload);
    },
    ...overrides,
  };

  return { ctx, replies, sent };
}

test("help command renders grouped command list", async () => {
  const { ctx, replies } = createCtx();
  await helpCommand.execute(ctx);
  assert.equal(replies.length, 1);
  assert.match(replies[0], /general/i);
});

test("ariani command includes the persisted chat mode", async () => {
  const { ctx, replies } = createCtx({
    services: {
      ...createCtx().ctx.services,
      settings: {
        ...createCtx().ctx.services.settings,
        getBotSettings: async () => ({ chatMode: "private" }),
      },
    },
  });
  await arianiCommand.execute(ctx);
  assert.match(replies[0], /Chat mode: private only/i);
});

test("profile command renders mentioned profile", async () => {
  const { ctx, sent } = createCtx({
    msg: {
      from: "chat@s.whatsapp.net",
      sender: "me@s.whatsapp.net",
      mentions: ["target@s.whatsapp.net"],
      quoted: null,
      raw: {},
    },
  });
  await profileCommand.execute(ctx);
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /Profile for Tester/);
});

test("rank command responds through send or reply", async () => {
  const { ctx, sent, replies } = createCtx();
  await rankCommand.execute(ctx);
  assert.equal(sent.length + replies.length > 0, true);
});

test("ban command bans mentioned user", async () => {
  let banned = null;
  const { ctx, replies } = createCtx({
    msg: {
      from: "chat@s.whatsapp.net",
      sender: "owner@s.whatsapp.net",
      mentions: ["target@s.whatsapp.net"],
      quoted: null,
      raw: {},
    },
    services: {
      ...createCtx().ctx.services,
      settings: {
        banUser: async (jid, value) => {
          banned = [jid, value];
        },
      },
    },
  });
  await banCommand.execute(ctx);
  assert.deepEqual(banned, ["target@s.whatsapp.net", true]);
  assert.equal(replies.length, 1);
});

test("bot command updates chat mode", async () => {
  const { ctx, replies } = createCtx({
    args: ["private"],
  });
  await botCommand.execute(ctx);
  assert.equal(replies.length, 1);
  assert.match(replies[0], /only respond in private chat/i);
});

test("weather command reports disabled integration when api key is missing", async () => {
  const { ctx, replies } = createCtx({ text: "Karachi" });
  await weatherCommand.execute(ctx);
  assert.match(replies[0], /WEATHER_API_KEY/);
});

test("google command reports disabled integration when credentials are missing", async () => {
  const { ctx, replies } = createCtx({ text: "OpenAI" });
  await googleCommand.execute(ctx);
  assert.match(replies[0], /GOOGLE_API_KEY/);
});

test("vu login command confirms verified login instead of only saving credentials", async () => {
  const { ctx, replies } = createCtx({
    args: ["login", "BC260230194", "secret"],
    services: {
      ...createCtx().ctx.services,
      vu: {
        login: async () => ({ assignments: [{ title: "CS301: Assignment# 1" }] }),
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
      settings: {
        updateUserSettings: async () => {},
      },
    },
  });

  await vuCommand.execute(ctx);
  assert.equal(replies.length, 1);
  assert.match(replies[0], /VU login successful/i);
  assert.match(replies[0], /Calendar items detected: 1/i);
});

test("vu command opens the guided menu when used without arguments", async () => {
  const { ctx, replies } = createCtx();
  await vuCommand.execute(ctx);
  assert.equal(replies.length, 1);
  assert.match(replies[0], /\*VU Menu\*/);
  assert.match(replies[0], /Reply with a number/i);
});

test("vu alerts before command stores custom reminder offsets", async () => {
  let stored = null;
  const { ctx, replies } = createCtx({
    args: ["alerts", "before", "1d,6h,30m"],
    services: {
      ...createCtx().ctx.services,
      vu: {
        parseReminderOffsets: () => [30, 360, 1440],
        updateAlertPreferences: async (_jid, payload) => {
          stored = payload.deadlineReminderMinutes;
          return {
            dailyDigestEnabled: false,
            deadlineReminderMinutes: payload.deadlineReminderMinutes,
            deadlineReminderLabels: ["30m", "6h", "1d"],
            alertsMode: "deadline",
          };
        },
        getAlertSettings: (account) => account,
      },
      settings: {
        updateUserSettings: async () => {},
      },
    },
  });

  await vuCommand.execute(ctx);
  assert.deepEqual(stored, [30, 360, 1440]);
  assert.match(replies[0], /Before deadline: 30m, 6h, 1d/i);
});
