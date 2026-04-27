const { resolveTimezone } = require("../../utils/schedule");
const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "daily",
    aliases: ["dailycash", "dailymoney"],
    category: "games",
    description: "Claim your daily XP and cash reward.",
    cooldownSeconds: 3,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const timezone = resolveTimezone(ctx.config, ctx.userSettings);
    const [displayName, xpResult, moneyResult] = await Promise.all([
      ctx.services.user.getDisplayName(ctx.msg.sender),
      ctx.services.xp.claimDaily(ctx.msg.sender, timezone),
      ctx.services.economy.claimDailyCash(ctx.msg.sender, timezone),
    ]);

    if (!xpResult.claimed || !moneyResult.claimed) {
      await ctx.services.visuals.sendQuoteCard({
        ctx,
        title: "DAILY LOCKED",
        jid: ctx.msg.sender,
        username: displayName,
        storedAvatarUrl: xpResult.profile.avatarUrl,
        lines: [
          "You already claimed your daily rewards today.",
          `Streak: ${xpResult.profile.streakCount || 0} day(s)`,
        ],
        color: "#f59e0b",
      });
      return;
    }

    await ctx.services.visuals.sendQuoteCard({
      ctx,
      title: "DAILY REWARD",
      jid: ctx.msg.sender,
      username: displayName,
      storedAvatarUrl: xpResult.profile.avatarUrl,
      lines: [
        `XP reward: +${xpResult.reward}`,
        `Cash reward: +${formatMoney(moneyResult.reward)}`,
        `Current streak: ${xpResult.profile.streakCount || 0} day(s)`,
        `Wallet: ${formatMoney(moneyResult.account.wallet)} | Bank: ${formatMoney(moneyResult.account.bank)}`,
      ],
      color: "#22c55e",
      caption: "XP and cash claimed",
    });
  },
};
