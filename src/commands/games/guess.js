const constants = require("../../config/constants");
const { formatMoney } = require("../../services/economy-service");
const { getProgressBar, getXpLevelText, getContextTip, getLoopHook } = require("../../utils/xp-utils");

const FLAVOR_WIN = ["Lucky guess!", "Spot on!", "You got it!"];

module.exports = {
  meta: {
    name: "guess",
    aliases: [],
    category: "games",
    description: "Guess the number game.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
  },
  async execute(ctx) {
    const senderId = ctx.msg.senderId;
    const guess = ctx.args[0];
    const balance = await ctx.services.economy.getBalance(senderId);
    
    if (!guess) {
      const range = ctx.services.games.startGuess(senderId);
      await ctx.reply(
        `🎯 *Guess The Number*\n\n*Guess a number between ${range.min} and ${range.max}*\n\n` +
        `Attempts: ${range.max}\n\n━━━━━━━━━━━━━━━\n*Reply with a number.*\n━━━━━━━━━━━━━━━\n\n💡 Win big XP + coins!`
      , { parse_mode: "Markdown" });
      return;
    }

    const result = ctx.services.games.submitGuess(senderId, guess);
    if (!result) {
      await ctx.reply(`No active game. Use /guess to start.`);
      return;
    }

    if (result.status === "correct") {
      const reward = constants.economy.gameRewards.guess;
      const [profile, balance] = await Promise.all([
        ctx.services.xp.addXp(senderId, reward.xp),
        ctx.services.economy.rewardGame(senderId, reward),
      ]);
      const flavor = FLAVOR_WIN[Math.floor(Math.random() * FLAVOR_WIN.length)];
      const progress = getProgressBar(profile.xp, profile.level);
      const levelText = getXpLevelText(profile.level);
      const tip = getContextTip({ success: true }, balance, "game");
      
      await ctx.reply(
        `✅ *Correct!*\n\n${flavor}\n\n━━━━━━━━━━━━━━━\n` +
        `The number was: ${result.target}\n` +
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

    if (result.status === "lost") {
      const loopHook = getLoopHook(0, false, "guess");
      await ctx.reply(
        `❌ *Game Over*\n\n━━━━━━━━━━━━━━━\nThe number was: ${result.target}\n━━━━━━━━━━━━━━━\n\n${loopHook}`
      , { parse_mode: "Markdown" });
      return;
    }

    await ctx.reply(
      `📈 *Hint:* Try *${result.status}*\n\nAttempts left: ${result.attemptsLeft}`
    , { parse_mode: "Markdown" });
  },
};