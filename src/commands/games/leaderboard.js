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
    const lines = await Promise.all(
      leaderboard.map(async (entry, index) => {
        const name = await ctx.services.user.getDisplayName(entry.jid);
        return `${index + 1}. ${name} - ${entry.xp} XP | Lv ${entry.level}`;
      }),
    );

    await ctx.services.visuals.sendLeaderboardCard({
      ctx,
      title: "XP LEADERBOARD",
      username: await ctx.services.user.getDisplayName(ctx.msg.sender),
      jid: ctx.msg.sender,
      lines,
      caption: "Top XP ladder",
    });
  },
};
