const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "blackjack",
    aliases: ["bj"],
    category: "economy",
    description: "Play a quick blackjack hand.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "<bet>",
  },
  async execute(ctx) {
    if (!ctx.args[0]) {
      await ctx.reply(`Usage: ${ctx.config.prefix}blackjack <bet>`);
      return;
    }

    try {
      const result = await ctx.services.economy.blackjack(ctx.msg.sender, ctx.args[0]);
      await ctx.services.visuals.sendGambleCard({
        ctx,
        title: "BLACKJACK",
        jid: ctx.msg.sender,
        lines: [
          `Your hand: ${result.player.join(", ")} = ${result.playerTotal}`,
          `Dealer hand: ${result.dealer.join(", ")} = ${result.dealerTotal}`,
          `Outcome: ${result.outcome.toUpperCase()}`,
          `${result.delta >= 0 ? "Won" : "Lost"}: ${formatMoney(Math.abs(result.delta))}`,
          `Wallet: ${formatMoney(result.account.wallet)}`,
        ],
        subtitle: result.outcome === "win" ? "Table cleared" : result.outcome === "draw" ? "Push" : "House wins",
        chips: ["Gamble", "Blackjack", result.outcome.toUpperCase()],
        stats: [
          { label: "Bet", value: formatMoney(result.bet) },
          { label: "You", value: String(result.playerTotal) },
          { label: "Dealer", value: String(result.dealerTotal) },
          { label: "Wallet", value: formatMoney(result.account.wallet) },
        ],
      });
    } catch (error) {
      await ctx.reply(error.message);
    }
  },
};
