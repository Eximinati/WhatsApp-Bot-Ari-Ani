module.exports = {
  meta: {
    name: "demote",
    aliases: ["unadmin"],
    category: "group",
    description: "Demote a group admin back to member.",
    cooldownSeconds: 5,
    access: "admin",
    chat: "group",
    usage: "@user",
  },
  async execute(ctx) {
    if (!ctx.permission.isBotAdmin) {
      await ctx.reply("I need admin access before I can demote members.");
      return;
    }

    const target = ctx.msg.mentions[0] || ctx.msg.quoted?.sender;
    if (!target) {
      await ctx.reply("Mention or reply to the user you want to demote.");
      return;
    }

    await ctx.sock.groupParticipantsUpdate(ctx.msg.from, [target], "demote");
    await ctx.reply(`Demoted @${target.split("@")[0]}.`, { mentions: [target] });
  },
};
