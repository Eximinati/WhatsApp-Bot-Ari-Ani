const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "dice",
    aliases: [],
    category: "economy",
    description: "Roll dice against the house.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "<bet>",
  },
  async execute(ctx) {
    if (!ctx.args[0]) {
      await ctx.reply(`Usage: ${ctx.config.prefix}dice <bet>`);
      return;
    }

    try {
      const result = await ctx.services.economy.dice(ctx.msg.sender, ctx.args[0]);
      await ctx.services.visuals.sendGambleCard({
        ctx,
        title: "DICE TABLE",
        jid: ctx.msg.sender,
        lines: [
          `Your roll: ${result.player}`,
          `House roll: ${result.house}`,
          result.draw
            ? "Round ended in a draw."
            : `${result.win ? "Won" : "Lost"}: ${formatMoney(Math.abs(result.delta))}`,
          `Wallet: ${formatMoney(result.account.wallet)}`,
        ],
        subtitle: result.draw ? "Dead even" : result.win ? "Beat the house" : "House edge landed",
        chips: ["Gamble", "Dice", result.draw ? "Draw" : result.win ? "Win" : "Loss"],
        stats: [
          { label: "Bet", value: formatMoney(result.bet) },
          { label: "You", value: String(result.player) },
          { label: "House", value: String(result.house) },
          { label: "Wallet", value: formatMoney(result.account.wallet) },
        ],
      });
    } catch (error) {
      await ctx.reply(error.message);
    }
  },
};
