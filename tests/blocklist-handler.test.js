const test = require("node:test");
const assert = require("node:assert/strict");

const { createBlocklistHandler } = require("../src/handlers/blocklist-handler");

test("blocklist handler replaces and updates runtime blocklist", async () => {
  const runtimeState = {};
  const handler = createBlocklistHandler({
    logger: { info() {} },
    runtimeState,
  });

  await handler.onSet(["a@s.whatsapp.net"]);
  await handler.onUpdate([
    { blocklist: "b@s.whatsapp.net", type: "add" },
    { blocklist: "a@s.whatsapp.net", type: "remove" },
  ]);

  assert.deepEqual([...runtimeState.blocklist].sort(), ["b@s.whatsapp.net"]);
});
