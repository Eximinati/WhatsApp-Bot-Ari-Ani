const test = require("node:test");
const assert = require("node:assert/strict");

const { createContactsHandler } = require("../src/handlers/contacts-handler");

test("contacts handler upserts each contact", async () => {
  const seen = [];
  const handler = createContactsHandler({
    logger: { warn() {} },
    services: {
      user: {
        upsertContacts: async (contacts) => {
          for (const contact of contacts) {
            seen.push([contact.id, contact.notify || contact.name]);
          }
        },
      },
    },
  });

  await handler([
    { id: "a@s.whatsapp.net", notify: "A" },
    { id: "b@s.whatsapp.net", name: "B" },
  ]);

  assert.deepEqual(seen, [
    ["a@s.whatsapp.net", "A"],
    ["b@s.whatsapp.net", "B"],
  ]);
});
