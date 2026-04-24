const test = require("node:test");
const assert = require("node:assert/strict");

const { buildConfig } = require("../src/config/env");

test("buildConfig throws when required env is missing", () => {
  const snapshot = { ...process.env };
  try {
    delete process.env.MONGO_URI;
    process.env.SESSION_ID = "session";
    process.env.PREFIX = "/";
    process.env.PORT = "3000";
    process.env.OWNER_JIDS = "923001234567";
    assert.throws(() => buildConfig(), /Missing required environment variables/);
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in snapshot)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, snapshot);
  }
});
