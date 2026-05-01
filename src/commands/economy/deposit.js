const { formatMoney } = require("../../services/economy-service");

const MAX_BANK = 100000;
const TRANSFER_FEE = 0.03;

module.exports = {
  meta: {
    name: "deposit",
    aliases: [],
    category: "economy",
    description: "Deposit money to bank.",
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
        `📜 *Usage:* /deposit <amount>\n\nUse *all* to deposit everything.`
      , { parse_mode: "Markdown" });
      return;
    }
    
    let amount = parseInt(amountInput.replace(/[$,]/g, ""), 10);
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply("❌ Invalid amount.");
      return;
    }
    
    const balance = await ctx.services.economy.getBalance(senderId);
    
    if (amount > balance.wallet) {
      await ctx.reply(`❌ Insufficient wallet: ${formatMoney(balance.wallet)}`);
      return;
    }
    
    const bankSpace = MAX_BANK - balance.bank;
    if (bankSpace <= 0) {
      await ctx.reply(`🏦 Bank full! Max: ${formatMoney(MAX_BANK)}`);
      return;
    }
    
    amount = Math.min(amount, bankSpace);
    const fee = Math.floor(amount * TRANSFER_FEE);
    const netAmount = amount - fee;
    
    await ctx.services.economy.addWallet(senderId, -netAmount);
    await ctx.services.economy.addBank(senderId, netAmount);
    
    const newBalance = await ctx.services.economy.getBalance(senderId);
    
    await ctx.reply(
      `🏦 *Deposit Successful*\n\nYou moved money to your bank.\n\n━━━━━━━━━━━━━━━\n` +
      `💰 Deposited: ${formatMoney(netAmount)}\n` +
      `📜 Fee: -${formatMoney(fee)}\n` +
      `━━━━━━━━━━━━━━━\n\n` +
      `👛 Wallet: ${formatMoney(newBalance.wallet)}\n` +
      `🏦 Bank: ${formatMoney(newBalance.bank)}\n\n💡 Use /invest to grow savings!`
    , { parse_mode: "Markdown" });
  },
};