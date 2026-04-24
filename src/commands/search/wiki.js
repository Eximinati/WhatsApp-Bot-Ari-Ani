module.exports = {
  meta: {
    name: "wiki",
    aliases: ["wikipedia"],
    category: "search",
    description: "Fetch a short Wikipedia summary.",
    cooldownSeconds: 5,
    access: "user",
    chat: "both",
    usage: "<query>",
  },
  async execute(ctx) {
    if (!ctx.text) {
      await ctx.reply("Provide a Wikipedia query.");
      return;
    }

    try {
      const result = await ctx.services.external.wiki.summary(ctx.text);
      await ctx.reply(
        `*${result.title}*\n${result.extract || "No summary was returned."}\n${result.url || ""}`.trim(),
      );
    } catch {
      await ctx.reply("Wikipedia search failed right now. Please try again later.");
    }
  },
};
