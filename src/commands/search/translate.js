module.exports = {
  meta: {
    name: "translate",
    aliases: ["tr"],
    category: "search",
    description: "Translate text between languages.",
    cooldownSeconds: 5,
    access: "user",
    chat: "both",
    usage: "<from> <to> <text>",
  },
  async execute(ctx) {
    if (ctx.args.length < 3) {
      await ctx.reply("Usage: /translate <from> <to> <text>");
      return;
    }

    const [from, to, ...rest] = ctx.args;
    try {
      const result = await ctx.services.external.translate.translate(from, to, rest.join(" "));
      await ctx.reply(
        `*${from} -> ${to}*\n${result.translatedText || "No translation returned."}`,
      );
    } catch {
      await ctx.reply("Translation failed right now. Please try again later.");
    }
  },
};
