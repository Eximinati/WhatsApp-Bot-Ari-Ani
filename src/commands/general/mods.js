module.exports = {
  meta: {
    name: "mods",
    aliases: ["owners"],
    category: "general",
    description: "Show the configured bot owners.",
    cooldownSeconds: 5,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const lines = ["*Bot owners*"];
    for (const [index, ownerJid] of ctx.config.ownerJids.entries()) {
      const displayName = await ctx.services.user.getDisplayName(ownerJid);
      lines.push(
        `${index + 1}. ${displayName} - https://wa.me/${ownerJid.split("@")[0]}`,
      );
    }

    await ctx.reply(lines.join("\n"));
  },
};
