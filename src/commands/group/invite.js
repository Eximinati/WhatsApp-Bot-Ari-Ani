module.exports = {
  meta: {
    name: "invite",
    aliases: ["link"],
    category: "group",
    description: "Get the current group invite link.",
    cooldownSeconds: 5,
    access: "admin",
    chat: "group",
    usage: "",
  },
  async execute(ctx) {
    const code = await ctx.sock.groupInviteCode(ctx.msg.from);
    await ctx.reply(`https://chat.whatsapp.com/${code}`);
  },
};
