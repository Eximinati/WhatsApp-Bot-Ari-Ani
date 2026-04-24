module.exports = {
  meta: {
    name: "remove",
    aliases: ["kick"],
    category: "group",
    description: "Remove a mentioned user from the current group.",
    cooldownSeconds: 5,
    access: "admin",
    chat: "group",
    usage: "@user",
  },
  async execute(ctx) {
    if (!ctx.permission.isBotAdmin) {
      await ctx.reply("I need admin access before I can remove members.");
      return;
    }

    const target = ctx.msg.mentions[0] || ctx.msg.quoted?.sender;
    if (!target) {
      await ctx.reply("Mention or reply to the user you want removed.");
      return;
    }

    await ctx.sock.groupParticipantsUpdate(ctx.msg.from, [target], "remove");
    await ctx.reply(`Removed @${target.split("@")[0]}.`, { mentions: [target] });
  },
};
