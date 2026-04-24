const { resolveTimezone } = require("../../utils/schedule");

module.exports = {
  meta: {
    name: "remind",
    aliases: ["reminder"],
    category: "productivity",
    description: "Create, cancel, or snooze reminders.",
    cooldownSeconds: 3,
    access: "user",
    chat: "both",
    usage: "<dm|here> <time> <text> | cancel <id> | snooze <id> <time>",
  },
  async execute(ctx) {
    const action = (ctx.args[0] || "").toLowerCase();
    const timezone = resolveTimezone(ctx.config, ctx.userSettings);

    const parseScheduleAndText = (startIndex) => {
      let scheduleInput = ctx.args[startIndex] || "";
      let textStart = startIndex + 1;
      if (
        /^\d{4}-\d{2}-\d{2}$/.test(ctx.args[startIndex] || "") &&
        /^\d{2}:\d{2}$/.test(ctx.args[startIndex + 1] || "")
      ) {
        scheduleInput = `${ctx.args[startIndex]} ${ctx.args[startIndex + 1]}`;
        textStart = startIndex + 2;
      }

      return {
        scheduleInput,
        text: ctx.args.slice(textStart).join(" ").trim(),
      };
    };

    if (action === "cancel") {
      const reminder = await ctx.services.reminders.cancelReminder(ctx.msg.sender, ctx.args[1]);
      await ctx.reply(reminder ? "Reminder cancelled." : "Reminder not found.");
      return;
    }

    if (action === "snooze") {
      const { scheduleInput } = parseScheduleAndText(2);
      const reminder = await ctx.services.reminders.snoozeReminder(
        ctx.msg.sender,
        ctx.args[1],
        scheduleInput,
        timezone,
      );
      await ctx.reply(reminder ? "Reminder snoozed." : "Reminder not found.");
      return;
    }

    if (!["dm", "here"].includes(action) || ctx.args.length < 3) {
      await ctx.reply(
        `Usage: ${ctx.config.prefix}remind dm 10m drink water\n` +
        `or ${ctx.config.prefix}remind here 2026-04-25 09:00 team standup`,
      );
      return;
    }

    const { scheduleInput, text } = parseScheduleAndText(1);
    if (!text) {
      await ctx.reply("Please include reminder text after the time.");
      return;
    }

    const reminder = await ctx.services.reminders.createReminder({
      userJid: ctx.msg.sender,
      chatJid: ctx.msg.from,
      delivery: action,
      scheduleInput,
      text,
      timezone,
    });

    ctx.logger.info(
      {
        area: "REMINDER",
        sender: ctx.msg.sender.split("@")[0],
        reminderId: String(reminder._id).slice(-6),
        delivery: action,
      },
      "Reminder created",
    );
    await ctx.reply(`Reminder saved as #${String(reminder._id).slice(-6)}.`);
  },
};
