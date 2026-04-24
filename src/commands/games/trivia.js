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
    const answer = ctx.args.join(" ").trim();
    if (!answer) {
      const question = ctx.services.games.startTrivia(ctx.msg.sender);
      const lines = [`*Trivia* ${question.question}`];
      question.options.forEach((option, index) => {
        lines.push(`${index + 1}. ${option}`);
      });
      lines.push(`Answer with ${ctx.config.prefix}trivia <number>`);
      await ctx.reply(lines.join("\n"));
      return;
    }

    const result = ctx.services.games.answerTrivia(ctx.msg.sender, answer);
    if (!result) {
      await ctx.reply(`No active trivia question. Start one with ${ctx.config.prefix}trivia`);
      return;
    }

    if (result.correct) {
      await ctx.services.xp.addXp(ctx.msg.sender, 18);
      await ctx.reply("Correct! You earned *18 XP*.");
      return;
    }

    await ctx.reply(`Incorrect. The right answer was *${result.correctIndex + 1}. ${result.correctAnswer}*.`);
  },
};
