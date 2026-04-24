module.exports = {
  meta: {
    name: "reminders",
    aliases: ["myreminders"],
    category: "productivity",
    description: "List your pending reminders.",
    cooldownSeconds: 5,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const reminders = await ctx.services.reminders.listReminders(ctx.msg.sender);
    if (!reminders.length) {
      await ctx.reply("You have no pending reminders.");
      return;
    }

    const lines = ["*Your reminders*"];
    for (const reminder of reminders.slice(0, 10)) {
      lines.push(`- ${ctx.services.reminders.formatReminder(reminder)}: ${reminder.text}`);
    }
    await ctx.reply(lines.join("\n"));
  },
};
