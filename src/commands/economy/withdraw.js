const { formatMoney } = require("../../services/economy-service");

const TRANSFER_FEE = 0.02;

module.exports = {
  meta: {
    name: "withdraw",
    aliases: [],
    category: "economy",
    description: "Withdraw money from bank.",
    cooldownSeconds: 5,
    access: "user",
    chat: "both",
    usage: "<amount>",
  },
  async execute(ctx) {
    const senderId = ctx.msg.senderId;
    const amountInput = ctx.args[0];
    
    if (!amountInput) {
      await ctx.reply(
        `📜 *Usage:* /withdraw <amount>\n\nUse *all* to withdraw everything.`
      , { parse_mode: "Markdown" });
      return;
    }
    
    let amount = parseInt(amountInput.replace(/[$,]/g, ""), 10);
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply("❌ Invalid amount.");
      return;
    }
    
    const balance = await ctx.services.economy.getBalance(senderId);
    
    if (amount > balance.bank) {
      await ctx.reply(`❌ Insufficient bank: ${formatMoney(balance.bank)}`);
      return;
    }
    
    const fee = Math.floor(amount * TRANSFER_FEE);
    const netAmount = amount - fee;
    
    await ctx.services.economy.addBank(senderId, -amount);
    await ctx.services.economy.addWallet(senderId, netAmount);
    
    const newBalance = await ctx.services.economy.getBalance(senderId);
    
    await ctx.reply(
      `💳 *Withdrawal Successful*\n\nYou moved money to your wallet.\n\n━━━━━━━━━━━━━━━\n` +
      `💰 Withdrawn: ${formatMoney(netAmount)}\n` +
      `📜 Fee: -${formatMoney(fee)}\n` +
      `━━━━━━━━━━━━━━━\n\n` +
      `👛 Wallet: ${formatMoney(newBalance.wallet)}\n` +
      `🏦 Bank: ${formatMoney(newBalance.bank)}\n\n💡 Tip: /invest to grow!`
    , { parse_mode: "Markdown" });
  },
};