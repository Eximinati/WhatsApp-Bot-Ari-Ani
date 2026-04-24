module.exports = {
  meta: {
    name: "revoke",
    aliases: ["resetlink"],
    category: "group",
    description: "Reset the current group invite link.",
    cooldownSeconds: 10,
    access: "admin",
    chat: "group",
    usage: "",
  },
  async execute(ctx) {
    const code = await ctx.sock.groupRevokeInvite(ctx.msg.from);
    await ctx.reply(`Invite link reset.\nhttps://chat.whatsapp.com/${code}`);
  },
};
