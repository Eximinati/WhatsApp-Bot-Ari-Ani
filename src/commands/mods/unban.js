module.exports = {
  meta: {
    name: "unban",
    aliases: ["unbanuser"],
    category: "mods",
    description: "Remove a bot ban from a user.",
    cooldownSeconds: 3,
    access: "owner",
    chat: "both",
    usage: "@user",
  },
  async execute(ctx) {
    const target = ctx.msg.mentions[0] || ctx.msg.quoted?.sender;
    if (!target) {
      await ctx.reply("Mention or reply to the user you want to unban.");
      return;
    }

    await ctx.services.settings.banUser(target, false);
    await ctx.reply(`Unbanned @${target.split("@")[0]}.`, { mentions: [target] });
  },
};
