const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "factions",
    aliases: [],
    category: "economy",
    description: "Browse all global economy factions.",
    cooldownSeconds: 4,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const factions = await ctx.services.economy.getFactions();
    const lines = factions.map(
      (faction, index) =>
        `${index + 1}. ${faction.name} (${faction.key}) - Treasury ${formatMoney(faction.treasury)} | Members ${faction.memberCount}`,
    );

    await ctx.services.visuals.sendFactionCard({
      ctx,
      title: "FACTION INDEX",
      lines,
      subtitle: "Global economy teams",
      chips: ["Factions", `${factions.length} total`],
      stats: factions.slice(0, 4).map((faction) => ({
        label: faction.name,
        value: formatMoney(faction.treasury),
      })),
      caption: `Use ${ctx.config.prefix}faction info <key> or ${ctx.config.prefix}faction join <key>.`,
    });
  },
};
