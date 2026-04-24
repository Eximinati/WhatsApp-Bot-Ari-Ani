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
    process.env.MOD_JIDS = "923009999999";
    process.env.QR_TOKEN = "token";
    process.env.PRIVATE_BOT = "true";
    process.env.APP_ENCRYPTION_KEY = "";
    process.env.RAILWAY_PUBLIC_DOMAIN = "example.up.railway.app";
    process.env.ACTIVE_INSTANCE_LEASE_MS = "120000";
    process.env.ACTIVE_INSTANCE_RENEW_MS = "45000";

    const config = buildConfig();
    assert.equal(config.ownerJids[0], "923001234567@s.whatsapp.net");
    assert.equal(config.modJids[0], "923009999999@s.whatsapp.net");
    assert.equal(config.privateBot, true);
    assert.equal(config.qrToken, "token");
    assert.equal(config.security.appEncryptionKey, "");
    assert.equal(config.vu.loginPath, "/");
    assert.equal(config.vu.homePath, "/Home.aspx");
    assert.equal(config.vu.calendarPath, "/ActivityCalendar/ActivityCalendar.aspx");
    assert.equal(config.publicBaseUrl, "https://example.up.railway.app");
    assert.equal(config.runtime.leaseMs, 120000);
    assert.equal(config.runtime.renewIntervalMs, 45000);
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
