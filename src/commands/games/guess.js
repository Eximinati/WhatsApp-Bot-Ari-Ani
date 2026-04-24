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
    const guess = ctx.args[0];
    if (!guess) {
      const range = ctx.services.games.startGuess(ctx.msg.sender);
      await ctx.reply(
        `I picked a number between *${range.min}* and *${range.max}*.\nReply with ${ctx.config.prefix}guess <number>`,
      );
      return;
    }

    const result = ctx.services.games.submitGuess(ctx.msg.sender, guess);
    if (!result) {
      await ctx.reply(`No active guess game. Start one with ${ctx.config.prefix}guess`);
      return;
    }

    if (result.status === "correct") {
      await ctx.services.xp.addXp(ctx.msg.sender, 15);
      await ctx.reply("Nice! You guessed correctly and earned *15 XP*.");
      return;
    }

    if (result.status === "lost") {
      await ctx.reply(`Game over. The number was *${result.target}*.`);
      return;
    }

    await ctx.reply(
      `${result.status === "higher" ? "Go higher." : "Go lower."} Attempts left: *${result.attemptsLeft}*`,
    );
  },
};
