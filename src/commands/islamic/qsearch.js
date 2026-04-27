const {
  buildCaption,
  getCommandText,
  requireInput,
} = require("../../utils/islamic-command-utils");

module.exports = {
  meta: {
    name: "qsearch",
    aliases: ["qfind"],
    category: "islamic",
    description: "Search the Quran by keyword and return the best ranked matches.",
    cooldownSeconds: 8,
    access: "user",
    chat: "both",
    usage: "<keyword>",
  },
  async execute(ctx) {
    const query = getCommandText(ctx);
    if (!(await requireInput(ctx, query, "Use /qsearch patience or /qsearch mercy."))) {
      return;
    }

    const results = await ctx.services.islamic.searchQuran(query);
    if (!results.length) {
      await ctx.reply("No Quran results matched that query. Try a clearer keyword.");
      return;
    }

    const lines = results.map(
      (item, index) =>
        `${index + 1}. ${item.chapterNo}:${item.verseNo} | ${item.surahName} | ${String(item.arabic || "").slice(0, 80)}`,
    );
    const title = `QSEARCH | ${query}`;
    await ctx.services.visuals.sendIslamicAnswerCard({
      ctx,
      title,
      lines,
      caption: `${buildCaption(title, lines)}\nRefine your query if needed.`,
      chips: ["Top 3", "Quran Search"],
      stats: results.map((item, index) => ({
        label: `Match ${index + 1}`,
        value: `${item.chapterNo}:${item.verseNo}`,
      })),
      subtitle: "Ranked Quran results",
    });
  },
};
