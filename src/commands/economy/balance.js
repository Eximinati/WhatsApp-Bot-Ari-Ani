const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "balance",
    aliases: ["bal"],
    category: "economy",
    description: "Show your wallet, bank, and total wealth.",
    cooldownSeconds: 3,
    access: "user",
    chat: "both",
    usage: "[@user]",
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

    const lines = [
      ...ctx.services.economy.formatBalanceLines(balance),
      `Wealth rank: #${wealthRank.rank}`,
      `Inventory items: ${itemCount}`,
      `Job: ${balance.jobKey || "none"} | Faction: ${balance.factionKey || "none"}`,
      `Equipped tool: ${balance.equippedToolKey || "none"}`,
    ];

    await ctx.services.visuals.sendEconomyResultCard({
      ctx,
      title: "BALANCE",
      jid: targetJid,
      subtitle: `${displayName} · Economy`,
      lines,
      caption: lines.join("\n"),
      chips: [
        `Rank #${wealthRank.rank}`,
        balance.jobKey || "No Job",
        balance.factionKey || "No Faction",
      ],
      stats: [
        { label: "Wallet", value: formatMoney(balance.wallet) },
        { label: "Bank", value: formatMoney(balance.bank) },
        { label: "Wealth", value: formatMoney(balance.totalWealth) },
        { label: "Items", value: String(itemCount) },
        { label: "Tool", value: balance.equippedToolKey || "None" },
      ],
    });
  },
};
