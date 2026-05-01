const { normalizeJid } = require("../../utils/identity-resolver");

module.exports = {
  meta: {
    name: "whoisaccess",
    aliases: ["accessof"],
    category: "access",
    description: "Show a user's current bot access state.",
    cooldownSeconds: 3,
    access: "staff",
    chat: "both",
    usage: "@user",
  },
  async execute(ctx) {
    const target =
      ctx.msg.mentions[0] ||
      ctx.msg.quoted?.sender ||
      normalizeJid(ctx.args[0]);
    if (!target) {
      await ctx.reply("Mention, reply to, or provide the number you want to inspect.");
      return;
    }

    const settings = await ctx.services.settings.getUserSettings(target);
    const state = settings.accessState || "none";
    await ctx.reply(`Access for @${target.split("@")[0]}: *${state}*`, {
      mentions: [target],
    });
  },
};
