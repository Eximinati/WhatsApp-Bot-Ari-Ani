const test = require("node:test");
const assert = require("node:assert/strict");

const { createPermissionService } = require("../src/services/permission-service");

test("permission service resolves owner and admin access", () => {
  const permissions = createPermissionService({
    ownerJids: ["owner@s.whatsapp.net"],
    modJids: ["mod@s.whatsapp.net"],
    privateBot: true,
  });

  const context = permissions.getPermissionContext(
    { sender: "admin@s.whatsapp.net", isGroup: true },
    {
      participants: [
        { id: "admin@s.whatsapp.net", admin: "admin" },
        { id: "member@s.whatsapp.net", admin: null },
      ],
    },
    "bot@s.whatsapp.net",
  );

  assert.equal(context.isAdmin, true);
  assert.equal(permissions.hasAccess("admin", context), true);
  assert.equal(permissions.hasAccess("owner", context), false);
  assert.equal(permissions.chatAllowed("group", { isGroup: true }), true);
});

test("permission service supports trusted access and private bot gating", () => {
  const permissions = createPermissionService({
    ownerJids: ["owner@s.whatsapp.net"],
    modJids: ["mod@s.whatsapp.net"],
    privateBot: true,
  });

  const allowed = permissions.getPermissionContext(
    { sender: "allowed@s.whatsapp.net", isGroup: false },
    null,
    null,
    { accessState: "allowed" },
  );
  const trusted = permissions.getPermissionContext(
    { sender: "trusted@s.whatsapp.net", isGroup: false },
    null,
    null,
    { accessState: "trusted" },
  );
  const stranger = permissions.getPermissionContext(
    { sender: "stranger@s.whatsapp.net", isGroup: false },
    null,
    null,
    { accessState: "none" },
  );

  assert.equal(permissions.canUseBot(allowed), true);
  assert.equal(permissions.canUseBot(trusted), true);
  assert.equal(permissions.canUseBot(stranger), false);
  assert.equal(permissions.hasAccess("trusted", trusted), true);
  assert.equal(permissions.hasAccess("trusted", allowed), false);
});
