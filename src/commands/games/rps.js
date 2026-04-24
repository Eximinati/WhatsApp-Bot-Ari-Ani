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
      const rewards = { win: 10, draw: 4, lose: 1 };
      await ctx.services.xp.addXp(ctx.msg.sender, rewards[result.outcome]);
      await ctx.reply(
        `I chose *${result.botChoice}*.\nResult: *${result.outcome}*.\nXP: *+${rewards[result.outcome]}*`,
      );
    } catch (error) {
      await ctx.reply(error.message);
    }
  },
};
