const {
  buildCaption,
  compactLines,
  getCommandText,
} = require("../../utils/islamic-command-utils");

module.exports = {
  meta: {
    name: "sajdah",
    aliases: ["sajda"],
    category: "islamic",
    description: "List sajdah verses or inspect one specific sajdah reference.",
    cooldownSeconds: 6,
    access: "user",
    chat: "both",
    usage: "[surah:ayah]",
  },
  async execute(ctx) {
    const query = getCommandText(ctx);
    const settings = await ctx.services.islamic.getUserIslamicSettings(ctx.msg.sender);
    const result = await ctx.services.islamic.getSajdah(query, settings);
    const title = query ? "SAJDAH CHECK" : "SAJDAH AYAT";
    const lines = compactLines(result.lines, query ? 8 : 12);
    await ctx.services.visuals.sendIslamicAnswerCard({
      ctx,
      title,
      lines,
      caption: buildCaption(title, lines),
      chips: [query || "All", query ? "Reference" : "List"],
      stats: query
        ? [
          { label: "Reference", value: result.verse.key },
          { label: "Sajdah", value: result.isSajdah ? "Yes" : "No" },
        ]
        : [{ label: "Count", value: String(lines.length) }],
      subtitle: query ? "Sajdah verse check" : "Known sajdah references",
    });
  },
};
