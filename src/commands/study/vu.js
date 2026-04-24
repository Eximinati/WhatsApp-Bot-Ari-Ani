const { resolveTimezone } = require("../../utils/schedule");
const {
  formatAssignments,
  openVuAlertsMenu,
  openVuLoginMenu,
  openVuMainMenu,
  renderAlertsMenu,
  renderAlertStatus,
  renderLoginUsernamePrompt,
  renderMainMenu,
} = require("../../services/vu-menu");

module.exports = {
  meta: {
    name: "vu",
    aliases: [],
    category: "study",
    description: "Open the guided VU assistant menu or run a direct VU action.",
    cooldownSeconds: 5,
    access: "user",
    chat: "private",
    usage:
      "[menu] | login [username] [password] | logout | status | refresh | assignments | calendar | today | upcoming | alerts",
  },
  async execute(ctx) {
    const action = (ctx.args[0] || "").toLowerCase();

    if (!action || ["menu", "start", "home"].includes(action)) {
      const status = await ctx.services.vu.getStatus(ctx.msg.sender);
      await openVuMainMenu({ services: ctx.services, userJid: ctx.msg.sender });
      await ctx.reply(renderMainMenu(status));
      return;
    }

    if (action === "login") {
      const username = ctx.args[1];
      const password = ctx.args[2];
      if (!username || !password) {
        await openVuLoginMenu({ services: ctx.services, userJid: ctx.msg.sender });
        await ctx.reply(renderLoginUsernamePrompt());
        return;
      }

      try {
        const result = await ctx.services.vu.login(ctx.msg.sender, username, password);
        await openVuMainMenu({ services: ctx.services, userJid: ctx.msg.sender });
        await ctx.reply(
          [
            "*VU login successful*",
            "Your credentials were verified and saved securely.",
            `Calendar items detected: ${result.assignments.length}`,
            "",
            renderMainMenu(await ctx.services.vu.getStatus(ctx.msg.sender)),
          ].join("\n"),
        );
      } catch (error) {
        await ctx.reply(error.message);
      }
      return;
    }

    if (action === "logout") {
      await ctx.services.vu.logout(ctx.msg.sender);
      await openVuMainMenu({ services: ctx.services, userJid: ctx.msg.sender });
      await ctx.reply(
        ["VU account disconnected.", "", renderMainMenu(await ctx.services.vu.getStatus(ctx.msg.sender))].join("\n"),
      );
      return;
    }

    if (action === "status") {
      const status = await ctx.services.vu.getStatus(ctx.msg.sender);
      await ctx.reply(
        [
          "*VU Status*",
          `Connected: ${status.connected ? "yes" : "no"}`,
          `Username: ${status.username || "-"}`,
          `Alerts: ${status.alertsMode}`,
          `Daily digest: ${status.dailyDigestEnabled ? "on" : "off"}`,
          `Before deadline: ${
            status.deadlineReminderLabels?.length ? status.deadlineReminderLabels.join(", ") : "off"
          }`,
          `Last sync: ${status.lastSyncAt || "-"}`,
          status.lastError ? `Last error: ${status.lastError}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
      return;
    }

    if (action === "refresh") {
      try {
        const { assignments } = await ctx.services.vu.sync(ctx.msg.sender);
        await ctx.reply(
          [
            "*VU refreshed*",
            `Items synced: ${assignments.length}`,
          ].join("\n"),
        );
      } catch (error) {
        await ctx.reply(error.message || "VU refresh failed.");
      }
      return;
    }

    if (action === "alerts") {
      const subAction = (ctx.args[1] || "").toLowerCase();
      if (!subAction || ["menu", "start"].includes(subAction)) {
        const status = await ctx.services.vu.getStatus(ctx.msg.sender);
        await openVuAlertsMenu({ services: ctx.services, userJid: ctx.msg.sender });
        await ctx.reply(renderAlertsMenu(status));
        return;
      }

      if (subAction === "status") {
        const status = await ctx.services.vu.getStatus(ctx.msg.sender);
        await ctx.reply(renderAlertStatus(status));
        return;
      }

      if (["off", "daily", "deadline", "all"].includes(subAction)) {
        const account = await ctx.services.vu.setAlerts(ctx.msg.sender, subAction);
        const settings = ctx.services.vu.getAlertSettings(account);
        await ctx.services.settings.updateUserSettings(ctx.msg.sender, { vuAlertMode: settings.alertsMode });
        await ctx.reply(renderAlertStatus(settings));
        return;
      }

      if (subAction === "daily") {
        const value = (ctx.args[2] || "").toLowerCase();
        if (!["on", "off"].includes(value)) {
          await ctx.reply("Usage: /vu alerts daily <on|off>");
          return;
        }

        const account = await ctx.services.vu.updateAlertPreferences(ctx.msg.sender, {
          dailyDigestEnabled: value === "on",
        });
        const settings = ctx.services.vu.getAlertSettings(account);
        await ctx.services.settings.updateUserSettings(ctx.msg.sender, { vuAlertMode: settings.alertsMode });
        await ctx.reply(renderAlertStatus(settings));
        return;
      }

      if (subAction === "before") {
        const raw = ctx.args.slice(2).join(" ").trim();
        if (!raw) {
          await ctx.reply("Usage: /vu alerts before <1d,6h,30m|off>");
          return;
        }

        let deadlineReminderMinutes = [];
        try {
          deadlineReminderMinutes =
            raw.toLowerCase() === "off" ? [] : ctx.services.vu.parseReminderOffsets(raw);
        } catch (error) {
          await ctx.reply(error.message);
          return;
        }

        const account = await ctx.services.vu.updateAlertPreferences(ctx.msg.sender, {
          deadlineReminderMinutes,
        });
        const settings = ctx.services.vu.getAlertSettings(account);
        await ctx.services.settings.updateUserSettings(ctx.msg.sender, { vuAlertMode: settings.alertsMode });
        await ctx.reply(renderAlertStatus(settings));
        return;
      }

      await ctx.reply("Use /vu alerts to open the guided alerts menu.");
      return;
    }

    try {
      if (action === "assignments") {
        const assignments = await ctx.services.vu.getAssignments(ctx.msg.sender);
        await ctx.reply(
          assignments.length
            ? `*VU Assignments*\n${formatAssignments(assignments.slice(0, 10)).join("\n")}`
            : "No assignments were found.",
        );
        return;
      }

      if (action === "calendar") {
        const calendar = await ctx.services.vu.getCalendar(ctx.msg.sender);
        await ctx.reply(
          calendar.length
            ? `*VU Calendar*\n${calendar
              .slice(0, 10)
              .map((item) => `- ${item.title} (${item.dueAt || "no date"})`)
              .join("\n")}`
            : "No calendar items were found.",
        );
        return;
      }

      if (action === "upcoming") {
        const items = await ctx.services.vu.getUpcoming(ctx.msg.sender);
        await ctx.reply(
          items.length
            ? `*VU Upcoming*\n${formatAssignments(items).join("\n")}`
            : "No upcoming VU items were found.",
        );
        return;
      }

      if (action === "today") {
        const timezone = resolveTimezone(ctx.config, ctx.userSettings);
        const items = await ctx.services.vu.getToday(ctx.msg.sender, timezone);
        await ctx.reply(
          items.length
            ? `*VU Today*\n${formatAssignments(items).join("\n")}`
            : "Nothing is due today.",
        );
        return;
      }
    } catch (error) {
      await ctx.reply(error.message || "VU request failed.");
      return;
    }

    await openVuMainMenu({ services: ctx.services, userJid: ctx.msg.sender });
    await ctx.reply(
      [
        "Unknown VU option. Opening the VU menu instead.",
        "",
        renderMainMenu(await ctx.services.vu.getStatus(ctx.msg.sender)),
      ].join("\n"),
    );
  },
};
