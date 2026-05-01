const { resolveTimezone } = require("../../utils/schedule");
const { formatMoney } = require("../../services/economy-service");
const { getProgressBar, getXpLevelText, getContextTip, getLoopHook } = require("../../utils/xp-utils");
const { applyStatBonuses, getStatScalingText, getSafeStats } = require("../../utils/stat-utils");

module.exports = {
  meta: {
    name: "daily",
    aliases: ["dailycash", "dailymoney"],
    category: "games",
    description: "Claim your daily rewards.",
    cooldownSeconds: 3,
    access: "user",
    chat: "both",
  },
  async execute(ctx) {
    const senderId = ctx.msg.senderId;
    const timezone = resolveTimezone(ctx.config, ctx.userSettings);
    
    const [xpResult, moneyResult] = await Promise.all([
      ctx.services.xp.claimDaily(senderId, timezone),
      ctx.services.economy.claimDailyCash(senderId, timezone),
    ]);
    
    const balance = await ctx.services.economy.getBalance(senderId);
    const { stats: rawStats } = await ctx.services.xp.getStats(senderId);
    const stats = getSafeStats({ statsJson: JSON.stringify(rawStats) });
    
    if (!xpResult.claimed || !moneyResult.claimed) {
      await ctx.reply(
        `📅 *Daily Rewards*\n\n⏳ Already claimed!\n\n━━━━━━━━━━━━━━━\n` +
        `Streak: ${xpResult.profile?.streakCount || 0} day(s)\n` +
        `Come back tomorrow!\n━━━━━━━━━━━━━━━`
      , { parse_mode: "Markdown" });
      return;
    }
    
    const streak = xpResult.profile?.streakCount || 0;
    const baseReward = moneyResult.reward || 0;
    const baseXp = xpResult.reward || 0;
    
    const statCalc = applyStatBonuses(baseReward, baseXp, stats);
    const finalReward = statCalc.finalReward;
    const finalXp = statCalc.finalXp;
    
    if (finalReward > 0) {
      await ctx.services.economy.addWallet(senderId, finalReward);
    }
    const { profile, leveledUp } = await ctx.services.xp.addXp(senderId, finalXp);
    
    const progress = getProgressBar(profile.xp, profile.level);
    const levelText = getXpLevelText(profile.level);
    const tip = getContextTip({ success: true }, balance, "daily");
    const loopHook = getLoopHook(0, true, "daily");
    
    const xpLeft = Math.max(progress.xpLeft, 0);
    const levelUpMsg = leveledUp ? `\n🎉 LEVEL UP! You are now Lv ${profile.level}!` : "";
    
    const scalingParts = getStatScalingText(statCalc.bonuses);
    const bonusText = scalingParts.length > 0 ? scalingParts.map(p => ` (${p})`).join("") : "";
    
    let bonusMsg = "";
    if (streak >= 7) bonusMsg = "\n🎁 Streak Bonus: 2x active!";
    else if (streak >= 3) bonusMsg = "\n🎁 Streak Bonus: 1.5x active!";
    
    let text = `🎉 *Daily Rewards Claimed!*\n\n💰 Rewards earned!\n\n━━━━━━━━━━━━━━━\n`;
    text += `💰 Cash: +${formatMoney(finalReward)} coins${bonusText}\n`;
    text += `✨ XP: +${finalXp} ${levelText}\n`;
    text += `📊 ${progress.bar}\n`;
    text += `⬆️ ${xpLeft} XP to next level\n`;
    text += `🔥 Streak: ${streak} day(s)\n`;
    text += `━━━━━━━━━━━━━━━\n${bonusMsg}${levelUpMsg}\n\n`;
    
    const newBalance = await ctx.services.economy.getBalance(senderId);
    text += `👛 Wallet: ${formatMoney(newBalance.wallet)}\n`;
    text += `🏦 Bank: ${formatMoney(newBalance.bank)}\n\n`;
    text += `${tip}\n${loopHook}`;
    
    await ctx.reply(text, { parse_mode: "Markdown" });
  },
};