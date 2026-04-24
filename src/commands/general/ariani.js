module.exports = {
  meta: {
    name: "ariani",
    aliases: ["about", "botinfo"],
    category: "general",
    description: "Show information about the refactored bot runtime.",
    cooldownSeconds: 5,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    await ctx.reply(
      [
        `*${ctx.config.botName}*`,
        "Refactored for a modular, production-ready Baileys runtime.",
        `Prefix: ${ctx.config.prefix}`,
        `Owners: ${ctx.config.ownerJids.length}`,
        `Mods: ${ctx.config.modJids?.length || 0}`,
        `Private mode: ${ctx.config.privateBot ? "enabled" : "disabled"}`,
        "Core features: access control, reminders, notes, XP games, search, status saving, and VU study sync.",
      ].join("\n"),
    );
  },
};
