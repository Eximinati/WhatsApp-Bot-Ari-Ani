const { formatMoney } = require("../../services/economy-service");
const { getProgressBar, getXpLevelText, getContextTip, getLoopHook } = require("../../utils/xp-utils");
const { rollRareEvent, applyStatBonuses, getStatScalingText, getSafeStats, applyLossReduction } = require("../../utils/stat-utils");

const XP_GAINS = { fish: 8, mine: 10, hunt: 12, work: 15, beg: 3 };
const BASE_BONUS = { fish: 100, mine: 150, hunt: 120, work: 80, beg: 20 };

const FLAVOR = {
  success: ["Your pickaxe struck rich ore!", "The mountain rewarded you!", "You found valuable minerals!"],
  fail: ["Better luck next time.", "Only stones today.", "No luck in this shaft."]
};

module.exports = {
  meta: {
    name: "mine",
    aliases: [],
    category: "economy",
    description: "Go mining.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
  },
  async execute(ctx) {
    const senderId = ctx.msg.senderId;
    
    const result = await ctx.services.economy.mine(senderId);
    const balance = await ctx.services.economy.getBalance(senderId);
    const { stats: rawStats } = await ctx.services.xp.getStats(senderId);
    const stats = getSafeStats({ statsJson: JSON.stringify(rawStats) });
    const xpGain = XP_GAINS.mine;
    
    if (!result.ok) {
      const cooldownSec = Math.ceil((result.remainingMs || 0) / 1000);
      await ctx.reply(
        `⛏️ *Mining*\n\n⏳ Cooldown: ${cooldownSec}s\n\n━━━━━━━━━━━━━━━\n` +
        `👛 Wallet: ${formatMoney(result.account?.wallet || 0)}\n` +
        `🏦 Bank: ${formatMoney(result.account?.bank || 0)}\n━━━━━━━━━━━━━━━\n\n` +
        `👉 Mine again in ${cooldownSec}s`
      , { parse_mode: "Markdown" });
      return;
    }
    
    const success = result.success ?? false;
    const baseReward = result.reward || 0;
    const baseXp = xpGain;
    
    const statCalc = applyStatBonuses(baseReward, baseXp, stats);
    let finalReward = statCalc.finalReward;
    let finalXp = statCalc.finalXp;
    
    const rare = rollRareEvent(BASE_BONUS.mine, xpGain, stats);
    if (rare && success) {
      if (rare.coins) finalReward += rare.coins;
      if (rare.xp) finalXp += rare.xp;
      if (rare.multiplier) finalReward = Math.floor(finalReward * rare.multiplier);
    }
    
    if (finalReward > 0 && success) {
      await ctx.services.economy.addWallet(senderId, finalReward);
    }
    
    const { profile, leveledUp } = await ctx.services.xp.addXp(senderId, finalXp);
    const newBalance = await ctx.services.economy.getBalance(senderId);
    const progress = getProgressBar(profile.xp, profile.level);
    const levelText = getXpLevelText(profile.level);
    const tip = getContextTip({ success }, balance, "gathering");
    const loopHook = getLoopHook(0, success, "mine");
    
    const flavor = success 
      ? FLAVOR.success[Math.floor(Math.random() * FLAVOR.success.length)]
      : FLAVOR.fail[Math.floor(Math.random() * FLAVOR.fail.length)];
    
    const title = success ? "⛏️ Mining Result" : "⛏️ Empty Shaft";
    const emoji = success ? "💎" : "💨";
    const xpLeft = Math.max(progress.xpLeft, 0);
    const levelUpMsg = leveledUp ? `\n🎉 LEVEL UP! You are now Lv ${profile.level}!` : "";
    
    const scalingParts = getStatScalingText(statCalc.bonuses);
    const bonusText = scalingParts.length > 0 ? scalingParts.map(p => ` (${p})`).join("") : "";
    
    let text = `${title}\n\n${emoji} ${flavor}\n\n`;
    
    if (rare && success) {
      text += `🎉 *RARE EVENT!*\n${rare.text}\n\n━━━━━━━━━━━━━━━\n`;
      text += `💰 Earned: +${formatMoney(finalReward)} coins\n`;
      if (rare.coins) text += `🎁 Bonus: +${formatMoney(rare.coins)} coins!\n`;
      text += `✨ XP: +${finalXp} ${levelText}${bonusText}\n`;
      text += `📊 ${progress.bar}\n`;
      text += `⬆️ ${xpLeft} XP to next level\n`;
      text += `━━━━━━━━━━━━━━━\n${levelUpMsg}\n\n`;
    } else {
      text += `━━━━━━━━━━━━━━━\n`;
      text += `💰 Earned: ${success ? "+" : ""}${formatMoney(finalReward)} coins${bonusText}\n`;
      text += `✨ XP: +${finalXp} ${levelText}\n`;
      text += `📊 ${progress.bar}\n`;
      text += `⬆️ ${xpLeft} XP to next level\n`;
      text += `━━━━━━━━━━━━━━━\n${levelUpMsg}\n\n`;
    }
    
    text += `👛 Wallet: ${formatMoney(newBalance.wallet)}\n`;
    text += `🏦 Bank: ${formatMoney(newBalance.bank)}\n\n`;
    text += `${tip}\n${loopHook}`;
    
    await ctx.reply(text, { parse_mode: "Markdown" });
  },
};