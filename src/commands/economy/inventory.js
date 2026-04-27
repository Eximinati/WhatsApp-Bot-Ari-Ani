const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "inventory",
    aliases: ["inv"],
    category: "economy",
    description: "Show the items you own.",
    cooldownSeconds: 3,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const result = await ctx.services.economy.getInventory(ctx.msg.sender);
    const lines = result.items.length
      ? result.items.map(
        (item, index) =>
          `${index + 1}. ${item.name} x${item.quantity} [${item.type}]${item.equipped ? " (equipped)" : ""} - ${formatMoney(item.price)} each`,
      )
      : ["You do not own any shop items yet."];

    lines.push(`Wallet: ${formatMoney(result.account.wallet)} | Bank: ${formatMoney(result.account.bank)}`);
    if (result.account.equippedToolKey) {
      lines.push(`Equipped tool: ${result.account.equippedToolKey}`);
    }
    if (result.activeBuffs.length) {
      lines.push(`Active buffs: ${result.activeBuffs.map((entry) => entry.name).join(", ")}`);
    }

    await ctx.services.visuals.sendEconomyResultCard({
      ctx,
      title: "INVENTORY",
      jid: ctx.msg.sender,
      lines,
      subtitle: "Loadout and consumables",
      chips: ["Inventory", `${result.items.length} item(s)`],
      stats: [
        { label: "Wallet", value: formatMoney(result.account.wallet) },
        { label: "Bank", value: formatMoney(result.account.bank) },
        { label: "Buffs", value: String(result.activeBuffs.length) },
        { label: "Tool", value: result.account.equippedToolKey || "None" },
      ],
    });
  },
};
