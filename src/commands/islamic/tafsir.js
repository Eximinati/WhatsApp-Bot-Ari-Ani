const {
  buildCaption,
  compactLines,
  getCommandText,
  requireInput,
} = require("../../utils/islamic-command-utils");

module.exports = {
  meta: {
    name: "tafsir",
    aliases: ["tafseer"],
    category: "islamic",
    description: "Show a short tafsir excerpt for a Quran verse.",
    cooldownSeconds: 8,
    access: "user",
    chat: "both",
    usage: "<surah:ayah>",
  },
  async execute(ctx) {
    const query = getCommandText(ctx);
    if (!(await requireInput(ctx, query, "Use /tafsir 2:255."))) {
      return;
    }

    const settings = await ctx.services.islamic.getUserIslamicSettings(ctx.msg.sender);
    const result = await ctx.services.islamic.getTafsir(query, settings);
    const title = `TAFSIR | ${result.verse.key}`;
    const lines = compactLines(result.lines, 10);
    await ctx.services.visuals.sendIslamicAnswerCard({
      ctx,
      title,
      lines,
      caption: buildCaption(title, lines),
      chips: [result.verse.key, "Ibn Kathir"],
      stats: [
        { label: "Surah", value: String(result.verse.chapterNo) },
        { label: "Ayah", value: String(result.verse.verseNo) },
      ],
      subtitle: "Curated short tafsir",
    });
  },
};
