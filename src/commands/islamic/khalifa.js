const {
  buildCaption,
  compactLines,
  getCommandText,
} = require("../../utils/islamic-command-utils");

module.exports = {
  meta: {
    name: "khalifa",
    aliases: ["khulafa"],
    category: "islamic",
    description: "Show Rashidun profiles, sayings, incidents, or curated themes.",
    cooldownSeconds: 8,
    access: "user",
    chat: "both",
    usage: "[abu-bakr|umar|uthman|ali|topic]",
  },
  async execute(ctx) {
    const query = getCommandText(ctx);
    const result = ctx.services.islamic.getKhalifa(query);
    const title = query ? `KHALIFA | ${query}` : "KHULAFA INDEX";
    const lines = compactLines(result.lines, result.mode === "index" ? 10 : 9);
    await ctx.services.visuals.sendIslamicAnswerCard({
      ctx,
      title,
      lines,
      caption: buildCaption(title, lines),
      chips: [result.mode.toUpperCase(), "Rashidun"],
      stats: result.mode === "profile"
        ? [
          { label: "Name", value: result.profile.name.slice(0, 24) },
          { label: "Role", value: result.profile.title.slice(0, 24) },
        ]
        : [{ label: "Entries", value: String(lines.length) }],
      subtitle: "Curated Khulafa corpus",
    });
  },
};
