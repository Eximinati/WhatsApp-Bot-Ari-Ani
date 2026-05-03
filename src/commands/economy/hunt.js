const { formatMoney } = require("../../services/economy-service");
const { getProgressBar, getLoopHook } = require("../../utils/xp-utils");
const { getStatBonuses, getSafeStats } = require("../../utils/stat-utils");
const {
  getAnticipationLine,
  getCooldownPsychology,
  getSuccessHook,
  getFailHook,
  getNearMissLine,
  getSessionHook,
  getCurrentTier,
  getProgressToNextTier,
  getStreakTierText,
  getFakeRareReveal,
  getRareMeterDisplay,
  getNearRareMessage,
  getFailurePsychology,
  getMomentumText,
  getRareBuildupMessage,
  getLossAversionHook,
  getNextActionHook,
  getMiniJackpotIllusion,
  getFailBiasText,
} = require("../../utils/addiction-engine");

const XP_GAINS = { fish: 8, mine: 10, hunt: 12, work: 15, beg: 3 };

const FLAVOR = {
  success: ["A successful hunt!", "Your prey was caught!", "The hunt paid off!"],
  fail: ["Your prey escaped.", "No catch today.", "The wild remains free."]
};

module.exports = {
  meta: {
    name: "hunt",
    aliases: [],
    category: "economy",
    description: "Go hunting.",
    cooldownSeconds: 1800,
    access: "user",
    chat: "both",
  },
  async execute(ctx) {
    const senderId = ctx.msg.senderId;
    const xpGain = XP_GAINS.hunt;
    const totalCooldown = ctx.command.meta.cooldownSeconds * 1000;

    await ctx.reply(`🏹 ${getAnticipationLine("hunt")}`);

    try {
      const result = await ctx.services.economy.hunt(senderId);
      const { stats: rawStats } = await ctx.services.xp.getStats(senderId);
      const stats = getSafeStats({ statsJson: JSON.stringify(rawStats) });

      if (!result.ok) {
        const remainingSec = Math.ceil((result.remainingMs || 0) / 1000);
        const cooldownMsg = getCooldownPsychology(result.remainingMs, totalCooldown);
        const failStreak = result.failStreak || 0;
        const lastResult = result.lastResult || "";
        const sessionHook = getSessionHook("afterCooldown");
        const rareMeter = result.rareMeter || 0;
        const rareMeterDisplay = getRareMeterDisplay(rareMeter);
        const sessionCount = result.sessionCount || 0;
        const momentumText = getMomentumText(sessionCount);
        const lossAversionHook = getLossAversionHook(failStreak);
        const nextActionHook = getNextActionHook({ onCooldown: true });
        
        await ctx.reply(
          `🏹 *Hunting*\n\n⏳ ${remainingSec}s — ${cooldownMsg}\n\n━━━━━━━━━━━━━━━\n${rareMeterDisplay}\n${momentumText || ""}\n━━━━━━━━━━━━━━━\n👛 Wallet: ${formatMoney(result.account?.wallet || 0)}\n🏦 Bank: ${formatMoney(result.account?.bank || 0)}\n━━━━━━━━━━━━━━━\n${sessionHook}\n${lossAversionHook || ""}\n\n${nextActionHook}`
        , { parse_mode: "Markdown" });
        return;
      }

      const success = result.success ?? false;
      const baseReward = result.reward || 0;
      const baseXp = xpGain;
      const streak = result.streak || 0;
      const rareMeter = result.rareMeter || 0;
      const sessionCount = result.sessionCount || 0;
      const failStreak = result.failStreak || 0;
      const lastResult = result.lastResult || "";
      const triggeredRare = !!result.rare;

      const bonuses = getStatBonuses(stats);
      const potentialBonus = Math.floor(baseReward * (bonuses.rewardScale - 1));
      const intBonus = Math.floor(baseXp * (bonuses.xpScale - 1));

      const displayXp = baseXp + intBonus;

      const { profile, leveledUp } = await ctx.services.xp.addXp(senderId, displayXp);
      const newBalance = await ctx.services.economy.getBalance(senderId);
      const progress = getProgressBar(profile.xp, profile.level);
      const loopHook = getLoopHook(0, success, "hunt");
      const sessionHook = success ? getSuccessHook() : getFailHook();
      const currentTier = getCurrentTier(profile.level);
      const tierProgress = getProgressToNextTier(profile.xp, profile.level);

      const flavor = success
        ? FLAVOR.success[Math.floor(Math.random() * FLAVOR.success.length)]
        : FLAVOR.fail[Math.floor(Math.random() * FLAVOR.fail.length)];

      const title = success ? "🏹 Hunting Result" : "🏹 No Catch";
      const emoji = success ? "🦌" : "💨";
      const xpLeft = Math.max(progress.xpLeft, 0);
      const levelUpMsg = leveledUp ? `\n🎉 LEVEL UP! You are now Lv ${profile.level}!` : "";

      let text = `${title}\n\n${emoji} ${flavor}\n\n`;

      const failBiasText = !success ? getFailBiasText(failStreak) : null;
      const emotionalHook = failBiasText
        || getNearRareMessage(rareMeter, triggeredRare) 
        || getRareBuildupMessage(rareMeter, triggeredRare)
        || getMiniJackpotIllusion(rareMeter, triggeredRare)
        || (success ? null : getFailurePsychology("hunt"));
      
      if (emotionalHook) {
        text += `${emotionalHook}\n\n`;
      }

      if (!success) {
        const lossAversionHook = getLossAversionHook(failStreak);
        if (lossAversionHook && !failBiasText) {
          text += `${lossAversionHook}\n`;
        }
        if (Math.random() < 0.5) {
          text += `😬 ${getNearMissLine()}\n\n`;
        }
      }

      text += `━━━━━━━━━━━━━━━\n`;

      if (result.rare) {
        text += `🎉 *RARE EVENT!*\n${result.rare.text}\n\n━━━━━━━━━━━━━━━\n`;
      }

      text += `💰 Earned: ${success ? "+" : ""}${formatMoney(baseReward)} coins\n`;
      
      const streakTierText = getStreakTierText(streak);
      if (streakTierText) text += `${streakTierText}\n`;
      
      if (success) {
        const rareMeterDisplay = getRareMeterDisplay(rareMeter);
        text += `${rareMeterDisplay}\n`;
      }
      
      if (potentialBonus > 0) text += `📈 Potential Bonus (locked): +${formatMoney(potentialBonus)} coins\n`;
      text += `✨ XP: +${baseXp}\n`;
      if (intBonus > 0) text += `🧠 INT Bonus: +${intBonus} XP applied\n`;
      text += `📊 ${progress.bar}\n`;
      text += `⬆️ ${xpLeft} XP to next level\n`;
      if (tierProgress < 100) {
        text += `🎖️ Tier [${currentTier}]: ${tierProgress}% to next\n`;
      }
      text += `━━━━━━━━━━━━━━━\n${levelUpMsg}\n\n`;

      const momentumText = getMomentumText(sessionCount);
      if (momentumText) {
        text += `${momentumText}\n`;
      }

      if (success && !result.rare && Math.random() < 0.2) {
        text += `✨ ${getFakeRareReveal()}\n\n`;
      }

      text += `👛 Wallet: ${formatMoney(newBalance.wallet)}\n`;
      text += `🏦 Bank: ${formatMoney(newBalance.bank)}\n\n`;
      
      const nextActionHook = getNextActionHook({ rareMeter, streak, failStreak, lastResult, triggeredRare });
      text += `${sessionHook}\n${nextActionHook}\n${loopHook}`;

      await ctx.reply(text, { parse_mode: "Markdown" });

    } catch (err) {
      throw err;
    }
  },
};