const test = require("node:test");
const assert = require("node:assert/strict");

const User = require("../src/models/user");

test("user model writes to isolated bot_users collection", () => {
  assert.equal(User.collection.collectionName, "bot_users");
});
