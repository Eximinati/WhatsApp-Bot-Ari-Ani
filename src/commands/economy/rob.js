const { formatMoney } = require("../../services/economy-service");
const { resolveTransferTarget } = require("../../utils/economy");
const { mentionTag } = require("../../utils/jid");

module.exports = {
  meta: {
    name: "rob",
    aliases: [],
    category: "economy",
    description: "Try to rob another user's wallet.",
    cooldownSeconds: 3,
    access: "user",
    chat: "both",
    usage: "<@user|number>",
  },
  async execute(ctx) {
    const targetJid = resolveTransferTarget(ctx.msg, ctx.args[0]);
    if (!targetJid) {
      await ctx.reply("Mention, reply to, or provide the user you want to rob.");
      return;
    }

    try {
      const result = await ctx.services.economy.rob(ctx.msg.sender, targetJid);
      if (!result.ok && result.reason === "cooldown") {
        await ctx.services.visuals.sendEconomyResultCard({
          ctx,
          title: "ROB COOLDOWN",
          jid: ctx.msg.sender,
          lines: [`Try again in ${ctx.services.economy.formatCooldown(result.remainingMs)}.`],
          subtitle: "Heat cooldown",
          chips: ["PvP", "Cooldown"],
          stats: [
            { label: "Cooldown", value: ctx.services.economy.formatCooldown(result.remainingMs) },
          ],
        });
        return;
      }

      if (!result.ok && result.reason === "poor-target") {
        await ctx.services.visuals.sendEconomyResultCard({
          ctx,
          title: "POOR TARGET",
          jid: ctx.msg.sender,
          lines: [
            `${mentionTag(targetJid)} does not have enough wallet cash to rob.`,
            "Pick a richer target or use /heist on banked money.",
          ],
          mentions: [targetJid],
          subtitle: "PvP blocked",
          chips: ["PvP", "Rob"],
          stats: [
            { label: "Target", value: mentionTag(targetJid) },
          ],
          caption: `${mentionTag(targetJid)} is too broke for a wallet robbery.`,
        });
        return;
      }

      await ctx.services.visuals.sendEconomyResultCard({
        ctx,
        title: result.success ? "ROB SUCCESS" : "ROB FAIL",
        jid: ctx.msg.sender,
        mentions: [targetJid],
        lines: [
          `Target: ${mentionTag(targetJid)}`,
          result.message,
          `${result.success ? "Stolen" : "Penalty"}: ${formatMoney(result.amount)}`,
          `Your wallet: ${formatMoney(result.thief.wallet)}`,
          `Target wallet: ${formatMoney(result.target.wallet)}`,
        ],
        subtitle: result.success ? "Wallet breach" : "Countered instantly",
        chips: ["PvP", "Rob", result.success ? "Success" : "Fail"],
        stats: [
          { label: result.success ? "Stolen" : "Penalty", value: formatMoney(result.amount) },
          { label: "You", value: formatMoney(result.thief.wallet) },
          { label: "Target", value: formatMoney(result.target.wallet) },
        ],
        caption: `Economy action against ${mentionTag(targetJid)}`,
      });
    } catch (error) {
      await ctx.reply(error.message);
    }
  },
};
