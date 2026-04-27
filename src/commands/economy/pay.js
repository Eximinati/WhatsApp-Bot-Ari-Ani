const { formatMoney } = require("../../services/economy-service");
const { resolveTransferTarget } = require("../../utils/economy");
const { mentionTag } = require("../../utils/jid");

module.exports = {
  meta: {
    name: "pay",
    aliases: ["give"],
    category: "economy",
    description: "Send money from your wallet to another user.",
    cooldownSeconds: 2,
    access: "user",
    chat: "both",
    usage: "<@user|number> <amount>",
  },
  async execute(ctx) {
    const targetJid = resolveTransferTarget(ctx.msg, ctx.args[0]);
    const amountInput =
      ctx.msg.mentions[0] || ctx.msg.quoted?.sender
        ? ctx.args[1] || ctx.args[0]
        : ctx.args[1];

    if (!targetJid || !amountInput) {
      await ctx.reply("Usage: /pay <@user|number> <amount>");
      return;
    }

    try {
      const result = await ctx.services.economy.pay(ctx.msg.sender, targetJid, amountInput);
      await ctx.services.visuals.sendEconomyResultCard({
        ctx,
        title: "PAYMENT SENT",
        jid: ctx.msg.sender,
        mentions: [targetJid],
        lines: [
          `Recipient: ${mentionTag(targetJid)}`,
          `Amount: ${formatMoney(result.amount)}`,
          `Your wallet: ${formatMoney(result.sender.wallet)}`,
          `Their wallet: ${formatMoney(result.receiver.wallet)}`,
        ],
        subtitle: "Direct transfer",
        chips: ["Transfer", "Wallet"],
        stats: [
          { label: "Amount", value: formatMoney(result.amount) },
          { label: "You", value: formatMoney(result.sender.wallet) },
          { label: "Them", value: formatMoney(result.receiver.wallet) },
        ],
        caption: `Payment sent to ${mentionTag(targetJid)}`,
      });
    } catch (error) {
      await ctx.reply(error.message);
    }
  },
};
