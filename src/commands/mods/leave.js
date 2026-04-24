module.exports = {
  meta: {
    name: "leave",
    aliases: ["bye"],
    category: "mods",
    description: "Make the bot leave the current group.",
    cooldownSeconds: 5,
    access: "owner",
    chat: "group",
    usage: "",
  },
  async execute(ctx) {
    await ctx.reply("Leaving this group.");
    await ctx.sock.groupLeave(ctx.msg.from);
  },
};
