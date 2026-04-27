const constants = require("../../config/constants");
const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "math",
    aliases: [],
    category: "games",
    description: "Start or answer a math challenge.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "[answer]",
  },
  async execute(ctx) {
    const displayName = await ctx.services.user.getDisplayName(ctx.msg.sender);
    const answer = ctx.args[0];
    if (!answer) {
      const question = ctx.services.games.startMath(ctx.msg.sender);
      await ctx.services.visuals.sendQuoteCard({
        ctx,
        title: "MATH CHALLENGE",
        jid: ctx.msg.sender,
        username: displayName,
        lines: [
          `Solve: ${question}`,
          `Reply with ${ctx.config.prefix}math <answer>`,
        ],
        color: "#60a5fa",
      });
      return;
    }

    const result = ctx.services.games.answerMath(ctx.msg.sender, answer);
    if (!result) {
      await ctx.reply(`No active math challenge. Start one with ${ctx.config.prefix}math`);
      return;
    }

    if (result.correct) {
      const reward = constants.economy.gameRewards.math;
      const [profile, balance] = await Promise.all([
        ctx.services.xp.addXp(ctx.msg.sender, reward.xp),
        ctx.services.economy.rewardGame(ctx.msg.sender, reward),
      ]);
      await ctx.services.visuals.sendQuoteCard({
        ctx,
        title: "MATH CLEAR",
        jid: ctx.msg.sender,
        username: displayName,
        storedAvatarUrl: profile.profile.avatarUrl,
        lines: [
          `Question: ${result.question}`,
          `Answer: ${result.answer}`,
          `Reward: +${reward.xp} XP | +${formatMoney(reward.cash)}`,
          `Wallet: ${formatMoney(balance.wallet)}`,
        ],
        color: "#22c55e",
      });
      return;
    }

    await ctx.services.visuals.sendQuoteCard({
      ctx,
      title: "MATH RETRY",
      jid: ctx.msg.sender,
      username: displayName,
      lines: [`Not quite. Try again for ${result.question}.`],
      color: "#f59e0b",
    });
  },
};
