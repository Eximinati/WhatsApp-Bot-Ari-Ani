const { formatStatsUI } = require("../utils/stat-utils");

module.exports = {
  meta: {
    name: "stats",
    aliases: [],
    category: "games",
    description: "Show your character stats.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
  },
  async execute(ctx) {
    const senderId = ctx.msg.senderId;
    
    const { stats, statPoints, level } = await ctx.services.xp.getStats(senderId);
    
    const text = formatStatsUI(stats, statPoints, level);
    
    await ctx.reply(text, { parse_mode: "Markdown" });
  },
};