const test = require("node:test");
const assert = require("node:assert/strict");

const { decryptString, encryptString } = require("../src/utils/secure-store");

test("secure store encrypts and decrypts payloads", () => {
  const encrypted = encryptString('{"hello":"world"}', "secret-key");
  assert.notEqual(encrypted, '{"hello":"world"}');
  assert.equal(decryptString(encrypted, "secret-key"), '{"hello":"world"}');
});
