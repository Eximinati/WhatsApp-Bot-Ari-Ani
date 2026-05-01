const { mentionTag, normalizeJid } = require("../../utils/identity-resolver");

module.exports = {
  meta: {
    name: "revoke",
    aliases: ["unpermit"],
    category: "access",
    description: "Remove custom bot access from a user.",
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
      await ctx.reply("Mention, reply to, or provide the number you want to revoke.");
      return;
    }

    await ctx.services.settings.setAccessState(target, "none", ctx.msg.sender);
    ctx.logger.info(
      {
        area: "ACCESS",
        actor: ctx.msg.sender.split("@")[0],
        target: target.split("@")[0],
        state: "none",
      },
      "Access state updated",
    );
    await ctx.reply(`Revoked custom access from ${mentionTag(target)}.`, { mentions: [target] });
  },
};
