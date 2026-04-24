const { resolveTimezone } = require("../utils/schedule");

const MENU_VERSION = 1;

function formatAssignments(items) {
  return items.map((item) => `- ${item.title} (${item.dueText || "no due date"})`);
}

function parseMenuState(raw) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.step) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function saveMenuState(services, jid, state) {
  return services.settings.updateUserSettings(jid, {
    vuMenuStateJson: JSON.stringify({
      version: MENU_VERSION,
      updatedAt: Date.now(),
      ...state,
    }),
  });
}

async function clearMenuState(services, jid) {
  return services.settings.updateUserSettings(jid, {
    vuMenuStateJson: "",
  });
}

function isMenuReply(text) {
  const value = String(text || "").trim().toLowerCase();
  if (!value) {
    return false;
  }

  return /^\d+$/.test(value) || ["back", "menu", "cancel", "exit", "0"].includes(value);
}

async function openVuMainMenu({ services, userJid }) {
  await saveMenuState(services, userJid, { step: "main" });
}

async function openVuAlertsMenu({ services, userJid }) {
  await saveMenuState(services, userJid, { step: "alerts" });
}

async function openVuLoginMenu({ services, userJid }) {
  await saveMenuState(services, userJid, { step: "login_username" });
}

function renderMainMenu(status) {
  return [
    "*VU Menu*",
    `Connected: ${status.connected ? "yes" : "no"}`,
    "",
    "1. Connect or reconnect VU",
    "2. Check status",
    "3. View assignments",
    "4. View calendar",
    "5. View today's items",
    "6. View upcoming items",
    "7. Refresh VU data",
    "8. Alert settings",
    "9. Logout",
    "0. Exit",
    "",
    "Reply with a number.",
  ].join("\n");
}

function renderAlertStatus(status) {
  return [
    "*VU Alert Settings*",
    `Mode: ${status.alertsMode}`,
    `Daily digest: ${status.dailyDigestEnabled ? "on" : "off"}`,
    `Before deadline: ${
      status.deadlineReminderLabels?.length ? status.deadlineReminderLabels.join(", ") : "off"
    }`,
  ].join("\n");
}

function renderAlertsMenu(status) {
  return [
    renderAlertStatus(status),
    "",
    "1. Show current settings",
    "2. Turn daily digest on",
    "3. Turn daily digest off",
    "4. Remind 1 day before",
    "5. Remind 6 hours before",
    "6. Remind 1 day + 6 hours before",
    "7. Remind 1 day + 3 hours + 30 minutes before",
    "8. Turn deadline reminders off",
    "9. Turn all alerts off",
    "0. Back",
    "",
    "Reply with a number.",
  ].join("\n");
}

function renderLoginUsernamePrompt() {
  return [
    "*Connect VU*",
    "Send your VU username.",
    "Reply with `0` to cancel.",
  ].join("\n");
}

function renderLoginPasswordPrompt(username) {
  return [
    "*Connect VU*",
    `Username: ${username}`,
    "Now send your VU password.",
    "Reply with `back` to change username or `0` to cancel.",
  ].join("\n");
}

function renderResultWithMenu(resultText, menuText) {
  return [resultText, "", menuText].filter(Boolean).join("\n");
}

async function maybeHandleVuMenuReply({
  config,
  message,
  services,
  userSettings,
}) {
  if (message.isGroup || !message.text) {
    return false;
  }

  const state = parseMenuState(userSettings?.vuMenuStateJson);
  if (!state) {
    return false;
  }

  const text = String(message.text || "").trim();
  if (!text || text.startsWith(config.prefix)) {
    return false;
  }

  if (!isMenuReply(text) && !["login_username", "login_password"].includes(state.step)) {
    return false;
  }

  const choice = text.toLowerCase();
  const sender = message.sender;

  if (state.step === "login_username") {
    if (["0", "cancel", "exit"].includes(choice)) {
      const status = await services.vu.getStatus(sender);
      await openVuMainMenu({ services, userJid: sender });
      await message.reply(renderMainMenu(status));
      return true;
    }

    await saveMenuState(services, sender, {
      step: "login_password",
      username: text,
    });
    await message.reply(renderLoginPasswordPrompt(text));
    return true;
  }

  if (state.step === "login_password") {
    if (["0", "cancel", "exit"].includes(choice)) {
      const status = await services.vu.getStatus(sender);
      await openVuMainMenu({ services, userJid: sender });
      await message.reply(renderMainMenu(status));
      return true;
    }

    if (["back", "menu"].includes(choice)) {
      await openVuLoginMenu({ services, userJid: sender });
      await message.reply(renderLoginUsernamePrompt());
      return true;
    }

    try {
      const result = await services.vu.login(sender, state.username, text);
      const status = await services.vu.getStatus(sender);
      await openVuMainMenu({ services, userJid: sender });
      await message.reply(
        renderResultWithMenu(
          [
            "*VU login successful*",
            "Your credentials were verified and saved securely.",
            `Calendar items detected: ${result.assignments.length}`,
          ].join("\n"),
          renderMainMenu(status),
        ),
      );
    } catch (error) {
      await message.reply(
        [
          error.message || "VU login failed.",
          "",
          "Send your password again, or reply with `back` to change username.",
        ].join("\n"),
      );
    }
    return true;
  }

  if (["cancel", "exit"].includes(choice)) {
    await clearMenuState(services, sender);
    await message.reply("VU menu closed.");
    return true;
  }

  if (state.step === "alerts") {
    if (choice === "0" || choice === "back") {
      const status = await services.vu.getStatus(sender);
      await openVuMainMenu({ services, userJid: sender });
      await message.reply(renderMainMenu(status));
      return true;
    }

    let account = null;
    try {
      switch (choice) {
        case "1":
          break;
        case "2":
          account = await services.vu.updateAlertPreferences(sender, {
            dailyDigestEnabled: true,
          });
          break;
        case "3":
          account = await services.vu.updateAlertPreferences(sender, {
            dailyDigestEnabled: false,
          });
          break;
        case "4":
          account = await services.vu.updateAlertPreferences(sender, {
            deadlineReminderMinutes: [24 * 60],
          });
          break;
        case "5":
          account = await services.vu.updateAlertPreferences(sender, {
            deadlineReminderMinutes: [6 * 60],
          });
          break;
        case "6":
          account = await services.vu.updateAlertPreferences(sender, {
            deadlineReminderMinutes: [24 * 60, 6 * 60],
          });
          break;
        case "7":
          account = await services.vu.updateAlertPreferences(sender, {
            deadlineReminderMinutes: [24 * 60, 3 * 60, 30],
          });
          break;
        case "8":
          account = await services.vu.updateAlertPreferences(sender, {
            deadlineReminderMinutes: [],
          });
          break;
        case "9":
          account = await services.vu.setAlerts(sender, "off");
          break;
        default:
          await message.reply("Reply with a valid number from the VU alerts menu.");
          return true;
      }

      const settings = account
        ? services.vu.getAlertSettings(account)
        : await services.vu.getStatus(sender);
      await services.settings.updateUserSettings(sender, {
        vuAlertMode: settings.alertsMode,
      });
      await openVuAlertsMenu({ services, userJid: sender });
      await message.reply(renderAlertsMenu(settings));
    } catch (error) {
      await message.reply(error.message || "Failed to update VU alerts.");
    }
    return true;
  }

  if (state.step === "main") {
    if (choice === "0") {
      await clearMenuState(services, sender);
      await message.reply("VU menu closed.");
      return true;
    }

    try {
      switch (choice) {
        case "1":
          await openVuLoginMenu({ services, userJid: sender });
          await message.reply(renderLoginUsernamePrompt());
          return true;
        case "2": {
          const status = await services.vu.getStatus(sender);
          await openVuMainMenu({ services, userJid: sender });
          await message.reply(
            renderResultWithMenu(
              [
                "*VU Status*",
                `Connected: ${status.connected ? "yes" : "no"}`,
                `Username: ${status.username || "-"}`,
                `Alerts: ${status.alertsMode}`,
                `Last sync: ${status.lastSyncAt || "-"}`,
                status.lastError ? `Last error: ${status.lastError}` : "",
              ]
                .filter(Boolean)
                .join("\n"),
              renderMainMenu(status),
            ),
          );
          return true;
        }
        case "3": {
          const assignments = await services.vu.getAssignments(sender);
          const status = await services.vu.getStatus(sender);
          await openVuMainMenu({ services, userJid: sender });
          await message.reply(
            renderResultWithMenu(
              assignments.length
                ? `*VU Assignments*\n${formatAssignments(assignments.slice(0, 10)).join("\n")}`
                : "No assignments were found.",
              renderMainMenu(status),
            ),
          );
          return true;
        }
        case "4": {
          const calendar = await services.vu.getCalendar(sender);
          const status = await services.vu.getStatus(sender);
          await openVuMainMenu({ services, userJid: sender });
          await message.reply(
            renderResultWithMenu(
              calendar.length
                ? `*VU Calendar*\n${calendar
                  .slice(0, 10)
                  .map((item) => `- ${item.title} (${item.dueAt || "no date"})`)
                  .join("\n")}`
                : "No calendar items were found.",
              renderMainMenu(status),
            ),
          );
          return true;
        }
        case "5": {
          const timezone = resolveTimezone(config, userSettings);
          const items = await services.vu.getToday(sender, timezone);
          const status = await services.vu.getStatus(sender);
          await openVuMainMenu({ services, userJid: sender });
          await message.reply(
            renderResultWithMenu(
              items.length
                ? `*VU Today*\n${formatAssignments(items).join("\n")}`
                : "Nothing is due today.",
              renderMainMenu(status),
            ),
          );
          return true;
        }
        case "6": {
          const items = await services.vu.getUpcoming(sender);
          const status = await services.vu.getStatus(sender);
          await openVuMainMenu({ services, userJid: sender });
          await message.reply(
            renderResultWithMenu(
              items.length
                ? `*VU Upcoming*\n${formatAssignments(items).join("\n")}`
                : "No upcoming VU items were found.",
              renderMainMenu(status),
            ),
          );
          return true;
        }
        case "7": {
          const result = await services.vu.sync(sender);
          const status = await services.vu.getStatus(sender);
          await openVuMainMenu({ services, userJid: sender });
          await message.reply(
            renderResultWithMenu(
              `*VU refreshed*\nItems synced: ${result.assignments.length}`,
              renderMainMenu(status),
            ),
          );
          return true;
        }
        case "8": {
          const status = await services.vu.getStatus(sender);
          await openVuAlertsMenu({ services, userJid: sender });
          await message.reply(renderAlertsMenu(status));
          return true;
        }
        case "9": {
          await services.vu.logout(sender);
          const status = await services.vu.getStatus(sender);
          await openVuMainMenu({ services, userJid: sender });
          await message.reply(
            renderResultWithMenu("VU account disconnected.", renderMainMenu(status)),
          );
          return true;
        }
        default:
          await message.reply("Reply with a valid number from the VU menu.");
          return true;
      }
    } catch (error) {
      const status = await services.vu.getStatus(sender).catch(() => ({
        connected: false,
      }));
      await openVuMainMenu({ services, userJid: sender });
      await message.reply(
        renderResultWithMenu(
          error.message || "VU request failed.",
          renderMainMenu(status),
        ),
      );
      return true;
    }
  }

  return false;
}

module.exports = {
  clearMenuState,
  formatAssignments,
  maybeHandleVuMenuReply,
  openVuAlertsMenu,
  openVuLoginMenu,
  openVuMainMenu,
  parseMenuState,
  renderAlertsMenu,
  renderAlertStatus,
  renderLoginPasswordPrompt,
  renderLoginUsernamePrompt,
  renderMainMenu,
};
