const constants = require("../../config/constants");
const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "guess",
    aliases: [],
    category: "games",
    description: "Start or continue a number guessing game.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "[number]",
  },
  async execute(ctx) {
    const displayName = await ctx.services.user.getDisplayName(ctx.msg.sender);
    const guess = ctx.args[0];
    if (!guess) {
      const range = ctx.services.games.startGuess(ctx.msg.sender);
      await ctx.services.visuals.sendQuoteCard({
        ctx,
        title: "GUESS START",
        jid: ctx.msg.sender,
        username: displayName,
        lines: [
          `I picked a number between ${range.min} and ${range.max}.`,
          `Reply with ${ctx.config.prefix}guess <number>`,
        ],
        color: "#60a5fa",
      });
      return;
    }

    const result = ctx.services.games.submitGuess(ctx.msg.sender, guess);
    if (!result) {
      await ctx.reply(`No active guess game. Start one with ${ctx.config.prefix}guess`);
      return;
    }

    if (result.status === "correct") {
      const reward = constants.economy.gameRewards.guess;
      const [profile, balance] = await Promise.all([
        ctx.services.xp.addXp(ctx.msg.sender, reward.xp),
        ctx.services.economy.rewardGame(ctx.msg.sender, reward),
      ]);
      await ctx.services.visuals.sendQuoteCard({
        ctx,
        title: "GUESS WIN",
        jid: ctx.msg.sender,
        username: displayName,
        storedAvatarUrl: profile.profile.avatarUrl,
        lines: [
          `Correct target: ${result.target}`,
          `Reward: +${reward.xp} XP | +${formatMoney(reward.cash)}`,
          `Wallet: ${formatMoney(balance.wallet)}`,
        ],
        color: "#22c55e",
      });
      return;
    }

    if (result.status === "lost") {
      await ctx.services.visuals.sendQuoteCard({
        ctx,
        title: "GUESS OVER",
        jid: ctx.msg.sender,
        username: displayName,
        lines: [`Game over. The number was ${result.target}.`],
        color: "#ef4444",
      });
      return;
    }

    await ctx.services.visuals.sendQuoteCard({
      ctx,
      title: "GUESS HINT",
      jid: ctx.msg.sender,
      username: displayName,
      lines: [
        result.status === "higher" ? "Go higher." : "Go lower.",
        `Attempts left: ${result.attemptsLeft}`,
      ],
      color: "#f59e0b",
    });
  },
};
