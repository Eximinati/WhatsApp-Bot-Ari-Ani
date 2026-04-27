const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "crime",
    aliases: [],
    category: "economy",
    description: "Take a risky chance for a bigger payout.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const result = await ctx.services.economy.crime(ctx.msg.sender);
    if (!result.ok) {
      await ctx.services.visuals.sendEconomyResultCard({
        ctx,
        title: "CRIME COOLDOWN",
        jid: ctx.msg.sender,
        lines: [
          `Try again in ${ctx.services.economy.formatCooldown(result.remainingMs)}.`,
          `Wallet: ${formatMoney(result.account.wallet)}`,
        ],
        subtitle: "Heat is too high",
        chips: ["Risk", "Cooldown"],
        stats: [
          { label: "Cooldown", value: ctx.services.economy.formatCooldown(result.remainingMs) },
          { label: "Wallet", value: formatMoney(result.account.wallet) },
          { label: "Bank", value: formatMoney(result.account.bank) },
        ],
      });
      return;
    }

    await ctx.services.visuals.sendEconomyResultCard({
      ctx,
      title: result.success ? "CRIME SUCCESS" : "CRIME FAIL",
      jid: ctx.msg.sender,
      lines: [
        result.message,
        `${result.success ? "Earned" : "Lost"}: ${formatMoney(result.amount)}`,
        `Wallet: ${formatMoney(result.account.wallet)}`,
      ],
      subtitle: result.success ? "The plan landed" : "The heat caught up",
      chips: ["Risk", result.success ? "Success" : "Fail"],
      stats: [
        { label: result.success ? "Earned" : "Lost", value: formatMoney(result.amount) },
        { label: "Wallet", value: formatMoney(result.account.wallet) },
        { label: "Bank", value: formatMoney(result.account.bank) },
      ],
    });
  },
};
