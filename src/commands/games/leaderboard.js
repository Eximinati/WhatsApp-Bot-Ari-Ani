module.exports = {
  meta: {
    name: "leaderboard",
    aliases: ["top"],
    category: "games",
    description: "Show the top XP leaderboard.",
    cooldownSeconds: 8,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const leaderboard = await ctx.services.xp.getLeaderboard(10);
    const lines = ["*XP Leaderboard*"];
    leaderboard.forEach((entry, index) => {
      lines.push(
        `${index + 1}. ${entry.jid.split("@")[0]} - ${entry.xp} XP (lvl ${entry.level})`,
      );
    });
    await ctx.reply(lines.join("\n"));
  },
};
