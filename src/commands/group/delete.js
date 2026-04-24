module.exports = {
  meta: {
    name: "delete",
    aliases: ["del"],
    category: "group",
    description: "Delete a quoted bot message from the current chat.",
    cooldownSeconds: 3,
    access: "admin",
    chat: "group",
    usage: "",
  },
  async execute(ctx) {
    if (!ctx.msg.quoted?.id) {
      await ctx.reply("Reply to a message you want me to delete.");
      return;
    }

    await ctx.sock.sendMessage(ctx.msg.from, {
      delete: {
        remoteJid: ctx.msg.from,
        fromMe: false,
        id: ctx.msg.quoted.id,
        participant: ctx.msg.quoted.sender,
      },
    });
  },
};
