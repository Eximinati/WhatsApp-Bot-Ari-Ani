module.exports = {
  meta: {
    name: "google",
    aliases: ["g"],
    category: "utils",
    description: "Search Google Custom Search and return the top results.",
    cooldownSeconds: 10,
    access: "user",
    chat: "both",
    usage: "<query>",
  },
  async execute(ctx) {
    if (!ctx.text) {
      await ctx.reply("Provide a search query.");
      return;
    }

    if (!ctx.services.external.google.isConfigured()) {
      await ctx.reply(
        "Google search is disabled until GOOGLE_API_KEY and GOOGLE_SEARCH_ENGINE_ID are configured.",
      );
      return;
    }

    const results = await ctx.services.external.google.search(ctx.text);
    if (results.length === 0) {
      await ctx.reply("No search results were found.");
      return;
    }

    const lines = results.slice(0, 5).map((item, index) =>
      `${index + 1}. ${item.title}\n${item.link}\n${item.snippet}`,
    );
    await ctx.reply(lines.join("\n\n"));
  },
};
