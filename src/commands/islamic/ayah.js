const {
  buildCaption,
  compactLines,
  getCommandText,
  requireInput,
} = require("../../utils/islamic-command-utils");

module.exports = {
  meta: {
    name: "ayah",
    aliases: ["verse"],
    category: "islamic",
    description: "Fetch a Quran ayah by reference or keyword with image-first output.",
    cooldownSeconds: 6,
    access: "user",
    chat: "both",
    usage: "<surah:ayah | keyword>",
  },
  async execute(ctx) {
    const query = getCommandText(ctx);
    if (!(await requireInput(ctx, query, "Use /ayah 2:255 or /ayah mercy."))) {
      return;
    }

    const settings = await ctx.services.islamic.getUserIslamicSettings(ctx.msg.sender);
    const result = await ctx.services.islamic.getAyah(query, settings);
    const title = `AYAH | ${result.verse.key}`;
    const lines = compactLines(result.lines, 8);
    await ctx.services.visuals.sendQuranAyahCard({
      ctx,
      title,
      image: result.image,
      lines,
      caption: buildCaption(title, lines),
      chips: [result.verse.surah.nameSimple || result.verse.surah.nameTranslated, result.verse.key],
      stats: [
        { label: "Surah", value: String(result.verse.chapterNo) },
        { label: "Ayah", value: String(result.verse.verseNo) },
      ],
      subtitle: result.type === "search" ? "Best Quran match" : "Exact Quran reference",
    });
  },
};
