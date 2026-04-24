module.exports = {
  meta: {
    name: "hi",
    aliases: ["hello"],
    category: "general",
    description: "Say hello to the current user or a quoted sender.",
    cooldownSeconds: 3,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const targetJid = ctx.msg.quoted?.sender || ctx.msg.sender;
    const targetName = await ctx.services.user.getDisplayName(targetJid);
    await ctx.reply(`Hello ${targetName}.`);
  },
};
