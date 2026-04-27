const {
  buildCaption,
  compactLines,
  getCommandText,
  requireInput,
} = require("../../utils/islamic-command-utils");

module.exports = {
  meta: {
    name: "juz",
    aliases: ["para"],
    category: "islamic",
    description: "Show metadata for a juz including its start and end references.",
    cooldownSeconds: 6,
    access: "user",
    chat: "both",
    usage: "<1-30>",
  },
  async execute(ctx) {
    const query = getCommandText(ctx);
    if (!(await requireInput(ctx, query, "Use /juz 30."))) {
      return;
    }

    const result = await ctx.services.islamic.getJuz(query);
    const title = `JUZ | ${result.juz}`;
    const lines = compactLines(result.lines, 8);
    await ctx.services.visuals.sendIslamicAnswerCard({
      ctx,
      title,
      lines,
      caption: buildCaption(title, lines),
      chips: [`Juz ${result.juz}`, "Quran"],
      stats: [
        { label: "Starts", value: `${result.meta.first[0]}:${result.meta.first[1]}` },
        { label: "Ends", value: `${result.meta.last[0]}:${result.meta.last[1]}` },
      ],
      subtitle: "Juz overview",
    });
  },
};
