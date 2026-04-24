const test = require("node:test");
const assert = require("node:assert/strict");

const {
  maybeHandleVuMenuReply,
  renderMainMenu,
} = require("../src/services/vu-menu");

test("vu menu handles a plain-number reply for assignments", async () => {
  const replies = [];
  let storedState = null;

  const handled = await maybeHandleVuMenuReply({
    config: { prefix: "/", timezone: "UTC" },
    message: {
      isGroup: false,
      text: "3",
      sender: "user@s.whatsapp.net",
      reply: async (text) => {
        replies.push(text);
      },
    },
    services: {
      settings: {
        updateUserSettings: async (_jid, patch) => {
          storedState = patch.vuMenuStateJson;
        },
      },
      vu: {
        getAssignments: async () => [
          {
            title: "CS301: Assignment# 1",
            dueText: "23 Apr 2026 to 01 May 2026",
          },
        ],
        getStatus: async () => ({
          connected: true,
          username: "BC260230194",
          alertsMode: "all",
          dailyDigestEnabled: true,
          deadlineReminderLabels: ["6h", "1d"],
          lastSyncAt: null,
          lastError: "",
        }),
      },
    },
    userSettings: {
      vuMenuStateJson: JSON.stringify({ step: "main" }),
    },
  });

  assert.equal(handled, true);
  assert.match(replies[0], /\*VU Assignments\*/);
  assert.match(replies[0], /\*VU Menu\*/);
  assert.match(String(storedState || ""), /"step":"main"/);
});

test("renderMainMenu shows the numbered VU options", () => {
  const text = renderMainMenu({
    connected: true,
  });

  assert.match(text, /1\. Connect or reconnect VU/);
  assert.match(text, /8\. Alert settings/);
  assert.match(text, /0\. Exit/);
});
