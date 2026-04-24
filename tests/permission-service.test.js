const test = require("node:test");
const assert = require("node:assert/strict");

const { createPermissionService } = require("../src/services/permission-service");

test("permission service resolves owner and admin access", () => {
  const permissions = createPermissionService({
    ownerJids: ["owner@s.whatsapp.net"],
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
