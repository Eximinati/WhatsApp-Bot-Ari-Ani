module.exports = {
  meta: {
    name: "leaderboard",
    aliases: ["top"],
    category: "games",
    description: "Show top XP players.",
    cooldownSeconds: 8,
    access: "user",
    chat: "both",
  },
  async execute(ctx) {
    const leaderboard = await ctx.services.xp.getLeaderboard(10);
    const lines = await Promise.all(
      leaderboard.map(async (entry, index) => {
        const name = await ctx.services.user.getDisplayName(entry.jid);
        const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
        return `${medal} ${name} - ${entry.xp} XP (Lv ${entry.level})`;
      }),
    );

    let text = `🏆 *XP Leaderboard*\n\n*Top 10 Players*\n\n`;
    text += lines.join("\n");
    
    await ctx.reply(text, { parse_mode: "Markdown" });
  },
};