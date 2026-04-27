const { formatMoney } = require("../../services/economy-service");
const { resolveTransferTarget } = require("../../utils/economy");
const { mentionTag } = require("../../utils/jid");

module.exports = {
  meta: {
    name: "duel",
    aliases: [],
    category: "economy",
    description: "Challenge another user to a wallet duel.",
    cooldownSeconds: 3,
    access: "user",
    chat: "both",
    usage: "<@user|number> <bet>",
  },
  async execute(ctx) {
    const targetJid = resolveTransferTarget(ctx.msg, ctx.args[0]);
    const betInput =
      ctx.msg.mentions[0] || ctx.msg.quoted?.sender
        ? ctx.args[1] || ctx.args[0]
        : ctx.args[1];

    if (!targetJid || !betInput) {
      await ctx.reply(`Usage: ${ctx.config.prefix}duel <@user|number> <bet>`);
      return;
    }

    try {
      const result = await ctx.services.economy.duel(ctx.msg.sender, targetJid, betInput);

      if (!result.ok && result.reason === "cooldown") {
        await ctx.services.visuals.sendEconomyResultCard({
          ctx,
          title: "DUEL COOLDOWN",
          jid: ctx.msg.sender,
          lines: [`Try again in ${ctx.services.economy.formatCooldown(result.remainingMs)}.`],
          subtitle: "Arena timer",
          chips: ["PvP", "Duel"],
          stats: [{ label: "Cooldown", value: ctx.services.economy.formatCooldown(result.remainingMs) }],
        });
        return;
      }

      const winnerLine = result.draw
        ? "The duel ended in a draw."
        : `Winner: ${mentionTag(result.winnerJid)}`;
      await ctx.services.visuals.sendEconomyResultCard({
        ctx,
        title: result.draw ? "DUEL DRAW" : "DUEL RESOLVED",
        jid: ctx.msg.sender,
        mentions: [targetJid, result.winnerJid].filter(Boolean),
        lines: [
          `Target: ${mentionTag(targetJid)}`,
          winnerLine,
          `Bet: ${formatMoney(result.bet)}`,
          `Power: ${result.draw ? "-" : `${result.challengerPower} vs ${result.targetPower}`}`,
          `Your wallet: ${formatMoney(result.challenger.wallet)}`,
        ],
        subtitle: result.draw ? "Dead even" : "Arena result",
        chips: ["PvP", "Duel", result.draw ? "Draw" : "Settled"],
        stats: [
          { label: "Bet", value: formatMoney(result.bet) },
          { label: "Your Power", value: result.draw ? "--" : String(result.challengerPower) },
          { label: "Target Power", value: result.draw ? "--" : String(result.targetPower) },
          { label: "Wallet", value: formatMoney(result.challenger.wallet) },
        ],
        caption: result.draw
          ? "The duel ended without a winner."
          : `Winner: ${mentionTag(result.winnerJid)}`,
      });
    } catch (error) {
      await ctx.reply(error.message);
    }
  },
};
