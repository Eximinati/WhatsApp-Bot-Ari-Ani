module.exports = {
  meta: {
    name: "notes",
    aliases: [],
    category: "productivity",
    description: "List your saved personal notes.",
    cooldownSeconds: 5,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const notes = await ctx.services.notes.listPersonal(ctx.msg.sender);
    await ctx.reply(
      notes.length
        ? `*Your notes*\n${notes.map((note) => `- ${note.name}`).join("\n")}`
        : "You have no personal notes.",
    );
  },
};
