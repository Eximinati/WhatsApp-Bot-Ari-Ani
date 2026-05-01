const test = require("node:test");
const assert = require("node:assert/strict");

const { MediaInteractionService } = require("../src/services/media-interaction-service");

function createService(overrides = {}) {
  const updates = [];
  const users = new Map();
  const normalize = (jid) => String(jid || "").split("@")[0];
  const settings = {
    getUserSettings: async (jid) => {
      const key = normalize(jid);
      return users.get(key) || { jid: key, mediaPreferencesJson: "", mediaMenuStateJson: "" };
    },
    updateUserSettings: async (jid, patch) => {
      const key = normalize(jid);
      updates.push({ jid, patch });
      const current = users.get(key) || { jid: key, mediaPreferencesJson: "", mediaMenuStateJson: "" };
      const next = { ...current, ...patch };
      users.set(key, next);
      return next;
    },
  };

  return {
    service: new MediaInteractionService({
      logger: { info() {}, warn() {}, error() {} },
      settings,
      ...overrides,
    }),
    settings,
    updates,
    users,
  };
}

test("media interaction service saves and reads per-command preferences", async () => {
  const { service, settings } = createService();
  await service.setPreference("user", "video", "document");
  const user = await settings.getUserSettings("user");

  assert.equal(service.getPreference(user, "video"), "document");
  assert.equal(service.getPreference(user, "play"), "ask");
});

test("media interaction service prompts when no preference is saved", async () => {
  const { service, settings } = createService();
  const replies = [];

  await service.sendOrPrompt({
    sock: { sendMessage: async () => { throw new Error("should not send immediately"); } },
    message: {
      from: "chat@s.whatsapp.net",
      sender: "user@s.whatsapp.net",
      reply: async (text) => replies.push(text),
    },
    userSettings: await settings.getUserSettings("user"),
    commandName: "video",
    media: {
      title: "Test Video",
      mediaUrl: "https://example.com/video.mp4",
      messageType: "video",
    },
  });

  assert.equal(replies.length, 1);
  assert.match(replies[0], /1\. Send as video/i);
  assert.match(replies[0], /4\. Always send \/video as document/i);
});

test("media interaction service sends immediately from saved preference", async () => {
  const { service, settings } = createService();
  const sent = [];

  await service.setPreference("user", "play", "document");
  await service.sendOrPrompt({
    sock: {
      sendMessage: async (_jid, payload) => {
        sent.push(payload);
      },
    },
    message: {
      from: "chat@s.whatsapp.net",
      sender: "user@s.whatsapp.net",
      reply: async () => {},
    },
    userSettings: await settings.getUserSettings("user"),
    commandName: "play",
    media: {
      title: "Test Song",
      mediaUrl: "https://example.com/song.mp3",
      messageType: "audio",
      mimetype: "audio/mpeg",
    },
  });

  assert.equal(sent.length, 1);
  assert.ok(sent[0].document);
});

test("media interaction service handles remembered choice replies", async () => {
  const { service, settings } = createService();
  const sent = [];
  const replies = [];

  await service.saveMenuState("user", {
    step: "format",
    commandName: "video",
    chatJid: "group@g.us",
    media: {
      title: "Clip",
      mediaUrl: "https://example.com/clip.mp4",
      messageType: "video",
      mimetype: "video/mp4",
    },
  });

  const handled = await service.maybeHandleReply({
    config: { prefix: "/" },
    sock: {
      sendMessage: async (_jid, payload) => {
        sent.push(payload);
      },
    },
    message: {
      text: "4",
      senderId: "user",
      from: "group@g.us",
      reply: async (text) => replies.push(text),
    },
    userSettings: await settings.getUserSettings("user"),
  });

  const updated = await settings.getUserSettings("user");
  assert.equal(handled, true);
  assert.equal(service.getPreference(updated, "video"), "document");
  assert.equal(sent.length, 1);
  assert.ok(sent[0].document);
  assert.match(replies[0], /Saved \/video preference/i);
});
