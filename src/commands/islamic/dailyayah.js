const {
  buildCaption,
  compactLines,
} = require("../../utils/islamic-command-utils");

module.exports = {
  meta: {
    name: "dailyayah",
    aliases: ["ayahdaily"],
    category: "islamic",
    description: "Send the ayah of the day as a shareable image-first card.",
    cooldownSeconds: 10,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const settings = await ctx.services.islamic.getUserIslamicSettings(ctx.msg.sender);
    const result = await ctx.services.islamic.getDailyAyah(settings);
    const title = `DAILY AYAH | ${result.verse.key}`;
    const lines = compactLines(result.lines, 8);
    await ctx.services.visuals.sendQuranAyahCard({
      ctx,
      title,
      image: result.image,
      lines,
      caption: buildCaption(title, lines),
      chips: ["Daily", result.verse.key],
      stats: [
        { label: "Surah", value: String(result.verse.chapterNo) },
        { label: "Ayah", value: String(result.verse.verseNo) },
      ],
      subtitle: "Daily Quran reflection",
    });
  },
};
