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

    if (ctx.config.modJids?.length) {
      lines.push("");
      lines.push("*Bot mods*");
      for (const [index, modJid] of ctx.config.modJids.entries()) {
        const displayName = await ctx.services.user.getDisplayName(modJid);
        lines.push(
          `${index + 1}. ${displayName} - https://wa.me/${modJid.split("@")[0]}`,
        );
      }
    }

    await ctx.reply(lines.join("\n"));
  },
};
