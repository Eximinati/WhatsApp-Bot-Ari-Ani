const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "fish",
    aliases: [],
    category: "economy",
    description: "Go fishing for medium cash rewards.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const result = await ctx.services.economy.fish(ctx.msg.sender);
    if (!result.ok) {
      await ctx.services.visuals.sendEconomyResultCard({
        ctx,
        title: "FISH COOLDOWN",
        jid: ctx.msg.sender,
        lines: [
          `Try again in ${ctx.services.economy.formatCooldown(result.remainingMs)}.`,
          `Wallet: ${formatMoney(result.account.wallet)}`,
        ],
        subtitle: "Water needs time",
        chips: ["Gather", "Fishing"],
        stats: [
          { label: "Cooldown", value: ctx.services.economy.formatCooldown(result.remainingMs) },
          { label: "Wallet", value: formatMoney(result.account.wallet) },
        ],
      });
      return;
    }

    await ctx.services.visuals.sendEconomyResultCard({
      ctx,
      title: result.success ? "FISHING HAUL" : "EMPTY LINE",
      jid: ctx.msg.sender,
      lines: [
        result.message,
        `${result.success ? "Earned" : "Reward"}: ${formatMoney(result.reward)}`,
        `Wallet: ${formatMoney(result.account.wallet)}`,
      ],
      subtitle: result.success ? "Catch secured" : "Nothing bit today",
      chips: ["Gather", "Fishing", result.success ? "Catch" : "Miss"],
      stats: [
        { label: result.success ? "Earned" : "Wallet", value: result.success ? formatMoney(result.reward) : formatMoney(result.account.wallet) },
        { label: "Wallet", value: formatMoney(result.account.wallet) },
        { label: "Bank", value: formatMoney(result.account.bank) },
      ],
    });
  },
};
