const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "deposit",
    aliases: ["dep"],
    category: "economy",
    description: "Move money from your wallet into your bank.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "<amount|all>",
  },
  async execute(ctx) {
    try {
      const result = await ctx.services.economy.deposit(ctx.msg.sender, ctx.args[0]);
      await ctx.services.visuals.sendEconomyResultCard({
        ctx,
        title: "DEPOSIT COMPLETE",
        jid: ctx.msg.sender,
        lines: [
          `Moved: ${formatMoney(result.amount)}`,
          `Wallet: ${formatMoney(result.account.wallet)}`,
          `Bank: ${formatMoney(result.account.bank)}`,
        ],
        subtitle: "Wallet to vault",
        chips: ["Banking", "Deposit"],
        stats: [
          { label: "Moved", value: formatMoney(result.amount) },
          { label: "Wallet", value: formatMoney(result.account.wallet) },
          { label: "Bank", value: formatMoney(result.account.bank) },
          { label: "Wealth", value: formatMoney(result.account.totalWealth) },
        ],
      });
    } catch (error) {
      await ctx.reply(error.message);
    }
  },
};
