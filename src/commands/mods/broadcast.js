module.exports = {
  meta: {
    name: "broadcast",
    aliases: ["bc"],
    category: "mods",
    description: "Send a broadcast message to every group the bot is in.",
    cooldownSeconds: 15,
    access: "owner",
    chat: "both",
    usage: "<message>",
  },
  async execute(ctx) {
    if (!ctx.text) {
      await ctx.reply("Provide the message you want to broadcast.");
      return;
    }

    const groups = Object.values(await ctx.sock.groupFetchAllParticipating());
    await ctx.reply(`Broadcasting to ${groups.length} groups.`);

    for (const group of groups) {
      await ctx.send(group.id, {
        text: `*Broadcast*\n\n${ctx.text}`,
      });
    }

    await ctx.reply("Broadcast completed.");
  },
};
