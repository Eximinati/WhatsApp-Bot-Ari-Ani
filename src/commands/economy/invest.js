const { formatMoney } = require("../../services/economy-service");
const INVESTS = new Map();

const MIN_INVEST = 50;
const MAX_INVEST = 5000;
const INVEST_COOLDOWN = 15 * 60 * 1000;

const OUTCOMES = [
  { type: "profit", min: 10, max: 40 },
  { type: "profit", min: 15, max: 35 },
  { type: "profit", min: 10, max: 25 },
  { type: "break", min: 0, max: 0 },
  { type: "loss", min: -10, max: -25 },
  { type: "loss", min: -15, max: -30 },
];

function getRandomOutcome() {
  const outcome = OUTCOMES[Math.floor(Math.random() * OUTCOMES.length)];
  const percent = outcome.min + Math.floor(Math.random() * (outcome.max - outcome.min + 1));
  return percent;
}

function getRiskLevel(result) {
  if (result >= 20) return "🟢 Low";
  if (result >= 0) return "🟡 Medium";
  return "🔴 High";
}

function getRiskEmoji(result) {
  if (result >= 20) return "📗";
  if (result >= 0) return "📙";
  return "📕";
}

module.exports = {
  meta: {
    name: "invest",
    aliases: [],
    category: "economy",
    description: "Invest money for profit or loss.",
    cooldownSeconds: 5,
    access: "user",
    chat: "both",
  },
  async execute(ctx) {
    const senderId = ctx.msg.senderId;
    const amountInput = ctx.args[0];
    
    const lastInvest = INVESTS.get(senderId);
    if (lastInvest && Date.now() < lastInvest + INVEST_COOLDOWN) {
      const remaining = Math.ceil((lastInvest + INVEST_COOLDOWN - Date.now()) / 60000);
      await ctx.reply(
        `📈 *Investment*\n\n⏳ *Cooldown:* ${remaining} min\n\nUse /invest when ready.`
      , { parse_mode: "Markdown" });
      return;
    }
    
    if (!amountInput) {
      await ctx.reply(
        `📈 *Investment*\n\n` +
        `Minimum: ${formatMoney(MIN_INVEST)}\n` +
        `Maximum: ${formatMoney(MAX_INVEST)}\n\n` +
        `Risk: -30% to +40%\n` +
        `Cooldown: 15 minutes\n\n━━━━━━━━━━━━━━━\n` +
        `Use: /invest <amount>\n━━━━━━━━━━━━━━━`
      , { parse_mode: "Markdown" });
      return;
    }
    
    let amount = parseInt(amountInput.replace(/[$,]/g, ""), 10);
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply("❌ Invalid amount.");
      return;
    }
    
    const balance = await ctx.services.economy.getBalance(senderId);
    
    if (amount < MIN_INVEST) {
      await ctx.reply(`❌ Minimum: ${formatMoney(MIN_INVEST)}`);
      return;
    }
    
    if (amount > MAX_INVEST) {
      await ctx.reply(`❌ Maximum: ${formatMoney(MAX_INVEST)}`);
      return;
    }
    
    if (amount > balance.wallet) {
      await ctx.reply(`❌ Insufficient: ${formatMoney(balance.wallet)}`);
      return;
    }
    
    await ctx.services.economy.addWallet(senderId, -amount);
    INVESTS.set(senderId, Date.now());
    
    const result = getRandomOutcome();
    const profit = Math.floor(amount * result / 100);
    const finalAmount = amount + profit;
    const minReturn = Math.floor(amount * 0.7);
    const maxReturn = Math.floor(amount * 1.4);
    const riskEmoji = getRiskEmoji(result);
    const riskLevel = getRiskLevel(result);
    
    setTimeout(async () => {
      await ctx.services.economy.addWallet(senderId, finalAmount);
      
      const emoji = profit > 0 ? "📈" : profit < 0 ? "📉" : "➖";
      const resultText = profit > 0 ? "PROFIT!" : profit < 0 ? "LOSS" : "Break-even";
      const flavor = profit > 0 ? "Your investment grew!" : profit < 0 ? "Market took a dip." : "No change today.";
      
      await ctx.reply(
        `📈 *Investment Result*\n\n${emoji} ${resultText}\n\n${flavor}\n\n━━━━━━━━━━━━━━━\n` +
        `Invested: ${formatMoney(amount)}\n` +
        `${emoji} ${profit > 0 ? "Profit" : "Change"}: ${profit > 0 ? "+" : ""}${formatMoney(profit)}\n` +
        `━━━━━━━━━━━━━━━\n\n` +
        `💰 Returned: ${formatMoney(finalAmount)}\n\n💡 Tip: /invest again for more!`
      , { parse_mode: "Markdown" });
    }, 5000);
    
    await ctx.reply(
      `📈 *Investment Started*\n\nYou invested: ${formatMoney(amount)} coins\n\n⏳ *Processing...*\n${riskLevel}\n\n━━━━━━━━━━━━━━━\n` +
      `*Potential Outcome:*\n💰 ${formatMoney(minReturn)} → ${formatMoney(maxReturn)}\n━━━━━━━━━━━━━━━\n\n` +
      `👉 Check back in 5 seconds!`
    , { parse_mode: "Markdown" });
  },
};