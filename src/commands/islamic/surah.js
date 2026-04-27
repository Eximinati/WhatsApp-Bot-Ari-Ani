const {
  buildCaption,
  compactLines,
  getCommandText,
  requireInput,
} = require("../../utils/islamic-command-utils");

module.exports = {
  meta: {
    name: "surah",
    aliases: ["sura"],
    category: "islamic",
    description: "Show a surah overview with opening verses and metadata.",
    cooldownSeconds: 8,
    access: "user",
    chat: "both",
    usage: "<number|name>",
  },
  async execute(ctx) {
    const query = getCommandText(ctx);
    if (!(await requireInput(ctx, query, "Use /surah 18 or /surah al kahf."))) {
      return;
    }

    const settings = await ctx.services.islamic.getUserIslamicSettings(ctx.msg.sender);
    const result = await ctx.services.islamic.getSurah(query, settings);
    const lines = compactLines([...result.lines, ...result.excerptLines], 10);
    const title = `SURAH | ${result.surah.nameSimple || result.surah.nameTranslated}`;
    await ctx.services.visuals.sendIslamicAnswerCard({
      ctx,
      title,
      lines,
      caption: buildCaption(title, lines),
      chips: [String(result.surah.number), result.surah.revelationPlace || "Quran"],
      stats: [
        { label: "Ayahs", value: String(result.surah.numberOfAyahs || result.chapter.numberOfVerses) },
        { label: "Type", value: result.chapter.type || result.surah.revelationPlace || "Quran" },
      ],
      subtitle: "Surah overview",
    });
  },
};
