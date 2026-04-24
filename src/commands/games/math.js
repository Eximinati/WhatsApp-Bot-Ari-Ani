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
    const answer = ctx.args[0];
    if (!answer) {
      const question = ctx.services.games.startMath(ctx.msg.sender);
      await ctx.reply(`Solve this: *${question}*\nReply with ${ctx.config.prefix}math <answer>`);
      return;
    }

    const result = ctx.services.games.answerMath(ctx.msg.sender, answer);
    if (!result) {
      await ctx.reply(`No active math challenge. Start one with ${ctx.config.prefix}math`);
      return;
    }

    if (result.correct) {
      await ctx.services.xp.addXp(ctx.msg.sender, 12);
      await ctx.reply("Correct! You earned *12 XP*.");
      return;
    }

    await ctx.reply(`Not quite. Try again for *${result.question}*.`);
  },
};
