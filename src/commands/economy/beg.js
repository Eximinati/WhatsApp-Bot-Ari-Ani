const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "beg",
    aliases: [],
    category: "economy",
    description: "Ask around for a little pocket cash.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const result = await ctx.services.economy.beg(ctx.msg.sender);
    if (!result.ok) {
      await ctx.services.visuals.sendEconomyResultCard({
        ctx,
        title: "BEG COOLDOWN",
        jid: ctx.msg.sender,
        lines: [
          `Try again in ${ctx.services.economy.formatCooldown(result.remainingMs)}.`,
          `Wallet: ${formatMoney(result.account.wallet)}`,
        ],
        subtitle: "Street timer",
        chips: ["Life Sim", "Cooldown"],
        stats: [
          { label: "Cooldown", value: ctx.services.economy.formatCooldown(result.remainingMs) },
          { label: "Wallet", value: formatMoney(result.account.wallet) },
        ],
      });
      return;
    }

    await ctx.services.visuals.sendEconomyResultCard({
      ctx,
      title: "BEG SUCCESS",
      jid: ctx.msg.sender,
      lines: [
        result.message,
        `Earned: +${formatMoney(result.reward)}`,
        `Wallet: ${formatMoney(result.account.wallet)}`,
      ],
      subtitle: "Fast pocket money",
      chips: ["Life Sim", "Beg"],
      stats: [
        { label: "Earned", value: formatMoney(result.reward) },
        { label: "Wallet", value: formatMoney(result.account.wallet) },
        { label: "Bank", value: formatMoney(result.account.bank) },
      ],
    });
  },
};
