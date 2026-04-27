const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "hunt",
    aliases: [],
    category: "economy",
    description: "Track and hunt for a payout.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const result = await ctx.services.economy.hunt(ctx.msg.sender);
    if (!result.ok) {
      await ctx.services.visuals.sendEconomyResultCard({
        ctx,
        title: "HUNT COOLDOWN",
        jid: ctx.msg.sender,
        lines: [
          `Try again in ${ctx.services.economy.formatCooldown(result.remainingMs)}.`,
          `Wallet: ${formatMoney(result.account.wallet)}`,
        ],
        subtitle: "Trail needs time",
        chips: ["Gather", "Hunt"],
        stats: [
          { label: "Cooldown", value: ctx.services.economy.formatCooldown(result.remainingMs) },
          { label: "Wallet", value: formatMoney(result.account.wallet) },
        ],
      });
      return;
    }

    await ctx.services.visuals.sendEconomyResultCard({
      ctx,
      title: result.success ? "HUNT REWARD" : "TRAIL GONE COLD",
      jid: ctx.msg.sender,
      lines: [
        result.message,
        `${result.success ? "Earned" : "Reward"}: ${formatMoney(result.reward)}`,
        `Wallet: ${formatMoney(result.account.wallet)}`,
      ],
      subtitle: result.success ? "Target secured" : "Nothing to bring back",
      chips: ["Gather", "Hunt", result.success ? "Success" : "Miss"],
      stats: [
        { label: result.success ? "Earned" : "Wallet", value: result.success ? formatMoney(result.reward) : formatMoney(result.account.wallet) },
        { label: "Wallet", value: formatMoney(result.account.wallet) },
        { label: "Bank", value: formatMoney(result.account.bank) },
      ],
    });
  },
};
