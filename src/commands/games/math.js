const constants = require("../../config/constants");
const { formatMoney } = require("../../services/economy-service");
const { getProgressBar, getXpLevelText, getContextTip, getLoopHook } = require("../../utils/xp-utils");

module.exports = {
  meta: {
    name: "math",
    aliases: [],
    category: "games",
    description: "Solve math challenges.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
  },
  async execute(ctx) {
    const senderId = ctx.msg.senderId;
    const answer = ctx.args[0];
    const balance = await ctx.services.economy.getBalance(senderId);
    
    if (!answer) {
      const question = ctx.services.games.startMath(senderId);
      await ctx.reply(
        `🧮 *Math Challenge*\n\n*Solve:* ${question}\n\n━━━━━━━━━━━━━━━\n` +
        `Reply with the answer.\n━━━━━━━━━━━━━━━\n\n💡 Solve for XP + coins!`
      , { parse_mode: "Markdown" });
      return;
    }

    const result = ctx.services.games.answerMath(senderId, answer);
    if (!result) {
      await ctx.reply(`No active challenge. Use /math to start.`);
      return;
    }

    if (result.correct) {
      const reward = constants.economy.gameRewards.math;
      const [profile, balance] = await Promise.all([
        ctx.services.xp.addXp(senderId, reward.xp),
        ctx.services.economy.rewardGame(senderId, reward),
      ]);
      const progress = getProgressBar(profile.xp, profile.level);
      const levelText = getXpLevelText(profile.level);
      const tip = getContextTip({ success: true }, balance, "game");
      
      await ctx.reply(
        `✅ *Correct!*\n\n🎉 You solved it!\n\n━━━━━━━━━━━━━━━\n` +
        `Answer: ${result.answer}\n` +
        `💰 Earned: +${formatMoney(reward.cash)} coins\n` +
        `✨ XP: +${reward.xp} ${levelText}\n` +
        `📊 ${progress.bar}\n` +
        `⬆️ ${progress.xpLeft} XP to next level\n` +
        `━━━━━━━━━━━━━━━\n\n` +
        `👛 Wallet: ${formatMoney(balance.wallet)}\n\n` +
        `${tip}`
      , { parse_mode: "Markdown" });
      return;
    }

    const loopHook = getLoopHook(0, false, "math");
    await ctx.reply(
      `❌ *Wrong!*\n\nThe answer was: ${result.answer}\n\n${loopHook}`
    , { parse_mode: "Markdown" });
  },
};