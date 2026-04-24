module.exports = {
  meta: {
    name: "disable",
    aliases: ["off"],
    category: "group",
    description: "Disable welcome messages or anti-invite protection for this group.",
    cooldownSeconds: 5,
    access: "admin",
    chat: "group",
    usage: "<welcome|antilink>",
  },
  async execute(ctx) {
    const feature = ctx.args[0]?.toLowerCase();
    if (!["welcome", "antilink"].includes(feature)) {
      await ctx.reply(`Usage: ${ctx.config.prefix}disable <welcome|antilink>`);
      return;
    }

    const patch =
      feature === "welcome"
        ? { welcomeEnabled: false }
        : { antiInviteEnabled: false };
    await ctx.services.settings.updateGroupSettings(ctx.msg.from, patch);
    await ctx.reply(`${feature} is now disabled for this group.`);
  },
};
