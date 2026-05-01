const { formatMoney } = require("../../services/economy-service");
const { getProgressBar, getXpLevelText, getContextTip, getLoopHook } = require("../../utils/xp-utils");
const { applyStatBonuses, getStatScalingText, getSafeStats } = require("../../utils/stat-utils");

const XP_GAINS = { fish: 8, mine: 10, hunt: 12, work: 15, beg: 3 };

const FLAVOR = {
  success: ["A generous soul!", "Someone cared today!", "Your luck brought returns!"],
  fail: ["No luck today.", "Better try /work.", "Nothing this time."]
};

module.exports = {
  meta: {
    name: "beg",
    aliases: [],
    category: "economy",
    description: "Beg for money.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
  },
  async execute(ctx) {
    const senderId = ctx.msg.senderId;
    
    const result = await ctx.services.economy.beg(senderId);
    const balance = await ctx.services.economy.getBalance(senderId);
    const { stats: rawStats } = await ctx.services.xp.getStats(senderId);
    const stats = getSafeStats({ statsJson: JSON.stringify(rawStats) });
    const xpGain = XP_GAINS.beg;
    
    if (!result.ok) {
      const cooldownSec = Math.ceil((result.remainingMs || 0) / 1000);
      await ctx.reply(
        `🙏 *Begging*\n\n⏳ Cooldown: ${cooldownSec}s\n\n━━━━━━━━━━━━━━━\n` +
        `👛 Wallet: ${formatMoney(result.account?.wallet || 0)}\n` +
        `🏦 Bank: ${formatMoney(result.account?.bank || 0)}\n━━━━━━━━━━━━━━━\n\n` +
        `👉 Try again in ${cooldownSec}s`
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
    const tip = getContextTip({ success }, balance, "beg");
    const loopHook = getLoopHook(0, success, "beg");
    
    const flavor = success 
      ? FLAVOR.success[Math.floor(Math.random() * FLAVOR.success.length)]
      : FLAVOR.fail[Math.floor(Math.random() * FLAVOR.fail.length)];
    
    const xpLeft = Math.max(progress.xpLeft, 0);
    const levelUpMsg = leveledUp ? `\n🎉 LEVEL UP! You are now Lv ${profile.level}!` : "";
    
    const scalingParts = getStatScalingText(statCalc.bonuses);
    const bonusText = scalingParts.length > 0 ? scalingParts.map(p => ` (${p})`).join("") : "";
    
    let text = `🙏 *Begging Result*\n\n💕 ${flavor}\n\n`;
    text += `━━━━━━━━━━━━━━━\n`;
    text += `💰 Earned: ${success ? "+" : ""}${formatMoney(finalReward)} coins${bonusText}\n`;
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