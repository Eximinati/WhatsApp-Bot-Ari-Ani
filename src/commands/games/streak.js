const { resolveTimezone } = require("../../utils/schedule");

module.exports = {
  meta: {
    name: "streak",
    aliases: [],
    category: "games",
    description: "Show your current daily streak.",
    cooldownSeconds: 3,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const profile = await ctx.services.xp.getProfile(ctx.msg.sender);
    await ctx.services.visuals.sendQuoteCard({
      ctx,
      title: "STREAK STATUS",
      jid: ctx.msg.sender,
      username: await ctx.services.user.getDisplayName(ctx.msg.sender),
      storedAvatarUrl: profile.avatarUrl,
      lines: [
        `Current streak: ${profile.streakCount || 0} day(s)`,
        `Timezone: ${profile.timezone || resolveTimezone(ctx.config, ctx.userSettings)}`,
      ],
      color: "#f97316",
    });
  },
};
