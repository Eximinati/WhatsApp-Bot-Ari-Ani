module.exports = {
  meta: {
    name: "setcustom",
    aliases: ["setwelcome", "customwelcome"],
    category: "group",
    description: "Set the custom welcome template for this group.",
    cooldownSeconds: 5,
    access: "admin",
    chat: "group",
    usage: "<template>",
  },
  async execute(ctx) {
    if (!ctx.text) {
      await ctx.reply(
        "Provide a template. Supported placeholders: {{name}}, {{group}}, {{description}}",
      );
      return;
    }

    await ctx.services.settings.updateGroupSettings(ctx.msg.from, {
      welcomeEnabled: true,
      welcomeTemplate: ctx.text,
    });
    await ctx.reply("Custom welcome message saved.");
  },
};
