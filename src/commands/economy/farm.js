const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "farm",
    aliases: [],
    category: "economy",
    description: "Plant a crop and collect it later.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const result = await ctx.services.economy.farm(ctx.msg.sender);

    if (!result.ok && result.reason === "growing") {
      await ctx.services.visuals.sendEconomyResultCard({
        ctx,
        title: "FARM GROWING",
        jid: ctx.msg.sender,
        lines: [
          "Your current crop is still growing.",
          `Ready in ${ctx.services.economy.formatCooldown(result.remainingMs)}.`,
        ],
        subtitle: "Crop in progress",
        chips: ["Life Sim", "Farm"],
        stats: [
          { label: "Ready In", value: ctx.services.economy.formatCooldown(result.remainingMs) },
          { label: "Wallet", value: formatMoney(result.account.wallet) },
        ],
      });
      return;
    }

    if (!result.ok && result.reason === "ready") {
      await ctx.services.visuals.sendEconomyResultCard({
        ctx,
        title: "FARM READY",
        jid: ctx.msg.sender,
        lines: [
          "Your crop is ready to cash out.",
          `Use ${ctx.config.prefix}collect to harvest it now.`,
        ],
        subtitle: "Harvest waiting",
        chips: ["Life Sim", "Farm"],
        stats: [
          { label: "Wallet", value: formatMoney(result.account.wallet) },
          { label: "Bank", value: formatMoney(result.account.bank) },
        ],
      });
      return;
    }

    await ctx.services.visuals.sendEconomyResultCard({
      ctx,
      title: "FARM PLANTED",
      jid: ctx.msg.sender,
      lines: [
        result.message,
        `Projected harvest: ${formatMoney(result.reward)}`,
        `Ready at: ${new Date(result.readyAt).toLocaleString("en-PK", { timeZone: ctx.config.timezone })}`,
      ],
      subtitle: "Passive income planted",
      chips: ["Life Sim", "Farm"],
      stats: [
        { label: "Projected", value: formatMoney(result.reward) },
        { label: "Wallet", value: formatMoney(result.account.wallet) },
        { label: "Bank", value: formatMoney(result.account.bank) },
      ],
    });
  },
};
