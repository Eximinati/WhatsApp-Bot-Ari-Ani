const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createGroupParticipantsHandler,
} = require("../src/handlers/group-participants-handler");

test("group participants handler sends welcome messages when enabled", async () => {
  const sent = [];
  const handler = createGroupParticipantsHandler({
    logger: { error() {} },
    services: {
      settings: {
        getGroupSettings: async () => ({
          welcomeEnabled: true,
          welcomeTemplate: "hello {{name}} to {{group}}",
        }),
      },
    },
    groupMetadataCache: {
      refresh: async () => ({ subject: "Test Group", desc: "desc" }),
    },
  });

  const sock = {
    sendMessage: async (jid, payload) => {
      sent.push([jid, payload]);
    },
  };

  await handler(sock, {
    id: "group@g.us",
    action: "add",
    participants: ["user@s.whatsapp.net"],
  });

  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], "group@g.us");
  assert.match(sent[0][1].text, /hello user to Test Group/);
});
