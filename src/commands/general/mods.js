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
    for (const [index, ownerId] of ctx.config.ownerIds.entries()) {
      const displayName = await ctx.services.user.getDisplayName(ownerId);
      lines.push(
        `${index + 1}. ${displayName} - https://wa.me/${ownerId}`,
      );
    }

    if (ctx.config.modIds?.length) {
      lines.push("");
      lines.push("*Bot mods*");
      for (const [index, modId] of ctx.config.modIds.entries()) {
        const displayName = await ctx.services.user.getDisplayName(modId);
        lines.push(
          `${index + 1}. ${displayName} - https://wa.me/${modId}`,
        );
      }
    }

    await ctx.reply(lines.join("\n"));
  },
};
