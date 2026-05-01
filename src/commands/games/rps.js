const constants = require("../../config/constants");
const { formatMoney } = require("../../services/economy-service");
const { getProgressBar, getXpLevelText, getContextTip, getLoopHook } = require("../../utils/xp-utils");

const RPS_OPTIONS = [
  { id: 1, name: "Rock", emoji: "🪨" },
  { id: 2, name: "Paper", emoji: "📄" },
  { id: 3, name: "Scissors", emoji: "✂️" },
];

module.exports = {
  meta: {
    name: "rps",
    aliases: [],
    category: "games",
    description: "Play rock paper scissors.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
  },
  async execute(ctx) {
    const senderId = ctx.msg.senderId;
    const choice = ctx.args[0]?.trim();
    const hasActiveSession = ctx.services.games._rpsSessions?.has(senderId);
    const balance = await ctx.services.economy.getBalance(senderId);

    if (!choice && !hasActiveSession) {
      ctx.services.games.startRpsSession(senderId);
      let text = `🎮 *Rock Paper Scissors*\n\n*Choose your move:*\n\n`;
      RPS_OPTIONS.forEach(o => {
        text += `${o.id}. ${o.emoji} ${o.name}\n`;
      });
      text += `\n━━━━━━━━━━━━━━━\n*Reply with a number.*\n━━━━━━━━━━━━━━━`;
      await ctx.reply(text, { parse_mode: "Markdown" });
      return;
    }

    if (hasActiveSession && !choice) {
      await ctx.reply(`Reply with a number (1-3).`);
      return;
    }

    const choiceNum = parseInt(choice, 10);
    if (hasActiveSession) {
      ctx.services.games.clearRpsSession(senderId);
      if ([1, 2, 3].includes(choiceNum)) {
        const playerChoice = RPS_OPTIONS.find(o => o.id === choiceNum);
        const result = ctx.services.games.playRpsNumber(playerChoice.name.toLowerCase());
        const reward = constants.economy.gameRewards.rps[result.outcome];
        const [profile, balance] = await Promise.all([
          ctx.services.xp.addXp(senderId, reward.xp),
          ctx.services.economy.rewardGame(senderId, reward),
        ]);
        const emoji = result.outcome === "win" ? "✅" : result.outcome === "draw" ? "🤝" : "❌";
        const botEmoji = result.botChoice === "rock" ? "🪨" : result.botChoice === "paper" ? "📄" : "✂️";
        const resultText = result.outcome === "win" ? "You win!" : result.outcome === "draw" ? "It's a draw!" : "You lose!";
        const progress = getProgressBar(profile.xp, profile.level);
        const levelText = getXpLevelText(profile.level);
        const tip = getContextTip({ success: reward.cash > 0 }, balance, "game");
        const loopHook = getLoopHook(0, reward.cash > 0, "rps");
        
        let text = `🎮 *RPS Result*\n\n${emoji} ${resultText}\n\n`;
        text += `━━━━━━━━━━━━━━━\n`;
        text += `You: ${playerChoice.emoji} ${playerChoice.name}\n`;
        text += `Bot: ${botEmoji} ${result.botChoice.charAt(0).toUpperCase() + result.botChoice.slice(1)}\n`;
        text += `━━━━━━━━━━━━━━━\n`;
        text += `💰 ${reward.cash > 0 ? "Won" : "Result"}: ${reward.cash > 0 ? "+" : ""}${formatMoney(reward.cash)} coins\n`;
        text += `✨ XP: +${reward.xp} ${levelText}\n`;
        text += `📊 ${progress.bar}\n`;
        text += `⬆️ ${progress.xpLeft} XP to next level\n`;
        text += `━━━━━━━━━━━━━━━\n\n`;
        text += `👛 Wallet: ${formatMoney(balance.wallet)}\n\n`;
        text += reward.cash > 0 ? tip : loopHook;
        
        await ctx.reply(text, { parse_mode: "Markdown" });
        return;
      }
    }

    try {
      const result = ctx.services.games.playRps(choice);
      const reward = constants.economy.gameRewards.rps[result.outcome];
      const [profile, balance] = await Promise.all([
        ctx.services.xp.addXp(senderId, reward.xp),
        ctx.services.economy.rewardGame(senderId, reward),
      ]);
      const emoji = result.outcome === "win" ? "✅" : result.outcome === "draw" ? "🤝" : "❌";
      const resultText = result.outcome === "win" ? "You win!" : result.outcome === "draw" ? "It's a draw!" : "You lose!";
      const progress = getProgressBar(profile.xp, profile.level);
      const levelText = getXpLevelText(profile.level);
      const tip = getContextTip({ success: reward.cash > 0 }, balance, "game");
      const loopHook = getLoopHook(0, reward.cash > 0, "rps");
      
      let text = `🎮 *RPS Result*\n\n${emoji} ${resultText}\n\n`;
      text += `━━━━━━━━━━━━━━━\n`;
      text += `You: ${choice.toLowerCase()}\n`;
      text += `Bot: ${result.botChoice}\n`;
      text += `━━━━━━━━━━━━━━━\n`;
      text += `💰 ${reward.cash > 0 ? "Won" : "Result"}: ${reward.cash > 0 ? "+" : ""}${formatMoney(reward.cash)} coins\n`;
      text += `✨ XP: +${reward.xp} ${levelText}\n`;
      text += `📊 ${progress.bar}\n`;
      text += `⬆️ ${progress.xpLeft} XP to next level\n`;
      text += `━━━━━━━━━━━━━━━\n\n`;
      text += `👛 Wallet: ${formatMoney(balance.wallet)}\n\n`;
      text += reward.cash > 0 ? tip : loopHook;
      
      await ctx.reply(text, { parse_mode: "Markdown" });
    } catch (error) {
      await ctx.reply(`Use *rock*, *paper*, or *scissors* (or reply with a number).`, { parse_mode: "Markdown" });
    }
  },
};