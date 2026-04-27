const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "collect",
    aliases: [],
    category: "economy",
    description: "Collect mature rewards from farm and investment actions.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const result = await ctx.services.economy.collect(ctx.msg.sender);

    if (!result.ok && result.reason === "cooldown") {
      await ctx.services.visuals.sendEconomyResultCard({
        ctx,
        title: "COLLECT COOLDOWN",
        jid: ctx.msg.sender,
        lines: [
          `Try again in ${ctx.services.economy.formatCooldown(result.remainingMs)}.`,
          `Wallet: ${formatMoney(result.account.wallet)}`,
        ],
        subtitle: "Collector timer",
        chips: ["Collect", "Cooldown"],
        stats: [
          { label: "Cooldown", value: ctx.services.economy.formatCooldown(result.remainingMs) },
          { label: "Wallet", value: formatMoney(result.account.wallet) },
        ],
      });
      return;
    }

    if (!result.ok && result.reason === "empty") {
      await ctx.reply("You have nothing ready to collect right now.");
      return;
    }

    if (!result.ok && result.reason === "not-ready") {
      await ctx.services.visuals.sendEconomyResultCard({
        ctx,
        title: "NOT READY",
        jid: ctx.msg.sender,
        lines: [
          `Your next payout is still cooking.`,
          `Next ready in ${ctx.services.economy.formatCooldown(result.next?.remainingMs || 0)}.`,
        ],
        subtitle: "Pending timers",
        chips: ["Collect", "Waiting"],
        stats: [
          { label: "Next", value: ctx.services.economy.formatCooldown(result.next?.remainingMs || 0) },
          { label: "Wallet", value: formatMoney(result.account.wallet) },
        ],
      });
      return;
    }

    const rewardLines = result.rewards.map(
      (entry) => `${entry.label}: +${formatMoney(entry.amount)}`,
    );
    await ctx.services.visuals.sendEconomyResultCard({
      ctx,
      title: "COLLECTED",
      jid: ctx.msg.sender,
      lines: [
        ...rewardLines,
        `Total gained: ${formatMoney(result.total)}`,
        `Wallet: ${formatMoney(result.account.wallet)}`,
      ],
      subtitle: "Payout resolved",
      chips: ["Collect", `${result.rewards.length} reward(s)`],
      stats: [
        { label: "Total", value: formatMoney(result.total) },
        { label: "Wallet", value: formatMoney(result.account.wallet) },
        { label: "Bank", value: formatMoney(result.account.bank) },
      ],
    });
  },
};
