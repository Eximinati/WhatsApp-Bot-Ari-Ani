const constants = require("../../config/constants");
const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "trivia",
    aliases: [],
    category: "games",
    description: "Start or answer a trivia question.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "[answer]",
  },
  async execute(ctx) {
    const displayName = await ctx.services.user.getDisplayName(ctx.msg.sender);
    const answer = ctx.args.join(" ").trim();
    if (!answer) {
      const question = ctx.services.games.startTrivia(ctx.msg.sender);
      const lines = [question.question];
      question.options.forEach((option, index) => {
        lines.push(`${index + 1}. ${option}`);
      });
      lines.push(`Answer with ${ctx.config.prefix}trivia <number>`);
      await ctx.services.visuals.sendQuoteCard({
        ctx,
        title: "TRIVIA START",
        jid: ctx.msg.sender,
        username: displayName,
        lines,
        color: "#8b5cf6",
      });
      return;
    }

    const result = ctx.services.games.answerTrivia(ctx.msg.sender, answer);
    if (!result) {
      await ctx.reply(`No active trivia question. Start one with ${ctx.config.prefix}trivia`);
      return;
    }

    if (result.correct) {
      const reward = constants.economy.gameRewards.trivia;
      const [profile, balance] = await Promise.all([
        ctx.services.xp.addXp(ctx.msg.sender, reward.xp),
        ctx.services.economy.rewardGame(ctx.msg.sender, reward),
      ]);
      await ctx.services.visuals.sendQuoteCard({
        ctx,
        title: "TRIVIA WIN",
        jid: ctx.msg.sender,
        username: displayName,
        storedAvatarUrl: profile.profile.avatarUrl,
        lines: [
          `Correct answer: ${result.correctIndex + 1}. ${result.correctAnswer}`,
          `Reward: +${reward.xp} XP | +${formatMoney(reward.cash)}`,
          `Wallet: ${formatMoney(balance.wallet)}`,
        ],
        color: "#22c55e",
      });
      return;
    }

    await ctx.services.visuals.sendQuoteCard({
      ctx,
      title: "TRIVIA MISS",
      jid: ctx.msg.sender,
      username: displayName,
      lines: [
        `Correct answer: ${result.correctIndex + 1}. ${result.correctAnswer}`,
      ],
      color: "#ef4444",
    });
  },
};
