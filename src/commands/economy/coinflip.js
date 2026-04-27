const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "coinflip",
    aliases: ["cf"],
    category: "economy",
    description: "Flip a coin against the house.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "<heads|tails> <bet>",
  },
  async execute(ctx) {
    if (!ctx.args[0] || !ctx.args[1]) {
      await ctx.reply(`Usage: ${ctx.config.prefix}coinflip <heads|tails> <bet>`);
      return;
    }

    try {
      const result = await ctx.services.economy.coinflip(
        ctx.msg.sender,
        ctx.args[0],
        ctx.args[1],
      );
      await ctx.services.visuals.sendGambleCard({
        ctx,
        title: "COINFLIP",
        jid: ctx.msg.sender,
        lines: [
          `You picked: ${result.choice}`,
          `Result: ${result.result}`,
          `${result.win ? "Won" : "Lost"}: ${formatMoney(result.delta)}`,
          `Wallet: ${formatMoney(result.account.wallet)}`,
        ],
        subtitle: result.win ? "Fortune favored you" : "The house took it",
        chips: ["Gamble", "Coinflip", result.win ? "Win" : "Loss"],
        stats: [
          { label: "Bet", value: formatMoney(result.bet) },
          { label: "Delta", value: formatMoney(result.delta) },
          { label: "Wallet", value: formatMoney(result.account.wallet) },
        ],
      });
    } catch (error) {
      await ctx.reply(error.message);
    }
  },
};
