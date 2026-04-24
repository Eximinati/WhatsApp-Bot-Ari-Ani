const test = require("node:test");
const assert = require("node:assert/strict");

const { GroupMetadataCacheService } = require("../src/services/group-metadata-cache-service");

test("group metadata cache stores upserts and refreshes updates from socket", async () => {
  const cache = new GroupMetadataCacheService({
    logger: { warn() {} },
  });

  cache.handleGroupsUpsert([{ id: "group@g.us", subject: "Old" }]);
  assert.equal(cache.get("group@g.us").subject, "Old");

  const sock = {
    groupMetadata: async () => ({ id: "group@g.us", subject: "New" }),
  };

  await cache.handleGroupsUpdate(sock, [{ id: "group@g.us" }]);
  assert.equal(cache.get("group@g.us").subject, "New");
});
