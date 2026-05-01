const { mentionTag, normalizeJid } = require("../../utils/identity-resolver");

module.exports = {
  meta: {
    name: "trust",
    aliases: ["trusted"],
    category: "access",
    description: "Grant trusted access to a user.",
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
      await ctx.reply("Mention, reply to, or provide the number you want to trust.");
      return;
    }

    await ctx.services.settings.setAccessState(target, "trusted", ctx.msg.sender);
    ctx.logger.info(
      {
        area: "ACCESS",
        actor: ctx.msg.sender.split("@")[0],
        target: target.split("@")[0],
        state: "trusted",
      },
      "Access state updated",
    );
    await ctx.reply(`Trusted ${mentionTag(target)}.`, { mentions: [target] });
  },
};
