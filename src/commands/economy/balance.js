const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "balance",
    aliases: ["bal"],
    category: "economy",
    description: "Show total wealth.",
    cooldownSeconds: 3,
    access: "user",
    chat: "both",
  },
  async execute(ctx) {
    const targetJid =
      ctx.msg.mentions[0] || ctx.msg.quoted?.sender || ctx.msg.sender;
    const [balance, displayName, wealthRank] = await Promise.all([
      ctx.services.economy.getBalance(targetJid),
      ctx.services.user.getDisplayName(targetJid),
      ctx.services.economy.getWealthRank(targetJid),
    ]);

    const inventory = balance.inventory || {};
    const itemCount = Object.values(inventory).reduce(
      (sum, value) => sum + (Number(value) || 0),
      0,
    );

    const total = balance.wallet + balance.bank;
    const job = balance.jobKey || "None";
    const tool = balance.equippedToolKey || "None";
    const faction = balance.factionKey || "None";

    await ctx.reply(
      `📊 *${displayName}'s Balance*\n\n` +
      `━━━━━━━━━━━━━━━\n` +
      `👛 Wallet: ${formatMoney(balance.wallet)}\n` +
      `🏦 Bank: ${formatMoney(balance.bank)}\n` +
      `💰 Total: ${formatMoney(total)}\n` +
      `━━━━━━━━━━━━━━━\n\n` +
      `📈 Rank: #${wealthRank.rank}\n` +
      `🔧 Tool: ${tool}\n` +
      `💼 Job: ${job}\n` +
      `⚔️ Faction: ${faction}`
    , { parse_mode: "Markdown" });
  },
};