module.exports = {
  meta: {
    name: "use",
    aliases: [],
    category: "economy",
    description: "Use a consumable item from your inventory.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "<item-key>",
  },
  async execute(ctx) {
    const key = String(ctx.args[0] || "").trim().toLowerCase();
    if (!key) {
      await ctx.reply(`Usage: ${ctx.config.prefix}use <item-key>`);
      return;
    }

    try {
      const result = await ctx.services.economy.useItem(ctx.msg.sender, key);
      await ctx.services.visuals.sendEconomyResultCard({
        ctx,
        title: "BUFF ACTIVATED",
        jid: ctx.msg.sender,
        lines: [
          `Used: ${result.item.name}`,
          `Duration: ${Math.round((result.item.durationMs || 0) / 60000)} min`,
          `Active buffs: ${result.activeBuffs.map((entry) => entry.name).join(", ") || "none"}`,
        ],
        subtitle: "Consumable live",
        chips: ["Inventory", "Use", result.item.type],
        stats: [
          { label: "Item", value: result.item.name },
          { label: "Duration", value: `${Math.round((result.item.durationMs || 0) / 60000)}m` },
          { label: "Buffs", value: String(result.activeBuffs.length) },
        ],
      });
    } catch (error) {
      await ctx.reply(error.message);
    }
  },
};
