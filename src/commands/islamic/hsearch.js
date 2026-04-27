const {
  buildCaption,
  getCommandText,
  requireInput,
} = require("../../utils/islamic-command-utils");

module.exports = {
  meta: {
    name: "hsearch",
    aliases: ["hadithsearch"],
    category: "islamic",
    description: "Search curated hadith topics with source references.",
    cooldownSeconds: 8,
    access: "user",
    chat: "both",
    usage: "<keyword>",
  },
  async execute(ctx) {
    const query = getCommandText(ctx);
    if (!(await requireInput(ctx, query, "Use /hsearch mercy or /hsearch prayer."))) {
      return;
    }

    const results = await ctx.services.islamic.searchHadith(query);
    if (!results.length) {
      await ctx.reply("No supported hadith topic matched that query. Try a clearer keyword.");
      return;
    }

    const lines = results.map(
      (item, index) =>
        `${index + 1}. ${item.title} | ${item.collection} ${item.number} | ${item.summaryEn}`,
    );
    const title = `HSEARCH | ${query}`;
    await ctx.services.visuals.sendHadithCard({
      ctx,
      title,
      lines,
      caption: `${buildCaption(title, lines)}\nRefine your query if needed.`,
      chips: ["Top 3", "Hadith Topics"],
      stats: results.map((item, index) => ({
        label: `Match ${index + 1}`,
        value: `${item.collection} ${item.number}`,
      })),
      subtitle: "Curated hadith topics",
    });
  },
};
