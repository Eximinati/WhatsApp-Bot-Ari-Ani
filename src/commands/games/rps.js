const constants = require("../../config/constants");
const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "rps",
    aliases: [],
    category: "games",
    description: "Play rock paper scissors against the bot.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "<rock|paper|scissors>",
  },
  async execute(ctx) {
    try {
      const result = ctx.services.games.playRps(ctx.args[0]);
      const reward = constants.economy.gameRewards.rps[result.outcome];
      const [displayName, profile, balance] = await Promise.all([
        ctx.services.user.getDisplayName(ctx.msg.sender),
        ctx.services.xp.addXp(ctx.msg.sender, reward.xp),
        ctx.services.economy.rewardGame(ctx.msg.sender, reward),
      ]);

      await ctx.services.visuals.sendQuoteCard({
        ctx,
        title: "ROCK PAPER SCISSORS",
        jid: ctx.msg.sender,
        username: displayName,
        storedAvatarUrl: profile.profile.avatarUrl,
        lines: [
          `You: ${String(ctx.args[0] || "").toLowerCase()}`,
          `Bot: ${result.botChoice}`,
          `Result: ${result.outcome.toUpperCase()}`,
          `Reward: +${reward.xp} XP | +${formatMoney(reward.cash)}`,
          `Wallet: ${formatMoney(balance.wallet)}`,
        ],
        color: result.outcome === "win" ? "#22c55e" : result.outcome === "draw" ? "#f59e0b" : "#ef4444",
      });
    } catch (error) {
      await ctx.reply(error.message);
    }
  },
};
