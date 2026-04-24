const test = require("node:test");
const assert = require("node:assert/strict");

const { buildConfig, DEFAULT_BAILEYS_VERSION, normalizeOwnerJid } = require("../src/config/env");

test("normalizeOwnerJid handles numbers and jids", () => {
  assert.equal(normalizeOwnerJid("923001234567"), "923001234567@s.whatsapp.net");
  assert.equal(
    normalizeOwnerJid("923001234567@s.whatsapp.net"),
    "923001234567@s.whatsapp.net",
  );
});

test("buildConfig validates required values and falls back to MODS", () => {
  const snapshot = { ...process.env };
  try {
    process.env.MONGO_URI = "mongodb://localhost:27017/test";
    process.env.SESSION_ID = "session-id";
    process.env.PREFIX = "/";
    process.env.PORT = "3000";
    process.env.OWNER_JIDS = "";
    process.env.MODS = "923001234567";
    process.env.QR_TOKEN = "token";

    const config = buildConfig();
    assert.equal(config.ownerJids[0], "923001234567@s.whatsapp.net");
    assert.equal(config.qrToken, "token");
    assert.deepEqual(config.baileys.version, DEFAULT_BAILEYS_VERSION);
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in snapshot)) {
        delete process.env[key];
      }
    }

    Object.assign(process.env, snapshot);
  }
});
