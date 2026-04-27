const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "invest",
    aliases: [],
    category: "economy",
    description: "Lock some money into a risky investment.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "<amount>",
  },
  async execute(ctx) {
    if (!ctx.args[0]) {
      await ctx.reply(`Usage: ${ctx.config.prefix}invest <amount>`);
      return;
    }

    try {
      const result = await ctx.services.economy.invest(ctx.msg.sender, ctx.args[0]);

      if (!result.ok) {
        await ctx.services.visuals.sendEconomyResultCard({
          ctx,
          title: result.reason === "ready" ? "INVESTMENT READY" : "INVESTMENT LOCKED",
          jid: ctx.msg.sender,
          lines: [
            result.reason === "ready"
              ? `Your return is ready. Use ${ctx.config.prefix}collect to cash out.`
              : `Your funds are still locked for ${ctx.services.economy.formatCooldown(result.remainingMs)}.`,
          ],
          subtitle: "Market timer",
          chips: ["Risk", "Invest"],
          stats: [
            { label: "Status", value: result.reason === "ready" ? "Ready" : "Locked" },
            { label: "Wallet", value: formatMoney(result.account.wallet) },
          ],
        });
        return;
      }

      await ctx.services.visuals.sendEconomyResultCard({
        ctx,
        title: "INVESTMENT LOCKED",
        jid: ctx.msg.sender,
        lines: [
          "Your market play is now active.",
          `Principal: ${formatMoney(result.principal)}`,
          `Projected payout: ${formatMoney(result.projectedPayout)}`,
          `Collect after: ${new Date(result.readyAt).toLocaleString("en-PK", { timeZone: ctx.config.timezone })}`,
        ],
        subtitle: "Risky growth",
        chips: ["Risk", "Invest"],
        stats: [
          { label: "Principal", value: formatMoney(result.principal) },
          { label: "Projected", value: formatMoney(result.projectedPayout) },
          { label: "Wallet", value: formatMoney(result.account.wallet) },
        ],
      });
    } catch (error) {
      await ctx.reply(error.message);
    }
  },
};
