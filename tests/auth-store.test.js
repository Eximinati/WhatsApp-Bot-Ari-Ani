const test = require("node:test");
const assert = require("node:assert/strict");

const { MongoAuthStore } = require("../src/core/whatsapp/auth-store");
const Session = require("../src/models/session");

test("auth store reloads stored app-state keys without throwing", async () => {
  const store = new MongoAuthStore({
    sessionId: "session",
    logger: { warn() {} },
  });

  store.loadDocument = async () => ({
    session: JSON.stringify({
      creds: {},
      keys: {
        appStateSyncKeys: {
          key1: {
            keyData: Buffer.from("abc").toString("base64"),
            fingerprint: { rawId: 1, currentIndex: 1, deviceIndexes: [1] },
            timestamp: 1,
          },
        },
      },
    }),
  });

  const auth = await store.getAuthState();
  const keys = await auth.state.keys.get("app-state-sync-key", ["key1"]);
  assert.ok(keys.key1);
});

test("auth store encrypts persisted session payload when encryption key is configured", async () => {
  const store = new MongoAuthStore({
    sessionId: "session",
    logger: { warn() {} },
    encryptionKey: "top-secret",
  });

  store.loadDocument = async () => ({ session: "" });

  const originalUpdateOne = Session.updateOne;
  let persisted = "";
  Session.updateOne = async (_filter, update) => {
    persisted = update.$set.session;
  };

  try {
    const auth = await store.getAuthState();
    await auth.saveCreds();
  } finally {
    Session.updateOne = originalUpdateOne;
  }

  assert.match(persisted, /^enc:v1:/);
});
