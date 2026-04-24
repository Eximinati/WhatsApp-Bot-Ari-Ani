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
        "Core features retained: admin tools, group tools, profiles, stickers, search, and QR session management.",
      ].join("\n"),
    );
  },
};
