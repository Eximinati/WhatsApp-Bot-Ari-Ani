const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "mine",
    aliases: [],
    category: "economy",
    description: "Mine for valuable ore and cash.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const result = await ctx.services.economy.mine(ctx.msg.sender);
    if (!result.ok) {
      await ctx.services.visuals.sendEconomyResultCard({
        ctx,
        title: "MINING COOLDOWN",
        jid: ctx.msg.sender,
        lines: [
          `Try again in ${ctx.services.economy.formatCooldown(result.remainingMs)}.`,
          `Wallet: ${formatMoney(result.account.wallet)}`,
        ],
        subtitle: "Tunnel reset",
        chips: ["Gather", "Mining"],
        stats: [
          { label: "Cooldown", value: ctx.services.economy.formatCooldown(result.remainingMs) },
          { label: "Wallet", value: formatMoney(result.account.wallet) },
        ],
      });
      return;
    }

    await ctx.services.visuals.sendEconomyResultCard({
      ctx,
      title: result.success ? "MINING HAUL" : "DUST RUN",
      jid: ctx.msg.sender,
      lines: [
        result.message,
        `${result.success ? "Earned" : "Reward"}: ${formatMoney(result.reward)}`,
        `Wallet: ${formatMoney(result.account.wallet)}`,
      ],
      subtitle: result.success ? "Ore cache found" : "No rare ore today",
      chips: ["Gather", "Mining", result.success ? "Success" : "Miss"],
      stats: [
        { label: result.success ? "Earned" : "Wallet", value: result.success ? formatMoney(result.reward) : formatMoney(result.account.wallet) },
        { label: "Wallet", value: formatMoney(result.account.wallet) },
        { label: "Bank", value: formatMoney(result.account.bank) },
      ],
    });
  },
};
