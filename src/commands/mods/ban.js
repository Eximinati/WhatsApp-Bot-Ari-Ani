module.exports = {
  meta: {
    name: "ban",
    aliases: ["banuser"],
    category: "mods",
    description: "Ban a user from using bot commands.",
    cooldownSeconds: 3,
    access: "owner",
    chat: "both",
    usage: "@user",
  },
  async execute(ctx) {
    const target = ctx.msg.mentions[0] || ctx.msg.quoted?.sender;
    if (!target) {
      await ctx.reply("Mention or reply to the user you want to ban.");
      return;
    }

    await ctx.services.settings.banUser(target, true);
    await ctx.reply(`Banned @${target.split("@")[0]}.`, { mentions: [target] });
  },
};
