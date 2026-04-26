const test = require("node:test");
const assert = require("node:assert/strict");

const { buildSocketConfig } = require("../src/core/whatsapp/socket-factory");
const { DEFAULT_BAILEYS_VERSION } = require("../src/config/env");

test("socket config wires getMessage and leaves version unset by default", async () => {
  const socketConfig = buildSocketConfig({
    authState: { creds: {}, keys: {} },
    config: {
      baileys: {
        version: DEFAULT_BAILEYS_VERSION,
        historySyncMode: "default",
        syncFullHistory: false,
      },
    },
    groupMetadataCache: {
      get: (jid) => ({ id: jid }),
    },
    logger: { info() {} },
    messageStore: {
      getMessage: async (key) => ({ conversation: key.id }),
    },
  });

  assert.equal(socketConfig.version, undefined);
  assert.deepEqual(await socketConfig.getMessage({ id: "abc" }), { conversation: "abc" });
  assert.deepEqual(await socketConfig.cachedGroupMetadata("group@g.us"), { id: "group@g.us" });
});

test("socket config honors version override and history sync policy", () => {
  const socketConfig = buildSocketConfig({
    authState: { creds: {}, keys: {} },
    config: {
      baileys: {
        version: [2, 3000, 1025091840],
        historySyncMode: "none",
        syncFullHistory: true,
      },
    },
    groupMetadataCache: { get: () => null },
    logger: { info() {} },
    messageStore: { getMessage: async () => undefined },
  });

  assert.deepEqual(socketConfig.version, [2, 3000, 1025091840]);
  assert.equal(socketConfig.syncFullHistory, undefined);
  assert.equal(socketConfig.shouldSyncHistoryMessage(), false);
});
