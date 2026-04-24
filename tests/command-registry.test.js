const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { CommandRegistry } = require("../src/services/command-registry");

test("command registry loads commands and resolves aliases", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ari-ani-commands-"));
  const commandFile = path.join(tempDir, "sample.js");

  fs.writeFileSync(
    commandFile,
    `module.exports = {
      meta: {
        name: "hello",
        aliases: ["hi"],
        category: "general",
        description: "test",
        cooldownSeconds: 1,
        access: "user",
        chat: "both"
      },
      execute() {}
    };`,
  );

  const registry = new CommandRegistry({ commandsRoot: tempDir });
  registry.load();

  assert.equal(registry.get("hello").meta.name, "hello");
  assert.equal(registry.get("hi").meta.name, "hello");
});
