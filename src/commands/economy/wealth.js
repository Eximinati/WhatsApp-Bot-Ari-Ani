const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "wealth",
    aliases: ["moneylb"],
    category: "economy",
    description: "Show the richest users on the bot.",
    cooldownSeconds: 8,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const leaderboard = await ctx.services.economy.getWealthLeaderboard(10);
    const lines = await Promise.all(
      leaderboard.map(async (entry, index) => {
        const name = await ctx.services.user.getDisplayName(entry.jid);
        const tags = [entry.jobKey || "no-job", entry.factionKey || "no-faction"].join(" | ");
        return `${index + 1}. ${name} - ${formatMoney(entry.totalWealth)} | Wallet ${formatMoney(entry.wallet)} | Bank ${formatMoney(entry.bank)} | ${tags}`;
      }),
    );

    await ctx.services.visuals.sendLeaderboardCard({
      ctx,
      title: "WEALTH LEADERBOARD",
      username: await ctx.services.user.getDisplayName(ctx.msg.sender),
      jid: ctx.msg.sender,
      lines,
      caption: "Top money ladder with jobs and factions",
    });
  },
};
