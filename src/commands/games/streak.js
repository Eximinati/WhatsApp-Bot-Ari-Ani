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
    await ctx.reply(`Your streak is *${profile.streakCount || 0}* day(s).`);
  },
};
