module.exports = {
  meta: {
    name: "gnotes",
    aliases: [],
    category: "productivity",
    description: "List this group's shared notes.",
    cooldownSeconds: 5,
    access: "trusted",
    chat: "group",
    usage: "",
  },
  async execute(ctx) {
    const notes = await ctx.services.notes.listGroup(ctx.msg.from);
    await ctx.reply(
      notes.length
        ? `*Group notes*\n${notes.map((note) => `- ${note.name}`).join("\n")}`
        : "This group has no shared notes.",
    );
  },
};
