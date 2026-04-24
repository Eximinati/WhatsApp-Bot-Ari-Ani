const test = require("node:test");
const assert = require("node:assert/strict");

const { ActiveInstanceService } = require("../src/services/active-instance-service");
const RuntimeLease = require("../src/models/runtime-lease");

test("active instance service builds a future expiry", () => {
  const service = new ActiveInstanceService({
    config: {
      runtime: {
        leaseMs: 90_000,
      },
    },
    logger: {
      info() {},
      warn() {},
      error() {},
    },
    key: "whatsapp-session:test",
    ownerId: "instance-a",
    ownerLabel: "generic:instance-a",
  });

  const now = new Date("2026-04-24T10:00:00.000Z");
  const expiry = service.createExpiry(now);

  assert.equal(expiry.toISOString(), "2026-04-24T10:01:30.000Z");
});

test("runtime lease model uses the deployment lease collection", () => {
  assert.equal(RuntimeLease.collection.collectionName, "bot_runtime_leases");
});
