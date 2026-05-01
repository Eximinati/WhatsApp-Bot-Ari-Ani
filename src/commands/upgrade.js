const { validateStatUpgrade, getStatDisplayName } = require("../utils/stat-utils");

module.exports = {
  meta: {
    name: "upgrade",
    aliases: [],
    category: "games",
    description: "Upgrade your stats.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "<stat> <points>",
  },
  async execute(ctx) {
    const senderId = ctx.msg.senderId;
    const statName = ctx.args[0];
    const pointsStr = ctx.args[1];
    
    if (!statName || !pointsStr) {
      await ctx.reply(
        `📜 *Usage:* /upgrade <stat> <points>\n\n` +
        `*Example:*\n` +
        `/upgrade luck 1\n` +
        `/upgrade strength 2\n\n` +
        `*Available:* luck, strength, intelligence, defense`
      , { parse_mode: "Markdown" });
      return;
    }
    
    const { stats, statPoints: currentPoints } = await ctx.services.xp.getStats(senderId);
    
    const validation = validateStatUpgrade(statName, pointsStr, currentPoints);
    if (!validation.valid) {
      await ctx.reply(`❌ ${validation.error}`);
      return;
    }
    
    const result = await ctx.services.xp.upgradeStat(senderId, validation.stat, validation.points);
    
    if (!result.success) {
      await ctx.reply(`❌ ${result.error}`);
      return;
    }
    
    const newStats = result.stats;
    const remainingPoints = result.statPoints;
    const displayName = getStatDisplayName(validation.stat);
    const newValue = newStats[validation.stat];
    
    await ctx.reply(
      `✅ *Stat Upgraded!*\n\n` +
      `${displayName}: ${newValue}\n\n` +
      `🎯 Points Remaining: ${remainingPoints}`
    , { parse_mode: "Markdown" });
  },
};