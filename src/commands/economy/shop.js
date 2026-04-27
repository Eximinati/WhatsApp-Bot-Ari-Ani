const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "shop",
    aliases: [],
    category: "economy",
    description: "Browse items you can buy with your cash.",
    cooldownSeconds: 4,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const items = ctx.services.economy.getShopItems();
    const lines = items.map(
      (item, index) =>
        `${index + 1}. ${item.name} (${item.key}) - ${formatMoney(item.price)} [${item.type}]`,
    );

    await ctx.services.visuals.sendLeaderboardCard({
      ctx,
      title: "SHOP",
      username: await ctx.services.user.getDisplayName(ctx.msg.sender),
      jid: ctx.msg.sender,
      lines,
      caption: `Use ${ctx.config.prefix}buy <item-key> [quantity]\nUse ${ctx.config.prefix}equip <item-key> for tools\nUse ${ctx.config.prefix}use <item-key> for consumables`,
    });
  },
};
