const { formatMoney } = require("../../services/economy-service");
const { resolveTransferTarget } = require("../../utils/economy");
const { mentionTag } = require("../../utils/identity-resolver");

module.exports = {
  meta: {
    name: "heist",
    aliases: [],
    category: "economy",
    description: "Attempt a high-stakes bank heist on another user.",
    cooldownSeconds: 4,
    access: "user",
    chat: "both",
    usage: "<@user|number>",
  },
  async execute(ctx) {
    const targetJid = resolveTransferTarget(ctx.msg, ctx.args[0]);
    if (!targetJid) {
      await ctx.reply(`Usage: ${ctx.config.prefix}heist <@user|number>`);
      return;
    }

    try {
      const result = await ctx.services.economy.heist(ctx.msg.sender, targetJid);

      if (!result.ok && result.reason === "cooldown") {
        await ctx.services.visuals.sendEconomyResultCard({
          ctx,
          title: "HEIST COOLDOWN",
          jid: ctx.msg.sender,
          lines: [`Try again in ${ctx.services.economy.formatCooldown(result.remainingMs)}.`],
          subtitle: "Vault heat",
          chips: ["PvP", "Heist"],
          stats: [{ label: "Cooldown", value: ctx.services.economy.formatCooldown(result.remainingMs) }],
        });
        return;
      }

      if (!result.ok && result.reason === "poor-target") {
        await ctx.services.visuals.sendEconomyResultCard({
          ctx,
          title: "VAULT TOO THIN",
          jid: ctx.msg.sender,
          mentions: [targetJid],
          lines: [
            `${mentionTag(targetJid)} does not have enough banked cash.`,
            "Pick a richer target for a real heist.",
          ],
          subtitle: "Target not worth it",
          chips: ["PvP", "Heist"],
          stats: [{ label: "Target", value: mentionTag(targetJid) }],
        });
        return;
      }

      await ctx.services.visuals.sendEconomyResultCard({
        ctx,
        title: result.success ? "HEIST SUCCESS" : "HEIST FAILED",
        jid: ctx.msg.sender,
        mentions: [targetJid],
        lines: [
          `Target: ${mentionTag(targetJid)}`,
          result.message,
          `${result.success ? "Stolen" : "Penalty"}: ${formatMoney(result.amount)}`,
          `Your wallet: ${formatMoney(result.thief.wallet)}`,
          `Target bank: ${formatMoney(result.target.bank)}`,
        ],
        subtitle: result.success ? "Vault cracked" : "Security won",
        chips: ["PvP", "Heist", result.success ? "Success" : "Fail"],
        stats: [
          { label: result.success ? "Stolen" : "Penalty", value: formatMoney(result.amount) },
          { label: "Wallet", value: formatMoney(result.thief.wallet) },
          { label: "Target Bank", value: formatMoney(result.target.bank) },
        ],
        caption: `Heist result against ${mentionTag(targetJid)}`,
      });
    } catch (error) {
      await ctx.reply(error.message);
    }
  },
};
