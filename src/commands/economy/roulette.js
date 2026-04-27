const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "roulette",
    aliases: [],
    category: "economy",
    description: "Bet on a roulette color or number.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "<color|number> <bet>",
  },
  async execute(ctx) {
    if (!ctx.args[0] || !ctx.args[1]) {
      await ctx.reply(`Usage: ${ctx.config.prefix}roulette <red|black|green|number> <bet>`);
      return;
    }

    try {
      const result = await ctx.services.economy.roulette(
        ctx.msg.sender,
        ctx.args[0],
        ctx.args[1],
      );
      await ctx.services.visuals.sendGambleCard({
        ctx,
        title: "ROULETTE",
        jid: ctx.msg.sender,
        lines: [
          `Selection: ${result.selection}`,
          `Spin: ${result.spin} (${result.color})`,
          `${result.win ? "Won" : "Lost"}: ${formatMoney(result.delta)}`,
          `Wallet: ${formatMoney(result.account.wallet)}`,
        ],
        subtitle: result.win ? "Table pays out" : "Wheel missed",
        chips: ["Gamble", "Roulette", result.win ? "Win" : "Loss"],
        stats: [
          { label: "Bet", value: formatMoney(result.bet) },
          { label: "Spin", value: `${result.spin}` },
          { label: "Color", value: result.color },
          { label: "Wallet", value: formatMoney(result.account.wallet) },
        ],
      });
    } catch (error) {
      await ctx.reply(error.message);
    }
  },
};
