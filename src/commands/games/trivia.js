const constants = require("../../config/constants");
const { formatMoney } = require("../../services/economy-service");
const { getProgressBar, getXpLevelText, getContextTip, getLoopHook } = require("../../utils/xp-utils");
const { applyStatBonuses, getStatScalingText, getSafeStats } = require("../../utils/stat-utils");

const FLAVOR_WIN = ["Knowledge pays off!", "Smart move!", "Well done!"];
const FLAVOR_LOSE = ["So close!", "Better luck next time!", "Learn and try again!"];

module.exports = {
  meta: {
    name: "trivia",
    aliases: [],
    category: "games",
    description: "Answer trivia questions.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
  },
  async execute(ctx) {
    const senderId = ctx.msg.senderId;
    const answer = ctx.args.join(" ").trim();
    const hasActiveSession = ctx.services.games._triviaSessions?.has(senderId);
    const balance = await ctx.services.economy.getBalance(senderId);
    const { stats: rawStats } = await ctx.services.xp.getStats(senderId);
    const stats = getSafeStats({ statsJson: JSON.stringify(rawStats) });
    
    if (!answer && !hasActiveSession) {
      const question = ctx.services.games.startTrivia(senderId);
      let text = `🧠 *Trivia Challenge*\n\n*Question:*\n${question.question}\n\n`;
      question.options.forEach((option, index) => {
        text += `${index + 1}. ${option}\n`;
      });
      text += `\n━━━━━━━━━━━━━━━\n*Reply with a number.*\n━━━━━━━━━━━━━━━\n\n💡 Answer to win XP + coins!`;
      await ctx.reply(text, { parse_mode: "Markdown" });
      return;
    }
    
    if (hasActiveSession && !answer) {
      await ctx.reply(`Reply with a number (1-4).`);
      return;
    }
    
    const result = ctx.services.games.answerTrivia(senderId, answer);
    if (!result) {
      await ctx.reply(`No active trivia. Use /trivia to start.`);
      return;
    }
    
    const reward = constants.economy.gameRewards.trivia;
    const success = result.correct;
    
    const statCalc = applyStatBonuses(reward.cash, reward.xp, stats);
    const finalReward = { cash: statCalc.finalReward, xp: statCalc.finalXp };
    
    if (success) {
      await ctx.services.economy.rewardGame(senderId, finalReward);
    }
    
    const { profile, leveledUp } = await ctx.services.xp.addXp(senderId, finalReward.xp);
    const newBalance = await ctx.services.economy.getBalance(senderId);
    const progress = getProgressBar(profile.xp, profile.level);
    const levelText = getXpLevelText(profile.level);
    const tip = getContextTip({ success }, balance, "game");
    const loopHook = getLoopHook(0, success, "trivia");
    
    const xpLeft = Math.max(progress.xpLeft, 0);
    const levelUpMsg = leveledUp ? `\n🎉 LEVEL UP! You are now Lv ${profile.level}!` : "";
    
    const scalingParts = getStatScalingText(statCalc.bonuses);
    const bonusText = scalingParts.length > 0 ? scalingParts.map(p => ` (${p})`).join("") : "";
    
    if (success) {
      const flavor = FLAVOR_WIN[Math.floor(Math.random() * FLAVOR_WIN.length)];
      
      let text = `✅ *Correct!*\n\n${flavor}\n\n━━━━━━━━━━━━━━━\n`;
      text += `Answer: ${result.correctAnswer}\n`;
      text += `💰 Earned: +${formatMoney(finalReward.cash)} coins${bonusText}\n`;
      text += `✨ XP: +${finalReward.xp} ${levelText}\n`;
      text += `📊 ${progress.bar}\n`;
      text += `⬆️ ${xpLeft} XP to next level\n`;
      text += `━━━━━━━━━━━━━━━\n${levelUpMsg}\n\n`;
      text += `👛 Wallet: ${formatMoney(newBalance.wallet)}\n\n`;
      text += `${tip}\n${loopHook}`;
      
      await ctx.reply(text, { parse_mode: "Markdown" });
      return;
    }
    
    const flavor = FLAVOR_LOSE[Math.floor(Math.random() * FLAVOR_LOSE.length)];
    let text = `❌ *Wrong!*\n\n${flavor}\n\n━━━━━━━━━━━━━━━\n`;
    text += `Answer: ${result.correctAnswer}\n`;
    text += `━━━━━━━━━━━━━━━\n${levelUpMsg}\n\n`;
    text += `${tip}\n${loopHook}`;
    
    await ctx.reply(text, { parse_mode: "Markdown" });
  },
};