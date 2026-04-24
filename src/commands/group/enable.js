module.exports = {
  meta: {
    name: "enable",
    aliases: ["on"],
    category: "group",
    description: "Enable welcome messages or anti-invite protection for this group.",
    cooldownSeconds: 5,
    access: "admin",
    chat: "group",
    usage: "<welcome|antilink>",
  },
  async execute(ctx) {
    const feature = ctx.args[0]?.toLowerCase();
    if (!["welcome", "antilink"].includes(feature)) {
      await ctx.reply(`Usage: ${ctx.config.prefix}enable <welcome|antilink>`);
      return;
    }

    const patch =
      feature === "welcome"
        ? { welcomeEnabled: true }
        : { antiInviteEnabled: true };
    await ctx.services.settings.updateGroupSettings(ctx.msg.from, patch);
    await ctx.reply(`${feature} is now enabled for this group.`);
  },
};
