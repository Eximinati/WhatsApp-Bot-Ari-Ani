const {
  buildCaption,
  compactLines,
} = require("../../utils/islamic-command-utils");

module.exports = {
  meta: {
    name: "dailyhadith",
    aliases: ["hadithdaily"],
    category: "islamic",
    description: "Send the hadith lesson of the day from the curated Arbain set.",
    cooldownSeconds: 10,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const entry = ctx.services.islamic.getDailyHadith();
    const title = `DAILY HADITH | ${entry.number}`;
    const lines = compactLines([
      `Title: ${entry.titleEn}`,
      `Urdu: ${entry.titleUr}`,
      `Lesson EN: ${entry.lessonEn}`,
      `Lesson UR: ${entry.lessonUr}`,
      `Reference: ${entry.reference}`,
    ], 8);
    await ctx.services.visuals.sendHadithCard({
      ctx,
      title,
      lines,
      caption: buildCaption(title, lines),
      chips: ["Daily", `#${entry.number}`],
      stats: [{ label: "Reference", value: entry.reference.slice(0, 24) }],
      subtitle: "Curated daily hadith lesson",
    });
  },
};
