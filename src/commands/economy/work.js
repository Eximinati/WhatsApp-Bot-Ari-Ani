const { formatMoney } = require("../../services/economy-service");
const { getProgressBar, getXpLevelText, getContextTip, getLoopHook } = require("../../utils/xp-utils");
const { applyStatBonuses, getStatScalingText, getSafeStats } = require("../../utils/stat-utils");

const XP_GAINS = { fish: 8, mine: 10, hunt: 12, work: 15, beg: 3 };

const FLAVOR = ["A productive shift!", "Work paid off today!", "Hard work earns rewards!", "Good earnings today!"];

module.exports = {
  meta: {
    name: "work",
    aliases: [],
    category: "economy",
    description: "Work for money.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
  },
  async execute(ctx) {
    const senderId = ctx.msg.senderId;
    
    const result = await ctx.services.economy.work(senderId);
    const balance = await ctx.services.economy.getBalance(senderId);
    const { stats: rawStats } = await ctx.services.xp.getStats(senderId);
    const stats = getSafeStats({ statsJson: JSON.stringify(rawStats) });
    const xpGain = XP_GAINS.work;
    
    if (!result.ok) {
      const cooldownSec = Math.ceil((result.remainingMs || 0) / 1000);
      await ctx.reply(
        `💼 *Work*\n\n⏳ Cooldown: ${cooldownSec}s\n\n━━━━━━━━━━━━━━━\n` +
        `👛 Wallet: ${formatMoney(result.account?.wallet || 0)}\n` +
        `🏦 Bank: ${formatMoney(result.account?.bank || 0)}\n━━━━━━━━━━━━━━━\n\n` +
        `👉 Work again in ${cooldownSec}s`
      , { parse_mode: "Markdown" });
      return;
    }
    
    const success = result.ok ?? false;
    const baseReward = result.reward || 0;
    const baseXp = xpGain;
    
    const statCalc = applyStatBonuses(baseReward, baseXp, stats);
    const finalReward = statCalc.finalReward;
    const finalXp = statCalc.finalXp;
    
    if (finalReward > 0 && success) {
      await ctx.services.economy.addWallet(senderId, finalReward);
    }
    
    const { profile, leveledUp } = await ctx.services.xp.addXp(senderId, finalXp);
    const newBalance = await ctx.services.economy.getBalance(senderId);
    const progress = getProgressBar(profile.xp, profile.level);
    const levelText = getXpLevelText(profile.level);
    const tip = getContextTip({ success }, balance, "work");
    const loopHook = getLoopHook(0, success, "work");
    
    const flavor = FLAVOR[Math.floor(Math.random() * FLAVOR.length)];
    const xpLeft = Math.max(progress.xpLeft, 0);
    const levelUpMsg = leveledUp ? `\n🎉 LEVEL UP! You are now Lv ${profile.level}!` : "";
    
    const scalingParts = getStatScalingText(statCalc.bonuses);
    const bonusText = scalingParts.length > 0 ? scalingParts.map(p => ` (${p})`).join("") : "";
    
    let text = `💼 *Work Complete*\n\n💼 ${flavor}\n\n`;
    text += `━━━━━━━━━━━━━━━\n`;
    text += `💰 Earned: +${formatMoney(finalReward)} coins${bonusText}\n`;
    text += `✨ XP: +${finalXp} ${levelText}\n`;
    text += `📊 ${progress.bar}\n`;
    text += `⬆️ ${xpLeft} XP to next level\n`;
    text += `━━━━━━━━━━━━━━━\n${levelUpMsg}\n\n`;
    
    text += `👛 Wallet: ${formatMoney(newBalance.wallet)}\n`;
    text += `🏦 Bank: ${formatMoney(newBalance.bank)}\n\n`;
    text += `${tip}\n${loopHook}`;
    
    await ctx.reply(text, { parse_mode: "Markdown" });
  },
};