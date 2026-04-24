module.exports = {
  meta: {
    name: "note",
    aliases: ["notesnippet"],
    category: "productivity",
    description: "Save, list, fetch, or delete a personal note snippet.",
    cooldownSeconds: 3,
    access: "user",
    chat: "both",
    usage: "save <name> <content> | <name> | delete <name> | list",
  },
  async execute(ctx) {
    const action = (ctx.args[0] || "").toLowerCase();
    if (action === "save") {
      const name = ctx.args[1];
      const content = ctx.args.slice(2).join(" ").trim();
      if (!name || !content) {
        await ctx.reply("Usage: /note save <name> <content>");
        return;
      }

      await ctx.services.notes.savePersonal(ctx.msg.sender, name, content);
      await ctx.reply(`Saved personal note *${name.toLowerCase()}*.`);
      return;
    }

    if (action === "list" || action === "ls" || action === "all" || action === "notes") {
      const notes = await ctx.services.notes.listPersonal(ctx.msg.sender);
      await ctx.reply(
        notes.length
          ? `*Your notes*\n${notes.map((note) => `- ${note.name}`).join("\n")}`
          : "You have no personal notes.",
      );
      return;
    }

    if (action === "delete") {
      const name = ctx.args[1];
      if (!name) {
        await ctx.reply("Usage: /note delete <name>");
        return;
      }

      await ctx.services.notes.deletePersonal(ctx.msg.sender, name);
      await ctx.reply(`Deleted personal note *${name.toLowerCase()}* if it existed.`);
      return;
    }

    const name = ctx.args[0];
    if (!name) {
      await ctx.reply("Usage: /note <name> or /note list");
      return;
    }

    const note = await ctx.services.notes.getPersonal(ctx.msg.sender, name);
    await ctx.reply(note ? note.content : `No personal note named *${name.toLowerCase()}* was found.`);
  },
};
