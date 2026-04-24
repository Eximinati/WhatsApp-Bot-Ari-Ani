const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { SettingsService } = require("../src/services/settings-service");

test("settings service migrates legacy db.json when present", async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "ari-ani-migration-"));
  const legacyFile = path.join(rootDir, "db.json");

  fs.writeFileSync(
    legacyFile,
    JSON.stringify({
      ban: ["user@s.whatsapp.net"],
      events: ["group@g.us"],
      customWelcomeMsgs: {
        "group@g.us": "hello {{name}}",
      },
    }),
  );

  const calls = [];
  const service = new SettingsService({
    logger: { warn() {} },
    rootDir,
  });

  service.banUser = async (jid, banned) => {
    calls.push(["ban", jid, banned]);
  };
  service.updateGroupSettings = async (groupJid, patch) => {
    calls.push(["group", groupJid, patch]);
  };

  const result = await service.importLegacyData();
  assert.equal(result.imported, true);
  assert.deepEqual(calls[0], ["ban", "user@s.whatsapp.net", true]);
  assert.equal(calls[1][0], "group");
});
