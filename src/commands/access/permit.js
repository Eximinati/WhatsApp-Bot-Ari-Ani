const { mentionTag, normalizeJid } = require("../../utils/jid");

module.exports = {
  meta: {
    name: "permit",
    aliases: ["allow"],
    category: "access",
    description: "Permit a user to use the bot in private mode.",
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
      await ctx.reply("Mention, reply to, or provide the number you want to permit.");
      return;
    }

    await ctx.services.settings.setAccessState(target, "allowed", ctx.msg.sender);
    ctx.logger.info(
      {
        area: "ACCESS",
        actor: ctx.msg.sender.split("@")[0],
        target: target.split("@")[0],
        state: "allowed",
      },
      "Access state updated",
    );
    await ctx.reply(`Permitted ${mentionTag(target)}.`, { mentions: [target] });
  },
};
