const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "buy",
    aliases: [],
    category: "economy",
    description: "Buy an item from the shop.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "<item-key> [quantity]",
  },
  async execute(ctx) {
    const key = String(ctx.args[0] || "").trim().toLowerCase();
    if (!key) {
      await ctx.reply(`Usage: ${ctx.config.prefix}buy <item-key> [quantity]`);
      return;
    }

    try {
      const result = await ctx.services.economy.buy(
        ctx.msg.sender,
        key,
        ctx.args[1] || "1",
      );
      await ctx.services.visuals.sendEconomyResultCard({
        ctx,
        title: "PURCHASE COMPLETE",
        jid: ctx.msg.sender,
        lines: [
          `Item: ${result.item.name}`,
          `Type: ${result.item.type}`,
          `Quantity: ${result.quantity}`,
          `Cost: ${formatMoney(result.totalPrice)}`,
          `Wallet: ${formatMoney(result.account.wallet)}`,
        ],
        subtitle: "Shop checkout",
        chips: ["Shop", result.item.type, `x${result.quantity}`],
        stats: [
          { label: "Spent", value: formatMoney(result.totalPrice) },
          { label: "Wallet", value: formatMoney(result.account.wallet) },
          { label: "Bank", value: formatMoney(result.account.bank) },
          { label: "Wealth", value: formatMoney(result.account.totalWealth) },
        ],
        caption: `Purchased ${result.quantity}x ${result.item.name}. Use ${ctx.config.prefix}equip for tools or ${ctx.config.prefix}use for consumables.`,
      });
    } catch (error) {
      await ctx.reply(error.message);
    }
  },
};
