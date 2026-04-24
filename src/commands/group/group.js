module.exports = {
  meta: {
    name: "group",
    aliases: ["gc"],
    category: "group",
    description: "Open or close the group for regular members.",
    cooldownSeconds: 5,
    access: "admin",
    chat: "group",
    usage: "<open|close>",
  },
  async execute(ctx) {
    if (!ctx.permission.isBotAdmin) {
      await ctx.reply("I need admin access before I can update group settings.");
      return;
    }

    const action = ctx.args[0]?.toLowerCase();
    if (!["open", "close"].includes(action)) {
      await ctx.reply(`Usage: ${ctx.config.prefix}group <open|close>`);
      return;
    }

    await ctx.sock.groupSettingUpdate(
      ctx.msg.from,
      action === "open" ? "not_announcement" : "announcement",
    );
    await ctx.reply(`Group is now ${action === "open" ? "open" : "closed"}.`);
  },
};
