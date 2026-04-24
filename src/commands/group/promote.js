module.exports = {
  meta: {
    name: "promote",
    aliases: ["admin"],
    category: "group",
    description: "Promote a group member to admin.",
    cooldownSeconds: 5,
    access: "admin",
    chat: "group",
    usage: "@user",
  },
  async execute(ctx) {
    if (!ctx.permission.isBotAdmin) {
      await ctx.reply("I need admin access before I can promote members.");
      return;
    }

    const target = ctx.msg.mentions[0] || ctx.msg.quoted?.sender;
    if (!target) {
      await ctx.reply("Mention or reply to the user you want to promote.");
      return;
    }

    await ctx.sock.groupParticipantsUpdate(ctx.msg.from, [target], "promote");
    await ctx.reply(`Promoted @${target.split("@")[0]}.`, { mentions: [target] });
  },
};
