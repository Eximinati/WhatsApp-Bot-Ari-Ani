module.exports = {
  meta: {
    name: "gnote",
    aliases: ["groupnote"],
    category: "productivity",
    description: "Save, list, fetch, or delete a shared group snippet.",
    cooldownSeconds: 3,
    access: "trusted",
    chat: "group",
    usage: "save <name> <content> | <name> | delete <name> | list",
  },
  async execute(ctx) {
    const action = (ctx.args[0] || "").toLowerCase();
    if (action === "save") {
      const name = ctx.args[1];
      const content = ctx.args.slice(2).join(" ").trim();
      if (!name || !content) {
        await ctx.reply("Usage: /gnote save <name> <content>");
        return;
      }

      await ctx.services.notes.saveGroup(ctx.msg.from, ctx.msg.sender, name, content);
      await ctx.reply(`Saved group note *${name.toLowerCase()}*.`);
      return;
    }

    if (action === "list" || action === "ls" || action === "all") {
      const notes = await ctx.services.notes.listGroup(ctx.msg.from);
      await ctx.reply(
        notes.length
          ? `*Group notes*\n${notes.map((note) => `- ${note.name}`).join("\n")}`
          : "This group has no shared notes.",
      );
      return;
    }

    if (action === "delete") {
      const name = ctx.args[1];
      if (!name) {
        await ctx.reply("Usage: /gnote delete <name>");
        return;
      }

      await ctx.services.notes.deleteGroup(ctx.msg.from, name);
      await ctx.reply(`Deleted group note *${name.toLowerCase()}* if it existed.`);
      return;
    }

    const name = ctx.args[0];
    if (!name) {
      await ctx.reply("Usage: /gnote <name> or /gnote list");
      return;
    }

    const note = await ctx.services.notes.getGroup(ctx.msg.from, name);
    await ctx.reply(note ? note.content : `No group note named *${name.toLowerCase()}* was found.`);
  },
};
