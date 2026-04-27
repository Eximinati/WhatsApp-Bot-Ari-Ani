module.exports = {
  meta: {
    name: "rank",
    aliases: ["xp"],
    category: "general",
    description: "Render your current XP rank card.",
    cooldownSeconds: 8,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const [rank, balance, profile] = await Promise.all([
      ctx.services.xp.getRank(ctx.msg.sender),
      ctx.services.economy.getBalance(ctx.msg.sender),
      ctx.services.xp.getProfile(ctx.msg.sender),
    ]);
    const displayName = await ctx.services.user.getDisplayName(ctx.msg.sender);
    await ctx.services.visuals.sendRankCard({
      ctx,
      displayName,
      jid: ctx.msg.sender,
      rank,
      wealth: balance.totalWealth,
      storedAvatarUrl: profile.avatarUrl,
    });
  },
};
