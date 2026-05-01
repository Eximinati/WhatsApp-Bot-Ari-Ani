const constants = require("../../config/constants");
const { formatMoney } = require("../../services/economy-service");
const { getProgressBar, getXpLevelText, getContextTip, getLoopHook } = require("../../utils/xp-utils");
const { applyStatBonuses, getStatScalingText } = require("../../utils/stat-utils");

module.exports = {
  meta: {
    name: "slot",
    aliases: ["slots"],
    category: "games",
    description: "Spin the slot machine.",
    cooldownSeconds: 4,
    access: "user",
    chat: "both",
  },
  async execute(ctx) {
    const senderId = ctx.msg.senderId;
    const result = ctx.services.games.playSlot();
    const reward = constants.economy.gameRewards.slot[result.outcome];
    const balance = await ctx.services.economy.getBalance(senderId);
    const { stats } = await ctx.services.xp.getStats(senderId);
    
    // STAT BONUSES
    const statCalc = applyStatBonuses(reward.cash, reward.xp, stats);
    const finalReward = { cash: statCalc.finalReward, xp: statCalc.finalXp };
    
    await ctx.services.economy.rewardGame(senderId, finalReward);
    const { profile, leveledUp } = await ctx.services.xp.addXp(senderId, finalReward.xp);
    
    const progress = getProgressBar(profile.xp, profile.level);
    const levelText = getXpLevelText(profile.level);
    const success = finalReward.cash > 0;
    const tip = getContextTip({ success }, balance, "game");
    const loopHook = getLoopHook(0, success, "slot");
    
    const emoji = result.outcome === "jackpot" ? "🎰" : result.outcome === "pair" ? "🍒" : "💨";
    const title = result.outcome === "jackpot" ? "🎰 JACKPOT!" : result.outcome === "pair" ? "🎰 Nice Pair!" : "🎰 No Luck";
    const resultText = result.outcome === "jackpot" ? "JACKPOT! You hit the big prize!" : result.outcome === "pair" ? "Well done!" : "Better luck next time.";
    const xpLeft = Math.max(progress.xpLeft, 0);
    const levelUpMsg = leveledUp ? `\n🎉 LEVEL UP! You are now Lv ${profile.level}!` : "";
    
    const scalingParts = getStatScalingText(statCalc.bonuses);
    const bonusText = scalingParts.length > 0 
      ? scalingParts.map(p => ` (+${p})`).join("")
      : "";
    
    let text = `${title}\n\n${emoji} ${resultText}\n\n`;
    text += `━━━━━━━━━━━━━━━\n`;
    text += `🎰 Result: ${result.roll.join(" | ")}\n`;
    text += `💰 ${success ? "Won" : "Win"}: ${success ? "+" : ""}${formatMoney(finalReward.cash)} coins\n`;
    text += `✨ XP: +${finalReward.xp} ${levelText}${bonusText}\n`;
    text += `📊 ${progress.bar}\n`;
    text += `⬆️ ${xpLeft} XP to next level\n`;
    text += `━━━━━━━━━━━━━━━\n${levelUpMsg}\n\n`;
    
    const newBalance = await ctx.services.economy.getBalance(senderId);
    text += `👛 Wallet: ${formatMoney(newBalance.wallet)}\n\n`;
    text += `${tip}\n${loopHook}`;
    
    await ctx.reply(text, { parse_mode: "Markdown" });
  },
};