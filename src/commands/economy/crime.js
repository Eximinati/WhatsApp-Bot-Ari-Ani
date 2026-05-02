const { formatMoney } = require("../../services/economy-service");
const { getProgressBar, getXpLevelText, getContextTip, getLoopHook } = require("../../utils/xp-utils");
const { getStatBonuses, getStatScalingText, getSafeStats, applyLossReduction } = require("../../utils/stat-utils");

const FLAVOR_SUCCESS = ["High risk, high reward!", "The heist paid off!", "Clean getaway today!"];
const FLAVOR_FAIL = ["Caught! Better luck next time.", "The risk wasn't worth it.", "Don't get caught again!"];

module.exports = {
  meta: {
    name: "crime",
    aliases: [],
    category: "economy",
    description: "Commit crime for money.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
  },
  async execute(ctx) {
    const senderId = ctx.msg.senderId;
    
    const result = await ctx.services.economy.crime(senderId);
    const balance = await ctx.services.economy.getBalance(senderId);
    const { stats: rawStats } = await ctx.services.xp.getStats(senderId);
    const stats = getSafeStats({ statsJson: JSON.stringify(rawStats) });
    
    if (!result.ok) {
      const cooldownSec = Math.ceil((result.remainingMs || 0) / 1000);
      await ctx.reply(
        `🔪 *Crime*\n\n⏳ Cooldown: ${cooldownSec}s\n\n━━━━━━━━━━━━━━━\n` +
        `👛 Wallet: ${formatMoney(result.account?.wallet || 0)}\n` +
        `🏦 Bank: ${formatMoney(result.account?.bank || 0)}\n━━━━━━━━━━━━━━━\n\n` +
        `👉 Try again in ${cooldownSec}s`
      , { parse_mode: "Markdown" });
      return;
    }
    
    const success = result.success ?? false;
    const xpBase = success ? 25 : 5;
    let rewardChange = success ? (result.reward || 0) : -(Math.abs(result.reward) || 0);
    let finalXp = xpBase;
    
    // Apply defense loss reduction
    let lossReductionText = "";
    if (!success && rewardChange < 0) {
      const lossResult = applyLossReduction(Math.abs(rewardChange), stats);
      rewardChange = -lossResult.reducedLoss;
      if (lossResult.saved > 0) {
        lossReductionText = ` (-${lossResult.saved} DEF)`;
      }
    }
    
    // Apply strength bonus for success
    if (success) {
      const bonuses = getStatBonuses(stats);
      rewardChange = Math.floor(rewardChange * bonuses.rewardScale);
    }
    
    // Apply XP bonus
    if (success) {
      const bonuses = getStatBonuses(stats);
      finalXp = Math.floor(xpBase * bonuses.xpScale);
    }
    
    // Add XP
    const { profile, leveledUp } = await ctx.services.xp.addXp(senderId, finalXp);
    const newBalance = await ctx.services.economy.getBalance(senderId);
    const progress = getProgressBar(profile.xp, profile.level);
    const levelText = getXpLevelText(profile.level);
    const tip = getContextTip({ success }, balance, "risky");
    const loopHook = getLoopHook(0, success, "crime");
    
    const emoji = success ? "💰" : "🚔";
    const flavor = success 
      ? FLAVOR_SUCCESS[Math.floor(Math.random() * FLAVOR_SUCCESS.length)]
      : FLAVOR_FAIL[Math.floor(Math.random() * FLAVOR_FAIL.length)];
    const title = success ? "🔪 Crime Success" : "🔪 Busted!";
    const xpLeft = Math.max(progress.xpLeft, 0);
    const levelUpMsg = leveledUp ? `\n🎉 LEVEL UP! You are now Lv ${profile.level}!` : "";
    
    const bonuses = getStatBonuses(stats);
    const scalingParts = getStatScalingText(bonuses);
    const bonusText = scalingParts.length > 0 ? scalingParts.map(p => ` (${p})`).join("") : "";
    
    let text = `${title}\n\n${emoji} ${flavor}\n\n`;
    text += `━━━━━━━━━━━━━━━\n`;
    text += `💰 ${success ? "Earned" : "Lost"}: ${success ? "+" : ""}${formatMoney(Math.abs(rewardChange))} coins${lossReductionText}${bonusText}\n`;
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