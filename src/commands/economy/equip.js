module.exports = {
  meta: {
    name: "equip",
    aliases: [],
    category: "economy",
    description: "Equip a tool item from your inventory.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "<item-key>",
  },
  async execute(ctx) {
    const key = String(ctx.args[0] || "").trim().toLowerCase();
    if (!key) {
      await ctx.reply(`Usage: ${ctx.config.prefix}equip <item-key>`);
      return;
    }

    try {
      const result = await ctx.services.economy.equip(ctx.msg.sender, key);
      await ctx.services.visuals.sendEconomyResultCard({
        ctx,
        title: "TOOL EQUIPPED",
        jid: ctx.msg.sender,
        lines: [
          `Equipped: ${result.item.name}`,
          `Key: ${result.item.key}`,
          `Activity: ${result.item.activity || "general"}`,
        ],
        subtitle: "Loadout updated",
        chips: ["Inventory", "Equip", result.item.type],
        stats: [
          { label: "Tool", value: result.item.name },
          { label: "Activity", value: result.item.activity || "general" },
        ],
      });
    } catch (error) {
      await ctx.reply(error.message);
    }
  },
};
