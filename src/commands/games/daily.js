const { resolveTimezone } = require("../../utils/schedule");

module.exports = {
  meta: {
    name: "daily",
    aliases: [],
    category: "games",
    description: "Claim your daily XP reward.",
    cooldownSeconds: 3,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const result = await ctx.services.xp.claimDaily(
      ctx.msg.sender,
      resolveTimezone(ctx.config, ctx.userSettings),
    );
    if (!result.claimed) {
      await ctx.reply("You already claimed your daily reward today.");
      return;
    }

    await ctx.reply(`Daily reward claimed: *${result.reward} XP*.\nCurrent streak: *${result.profile.streakCount}* day(s).`);
  },
};
