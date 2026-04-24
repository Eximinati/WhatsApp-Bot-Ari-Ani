const test = require("node:test");
const assert = require("node:assert/strict");

const { CooldownService } = require("../src/services/cooldown-service");

test("cooldown service tracks expiry per user and command", () => {
  const service = new CooldownService();
  assert.equal(service.check("u", "help", 2).active, false);

  service.consume("u", "help", 2);
  const active = service.check("u", "help", 2);
  assert.equal(active.active, true);
  assert.ok(active.remainingMs > 0);
});
