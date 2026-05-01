const { formatMoney } = require("../../services/economy-service");
const BONDS = new Map();

const MIN_BOND = 100;
const MAX_BOND = 2000;
const BOND_DURATION = 60 * 60 * 1000;

const BOND_OPTIONS = [
  { name: "Quick Trade", amount: 100, profit: 20, duration: 60 },
  { name: "Standard", amount: 500, profit: 120, duration: 60 },
  { name: "Premium", amount: 1000, profit: 300, duration: 60 },
  { name: "VIP", amount: 2000, profit: 700, duration: 60 },
];

module.exports = {
  meta: {
    name: "bond",
    aliases: [],
    category: "economy",
    description: "Buy locked bond for fixed profit.",
    cooldownSeconds: 3,
    access: "user",
    chat: "both",
  },
  async execute(ctx) {
    const senderId = ctx.msg.senderId;
    const action = ctx.args[0]?.toLowerCase();
    
    const activeBond = BONDS.get(senderId);
    if (activeBond && Date.now() < activeBond.unlocksAt) {
      const remaining = Math.ceil((activeBond.unlocksAt - Date.now()) / 60000);
      await ctx.reply(
        `🔒 *Bond Active*\n\n${activeBond.name}\n\n⏳ *Time remaining:* ${remaining} min\n\nUse /bond when ready.`
      , { parse_mode: "Markdown" });
      return;
    }
    
    if (activeBond && Date.now() >= activeBond.unlocksAt) {
      const profit = activeBond.profit;
      await ctx.services.economy.addWallet(senderId, activeBond.amount + profit);
      await ctx.reply(
        `🔓 *Bond Matured!*\n\n🎉 Your bond has matured!\n\n━━━━━━━━━━━━━━━\n` +
        `Invested: ${formatMoney(activeBond.amount)}\n` +
        `Profit: +${formatMoney(profit)}\n` +
        `━━━━━━━━━━━━━━━\n\n` +
        `💰 Returned: ${formatMoney(activeBond.amount + profit)}`
      , { parse_mode: "Markdown" });
      BONDS.delete(senderId);
      return;
    }
    
    if (!action || action === "info") {
      let text = `📜 *Bond Market*\n\n*Choose your bond:*\n\n`;
      BOND_OPTIONS.forEach((b, i) => {
        text += `${i + 1}. ${b.name}\n   💰 Cost: ${formatMoney(b.amount)}\n   📈 Profit: +${formatMoney(b.profit)}\n\n`;
      });
      text += `━━━━━━━━━━━━━━━\n*Lock period: 60 minutes*\n━━━━━━━━━━━━━━━\n\n`;
      text += `Use: /bond buy <1-4>`;
      await ctx.reply(text, { parse_mode: "Markdown" });
      return;
    }
    
    if (action === "buy") {
      const bondNum = parseInt(ctx.args[1], 10) - 1;
      const bond = BOND_OPTIONS[bondNum];
      
      if (!bond || bondNum < 0) {
        await ctx.reply("❌ Invalid bond. Use /bond to see options.");
        return;
      }
      
      const balance = await ctx.services.economy.getBalance(senderId);
      
      if (bond.amount > balance.wallet) {
        await ctx.reply(`❌ Insufficient: ${formatMoney(balance.wallet)}`);
        return;
      }
      
      await ctx.services.economy.addWallet(senderId, -bond.amount);
      
      BONDS.set(senderId, {
        amount: bond.amount,
        profit: bond.profit,
        unlocksAt: Date.now() + BOND_DURATION,
        name: bond.name,
      });
      
      await ctx.reply(
        `📜 *Bond Purchased*\n\n${bond.name}\n\n🔒 *Locked:* ${formatMoney(bond.amount)}\n` +
        `📈 *Profit:* +${formatMoney(bond.profit)}\n\n⏳ *Unlocks in 60 minutes...*\n\n━━━━━━━━━━━━━━━\n` +
        `Auto-collects when ready!\n━━━━━━━━━━━━━━━\n\n👉 Use /bond to collect later!`
      , { parse_mode: "Markdown" });
      return;
    }
  },
};