const test = require("node:test");
const assert = require("node:assert/strict");

const { createMessageEventsHandler } = require("../src/handlers/message-events-handler");

test("message events handler forwards updates deletes reactions and receipts to message store", async () => {
  const calls = [];
  const handler = createMessageEventsHandler({
    logger: { error() {} },
    services: {
      messages: {
        applyUpdates: async (updates) => calls.push(["updates", updates.length]),
        markDeleted: async () => calls.push(["delete"]),
        applyReactions: async (reactions) => calls.push(["reactions", reactions.length]),
        applyReceipts: async (receipts) => calls.push(["receipts", receipts.length]),
      },
    },
  });

  await handler.onMessagesUpdate([{ key: { id: "1" } }]);
  await handler.onMessagesDelete({ keys: [{ id: "1" }] });
  await handler.onMessagesReaction([{ key: { id: "1" } }]);
  await handler.onMessageReceiptUpdate([{ key: { id: "1" } }]);

  assert.deepEqual(calls, [
    ["updates", 1],
    ["delete"],
    ["reactions", 1],
    ["receipts", 1],
  ]);
});
