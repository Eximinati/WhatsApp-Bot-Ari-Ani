const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "work",
    aliases: [],
    category: "economy",
    description: "Earn money from a timed work shift.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const result = await ctx.services.economy.work(ctx.msg.sender);
    if (!result.ok) {
      await ctx.services.visuals.sendEconomyResultCard({
        ctx,
        title: "WORK COOLDOWN",
        jid: ctx.msg.sender,
        lines: [
          `Try again in ${ctx.services.economy.formatCooldown(result.remainingMs)}.`,
          `Wallet: ${formatMoney(result.account.wallet)}`,
        ],
        subtitle: "Shift timer",
        chips: ["Life Sim", "Cooldown"],
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
      title: "WORK PAYOUT",
      jid: ctx.msg.sender,
      lines: [
        result.message,
        `Earned: +${formatMoney(result.reward)}`,
        `Wallet: ${formatMoney(result.account.wallet)}`,
      ],
      subtitle: "Shift cleared",
      chips: ["Life Sim", "Work"],
      stats: [
        { label: "Earned", value: formatMoney(result.reward) },
        { label: "Wallet", value: formatMoney(result.account.wallet) },
        { label: "Bank", value: formatMoney(result.account.bank) },
      ],
    });
  },
};
