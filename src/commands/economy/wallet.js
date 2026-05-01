const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "wallet",
    aliases: [],
    category: "economy",
    description: "Show wallet balance.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
  },
  async execute(ctx) {
    const senderId = ctx.msg.senderId;
    const balance = await ctx.services.economy.getBalance(senderId);
    const tool = balance.equippedToolKey || "None";
    
    await ctx.reply(
      `👛 *Your Wallet*\n\n` +
      `━━━━━━━━━━━━━━━\n` +
      `💰 Coins: ${formatMoney(balance.wallet)}\n` +
      `🏦 Bank: ${formatMoney(balance.bank)}\n` +
      `━━━━━━━━━━━━━━━\n\n` +
      `🔧 Tool: ${tool}\n\n💡 Use /invest to grow money!`
    , { parse_mode: "Markdown" });
  },
};