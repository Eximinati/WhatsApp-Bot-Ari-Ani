module.exports = {
  meta: {
    name: "add",
    aliases: ["addmember"],
    category: "group",
    description: "Add a user to the current group.",
    cooldownSeconds: 5,
    access: "admin",
    chat: "group",
    usage: "<number>",
  },
  async execute(ctx) {
    if (!ctx.permission.isBotAdmin) {
      await ctx.reply("I need admin access before I can add members.");
      return;
    }

    const number = ctx.text.replace(/\D/g, "");
    if (!number) {
      await ctx.reply(`Usage: ${ctx.config.prefix}add <countrycode-number>`);
      return;
    }

    const jid = `${number}@s.whatsapp.net`;
    const results = await ctx.sock.onWhatsApp(jid);
    if (!results?.[0]?.exists) {
      await ctx.reply("That number is not registered on WhatsApp.");
      return;
    }

    await ctx.sock.groupParticipantsUpdate(ctx.msg.from, [jid], "add");
    await ctx.reply(`Add request sent for @${number}.`, { mentions: [jid] });
  },
};
