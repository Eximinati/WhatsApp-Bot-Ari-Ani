const { formatMoney } = require("../../services/economy-service");

const MAX_BANK = 100000;

module.exports = {
  meta: {
    name: "bank",
    aliases: [],
    category: "economy",
    description: "Show your bank balance.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const senderId = ctx.msg.senderId;
    const balance = await ctx.services.economy.getBalance(senderId);
    
    await ctx.reply(
      `🏦 *Your Bank*\n\n` +
      `━━━━━━━━━━━━━━━\n` +
      `💰 Balance: ${formatMoney(balance.bank)}\n` +
      `📈 Max: ${formatMoney(MAX_BANK)}\n` +
      `━━━━━━━━━━━━━━━\n\n` +
      `Bank is safe storage only.\n💡 Use /invest for profit!`
    , { parse_mode: "Markdown" });
  },
};