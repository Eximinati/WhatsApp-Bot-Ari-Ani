const test = require("node:test");
const assert = require("node:assert/strict");

const { MongoAuthStore } = require("../src/core/whatsapp/auth-store");
const Session = require("../src/models/session");
const SessionKey = require("../src/models/session-key");

test("auth store reloads stored blob auth state and app-state keys without throwing", async () => {
  const store = new MongoAuthStore({
    sessionId: "session",
    logger: { warn() {}, error() {} },
  });

  store.loadDocument = async () => ({
    session: JSON.stringify({
      creds: { registered: true },
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
  assert.equal(auth.state.creds.registered, true);
});

test("auth store migrates legacy creds and per-key records into a blob session", async () => {
  const store = new MongoAuthStore({
    sessionId: "session",
    logger: { warn() {}, error() {} },
  });

  store.loadDocument = async () => ({
    session: "",
    creds: JSON.stringify({ registered: true }),
  });

  const originalFind = SessionKey.find;
  const originalUpdateOne = Session.updateOne;
  const originalDeleteMany = SessionKey.deleteMany;
  let persistedUpdate = null;
  let clearedKeyFilter = null;

  SessionKey.find = () => ({
    lean: async () => [
      {
        category: "sender-key-memory",
        keyId: "120@g.us",
        value: JSON.stringify({ chain: "value" }),
      },
    ],
  });
  Session.updateOne = async (_filter, update) => {
    persistedUpdate = update;
  };
  SessionKey.deleteMany = async (filter) => {
    clearedKeyFilter = filter;
  };

  try {
    const auth = await store.getAuthState();

    assert.equal(auth.legacySessionDetected, true);
    assert.equal(auth.state.creds.registered, true);
    assert.ok(persistedUpdate.$set.session);
    assert.equal(persistedUpdate.$set.creds, "");
    assert.deepEqual(clearedKeyFilter, { sessionId: "session" });
  } finally {
    SessionKey.find = originalFind;
    Session.updateOne = originalUpdateOne;
    SessionKey.deleteMany = originalDeleteMany;
  }
});

test("auth store encrypts persisted session payload when encryption key is configured", async () => {
  const store = new MongoAuthStore({
    sessionId: "session",
    logger: { warn() {}, error() {} },
    encryptionKey: "top-secret",
  });

  store.loadDocument = async () => ({ session: "", creds: "" });

  const originalFind = SessionKey.find;
  const originalUpdateOne = Session.updateOne;
  let persisted = "";
  SessionKey.find = () => ({
    lean: async () => [],
  });
  Session.updateOne = async (_filter, update) => {
    persisted = update.$set.session;
  };

  try {
    const auth = await store.getAuthState();
    await auth.saveCreds();
  } finally {
    SessionKey.find = originalFind;
    Session.updateOne = originalUpdateOne;
  }

  assert.match(persisted, /^enc:v1:/);
});

test("auth store clear removes both session docs and session key docs", async () => {
  const store = new MongoAuthStore({
    sessionId: "session",
    logger: { warn() {}, error() {} },
  });

  store.loadDocument = async () => ({ session: "", creds: "" });

  const originalFind = SessionKey.find;
  const originalDeleteOne = Session.deleteOne;
  const originalDeleteMany = SessionKey.deleteMany;
  const calls = [];

  SessionKey.find = () => ({
    lean: async () => [],
  });
  Session.deleteOne = async (filter) => {
    calls.push(["session", filter]);
  };
  SessionKey.deleteMany = async (filter) => {
    calls.push(["keys", filter]);
  };

  try {
    const auth = await store.getAuthState();
    await auth.clear();
  } finally {
    SessionKey.find = originalFind;
    Session.deleteOne = originalDeleteOne;
    SessionKey.deleteMany = originalDeleteMany;
  }

  assert.deepEqual(calls, [
    ["session", { sessionId: "session" }],
    ["keys", { sessionId: "session" }],
  ]);
});
