module.exports = {
  meta: {
    name: "join",
    aliases: ["jn"],
    category: "mods",
    description: "Join a WhatsApp group using an invite link.",
    cooldownSeconds: 10,
    access: "owner",
    chat: "both",
    usage: "<invite-link>",
  },
  async execute(ctx) {
    const code = ctx.text.split("https://chat.whatsapp.com/")[1];
    if (!code) {
      await ctx.reply("Provide a valid WhatsApp invite link.");
      return;
    }

    await ctx.sock.groupAcceptInvite(code.trim());
    await ctx.reply("Joined the group successfully.");
  },
};
