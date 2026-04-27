const {
  buildCaption,
  compactLines,
  getCommandText,
} = require("../../utils/islamic-command-utils");

module.exports = {
  meta: {
    name: "arbain",
    aliases: ["nawawi40"],
    category: "islamic",
    description: "Show a Nawawi 40 hadith lesson by number or random pick.",
    cooldownSeconds: 8,
    access: "user",
    chat: "both",
    usage: "[1-42|random]",
  },
  async execute(ctx) {
    const query = getCommandText(ctx) || "random";
    const entry = ctx.services.islamic.getArbain(query);
    const title = `ARBAIN | ${entry.number}`;
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
      chips: [`#${entry.number}`, "Nawawi 40"],
      stats: [{ label: "Reference", value: entry.reference.slice(0, 24) }],
      subtitle: query === "random" ? "Daily structured lesson" : "Selected structured lesson",
    });
  },
};
