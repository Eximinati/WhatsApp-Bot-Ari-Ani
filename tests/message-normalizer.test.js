const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeMessage } = require("../src/core/whatsapp/message-normalizer");

test("normalizeMessage keeps the real group participant as sender for @lid messages", () => {
  const message = normalizeMessage(
    {
      user: { id: "923265825610:1@s.whatsapp.net" },
      sendMessage: async () => {},
    },
    {
      key: {
        remoteJid: "120363419505337488@g.us",
        participant: "58777214701585@lid",
        fromMe: false,
        id: "MSG1",
      },
      pushName: "Tester",
      message: {
        conversation: "/h",
      },
    },
  );

  assert.ok(message);
  assert.equal(message.from, "120363419505337488@g.us");
  assert.equal(message.sender, "58777214701585@lid");
  assert.equal(message.text, "/h");
  assert.equal(message.isGroup, true);
});

test("normalizeMessage extracts quoted message fields without proto conversion", () => {
  const message = normalizeMessage(
    {
      user: { id: "923265825610:1@s.whatsapp.net" },
      sendMessage: async () => {},
    },
    {
      key: {
        remoteJid: "120363419505337488@g.us",
        participant: "58777214701585@lid",
        fromMe: false,
        id: "MSG2",
      },
      pushName: "Tester",
      message: {
        extendedTextMessage: {
          text: "/delete",
          contextInfo: {
            stanzaId: "QUOTED1",
            participant: "923265825610@s.whatsapp.net",
            remoteJid: "120363419505337488@g.us",
            quotedMessage: {
              conversation: "hello there",
            },
          },
        },
      },
    },
  );

  assert.ok(message?.quoted);
  assert.equal(message.quoted.id, "QUOTED1");
  assert.equal(message.quoted.sender, "923265825610@s.whatsapp.net");
  assert.equal(message.quoted.from, "120363419505337488@g.us");
  assert.equal(message.quoted.text, "hello there");
});
