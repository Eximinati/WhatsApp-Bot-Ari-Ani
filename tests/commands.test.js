const test = require("node:test");
const assert = require("node:assert/strict");

const helpCommand = require("../src/commands/general/help");
const profileCommand = require("../src/commands/general/profile");
const rankCommand = require("../src/commands/general/rank");
const banCommand = require("../src/commands/mods/ban");
const weatherCommand = require("../src/commands/utils/weather");
const googleCommand = require("../src/commands/utils/google");

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
