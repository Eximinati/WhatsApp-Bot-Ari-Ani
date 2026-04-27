const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "faction",
    aliases: [],
    category: "economy",
    description: "Manage your faction membership and treasury.",
    cooldownSeconds: 3,
    access: "user",
    chat: "both",
    usage: "<join|leave|info|top|donate> [value]",
  },
  async execute(ctx) {
    const action = String(ctx.args[0] || "info").trim().toLowerCase();

    try {
      if (action === "join") {
        if (!ctx.args[1]) {
          await ctx.reply(`Usage: ${ctx.config.prefix}faction join <key>`);
          return;
        }

        const result = await ctx.services.economy.joinFaction(ctx.msg.sender, ctx.args[1]);
        await ctx.services.visuals.sendFactionCard({
          ctx,
          title: "FACTION JOINED",
          lines: [
            `Joined: ${result.faction.name}`,
            `Key: ${result.faction.key}`,
            result.faction.description,
          ],
          subtitle: "Allegiance updated",
          chips: ["Faction", "Join", result.faction.key],
          stats: [
            { label: "Treasury", value: formatMoney(result.faction.treasury) },
            { label: "Members", value: String(result.faction.memberCount) },
          ],
        });
        return;
      }

      if (action === "leave") {
        const result = await ctx.services.economy.leaveFaction(ctx.msg.sender);
        await ctx.services.visuals.sendFactionCard({
          ctx,
          title: "FACTION LEFT",
          lines: [`You left faction: ${result.factionKey}`],
          subtitle: "Allegiance removed",
          chips: ["Faction", "Leave"],
          stats: [{ label: "Status", value: "Independent" }],
        });
        return;
      }

      if (action === "top") {
        const rows = await ctx.services.economy.getFactionTop(10);
        await ctx.services.visuals.sendFactionCard({
          ctx,
          title: "FACTION TOP",
          lines: rows.map(
            (row, index) =>
              `${index + 1}. ${row.name} - Treasury ${formatMoney(row.treasury)} | Members ${row.memberCount}`,
          ),
          subtitle: "Treasury ladder",
          chips: ["Faction", "Leaderboard"],
          stats: rows.slice(0, 4).map((row) => ({
            label: row.name,
            value: formatMoney(row.treasury),
          })),
        });
        return;
      }

      if (action === "donate") {
        if (!ctx.args[1]) {
          await ctx.reply(`Usage: ${ctx.config.prefix}faction donate <amount>`);
          return;
        }

        const result = await ctx.services.economy.donateFaction(ctx.msg.sender, ctx.args[1]);
        await ctx.services.visuals.sendFactionCard({
          ctx,
          title: "TREASURY FUNDED",
          lines: [
            `Faction: ${result.faction.name}`,
            `Donated: ${formatMoney(result.amount)}`,
            `Treasury: ${formatMoney(result.faction.treasury)}`,
            `Wallet: ${formatMoney(result.account.wallet)}`,
          ],
          subtitle: "Faction treasury up",
          chips: ["Faction", "Donate"],
          stats: [
            { label: "Donated", value: formatMoney(result.amount) },
            { label: "Treasury", value: formatMoney(result.faction.treasury) },
            { label: "Wallet", value: formatMoney(result.account.wallet) },
          ],
        });
        return;
      }

      const key = action === "info" ? ctx.args[1] || "" : action;
      const faction = await ctx.services.economy.getFactionInfo(key, ctx.msg.sender);
      await ctx.services.visuals.sendFactionCard({
        ctx,
        title: "FACTION INFO",
        lines: [
          `Name: ${faction.name}`,
          `Key: ${faction.key}`,
          faction.description,
          `Treasury: ${formatMoney(faction.treasury)}`,
          `Members: ${faction.memberCount}`,
        ],
        subtitle: "Faction dossier",
        chips: ["Faction", faction.key],
        stats: [
          { label: "Treasury", value: formatMoney(faction.treasury) },
          { label: "Members", value: String(faction.memberCount) },
        ],
      });
    } catch (error) {
      await ctx.reply(error.message);
    }
  },
};
