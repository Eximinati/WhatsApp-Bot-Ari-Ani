const { resolveTimezone } = require("../../utils/schedule");

module.exports = {
  meta: {
    name: "streak",
    aliases: [],
    category: "games",
    description: "Show your daily streak.",
    cooldownSeconds: 3,
    access: "user",
    chat: "both",
  },
  async execute(ctx) {
    const senderId = ctx.msg.senderId;
    const profile = await ctx.services.xp.getProfile(senderId);
    const streak = profile.streakCount || 0;
    const timezone = profile.timezone || resolveTimezone(ctx.config, ctx.userSettings);
    
    let message = "";
    if (streak >= 7) message = "🎉 Amazing! 7+ day streak!";
    else if (streak >= 3) message = "🔥 Keep it going!";
    else if (streak >= 1) message = "💪 Good start!";
    else message = "📅 Claim your daily to start!";
    
    await ctx.reply(
      `🔥 *Streak Status*\n\n${message}\n\n━━━━━━━━━━━━━━━\n` +
      `Streak: ${streak} day(s)\n` +
      `Timezone: ${timezone}\n━━━━━━━━━━━━━━━`
    , { parse_mode: "Markdown" });
  },
};