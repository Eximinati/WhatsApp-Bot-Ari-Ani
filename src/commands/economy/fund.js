const { formatMoney } = require("../../services/economy-service");
const FUNDS = new Map();

const MIN_CONTRIBUTION = 50;
const FUND_TYPES = [
  { name: "Food Truck", risk: 0.2, baseProfit: 30 },
  { name: "Tech Startup", risk: 0.5, baseProfit: 80 },
  { name: "Real Estate", risk: 0.3, baseProfit: 50 },
];

module.exports = {
  meta: {
    name: "fund",
    aliases: [],
    category: "economy",
    description: "Join profit-sharing funds.",
    cooldownSeconds: 3,
    access: "user",
    chat: "both",
  },
  async execute(ctx) {
    const senderId = ctx.msg.senderId;
    const action = ctx.args[0]?.toLowerCase();
    const balance = await ctx.services.economy.getBalance(senderId);
    
    const activeFund = FUNDS.get(senderId);
    
    if (action === "create") {
      const fundTypeIdx = parseInt(ctx.args[1], 10) - 1;
      const fundType = FUND_TYPES[fundTypeIdx];
      
      if (!fundType) {
        let text = `📊 *Fund Types*\n\n*Start a fund:*\n\n`;
        FUND_TYPES.forEach((f, i) => {
          text += `${i + 1}. ${f.name}\n   📈 Base: +${f.baseProfit}%\n   🔴 Risk: ${f.risk * 100}%\n\n`;
        });
        text += `━━━━━━━━━━━━━━━\n*Use: /fund create <1-3>\n━━━━━━━━━━━━━━━`;
        await ctx.reply(text, { parse_mode: "Markdown" });
        return;
      }
      
      FUNDS.set(senderId + "_pool", {
        type: fundType,
        owner: senderId,
        contributors: [],
        total: 0,
        createdAt: Date.now(),
      });
      
      await ctx.reply(
        `✅ *Fund Created*\n\n${fundType.name}\n\n*Now use /fund join <amount>*`
      , { parse_mode: "Markdown" });
      return;
    }
    
    if (action === "join") {
      if (!ctx.args[1]) {
        await ctx.reply("Use: /fund join <amount>");
        return;
      }
      
      let amount = parseInt(ctx.args[1].replace(/[$,]/g, ""), 10);
      if (isNaN(amount) || amount < MIN_CONTRIBUTION) {
        await ctx.reply(`❌ Minimum: ${formatMoney(MIN_CONTRIBUTION)}`);
        return;
      }
      
      if (amount > balance.wallet) {
        await ctx.reply(`❌ Insufficient: ${formatMoney(balance.wallet)}`);
        return;
      }
      
      const pool = FUNDS.get(senderId + "_pool") || FUNDS.get("global_pool");
      
      if (!pool) {
        await ctx.reply("❌ No fund. Use /fund create first.");
        return;
      }
      
      await ctx.services.economy.addWallet(senderId, -amount);
      
      pool.contributors.push({ id: senderId, amount });
      pool.total += amount;
      
      await ctx.reply(
        `💰 *Contributed*\n\nYou put in: ${formatMoney(amount)}\n\n📊 *Pool:* ${formatMoney(pool.total)}\n\n⏳ *Payout in 10 minutes...*`
      , { parse_mode: "Markdown" });
      return;
    }
    
    if (action === "leave" || action === "collect") {
      const pool = FUNDS.get(senderId + "_pool") || FUNDS.get("global_pool");
      
      if (!pool) {
        await ctx.reply("❌ No active fund.");
        return;
      }
      
      const contrib = pool.contributors.find(c => c.id === senderId);
      if (!contrib) {
        await ctx.reply("❌ You haven't contributed.");
        return;
      }
      
      const myShare = contrib.amount;
      const profit = Math.floor(myShare * (pool.type.baseProfit / 100));
      const totalReturn = myShare + profit;
      
      await ctx.services.economy.addWallet(senderId, totalReturn);
      
      await ctx.reply(
        `💸 *Fund Payout*\n\n🎉 *Success!*\n\n━━━━━━━━━━━━━━━\n` +
        `Contributed: ${formatMoney(myShare)}\n` +
        `Profit: +${formatMoney(profit)}\n` +
        `━━━━━━━━━━━━━━━\n\n` +
        `💰 Total: ${formatMoney(totalReturn)}`
      , { parse_mode: "Markdown" });
      
      pool.contributors = pool.contributors.filter(c => c.id !== senderId);
      return;
    }
    
    await ctx.reply(
      `📊 *Fund System*\n\n*Profit-sharing investments*\n\n` +
      `1. /fund create - Start a fund\n` +
      `2. /fund join <amount> - Join\n` +
      `3. /fund collect - Collect payout\n\n━━━━━━━━━━━━━━━\n` +
      `Use /fund create to start!\n━━━━━━━━━━━━━━━`
    , { parse_mode: "Markdown" });
  },
};