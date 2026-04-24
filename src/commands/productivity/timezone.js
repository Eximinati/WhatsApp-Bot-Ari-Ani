const { isValidTimezone } = require("../../utils/schedule");

module.exports = {
  meta: {
    name: "timezone",
    aliases: ["tz"],
    category: "productivity",
    description: "Show or set your personal timezone.",
    cooldownSeconds: 3,
    access: "user",
    chat: "both",
    usage: "[set <IANA zone>]",
  },
  async execute(ctx) {
    const action = (ctx.args[0] || "").toLowerCase();
    if (action !== "set") {
      await ctx.reply(
        `Your timezone: *${ctx.userSettings.timezone || ctx.config.timezone}*\n` +
        `Use ${ctx.config.prefix}timezone set Asia/Karachi`,
      );
      return;
    }

    const timezone = ctx.args[1];
    if (!isValidTimezone(timezone)) {
      await ctx.reply("Use a valid IANA timezone such as Asia/Karachi or Europe/London.");
      return;
    }

    await ctx.services.settings.setTimezone(ctx.msg.sender, timezone);
    await ctx.reply(`Timezone updated to *${timezone}*.`);
  },
};
