const {
  buildCaption,
  compactLines,
  getCommandText,
} = require("../../utils/islamic-command-utils");

module.exports = {
  meta: {
    name: "dua",
    aliases: ["supplication"],
    category: "islamic",
    description: "Return a source-backed dua by topic with image-first delivery.",
    cooldownSeconds: 6,
    access: "user",
    chat: "both",
    usage: "[topic]",
  },
  async execute(ctx) {
    const query = getCommandText(ctx) || "general";
    const settings = await ctx.services.islamic.getUserIslamicSettings(ctx.msg.sender);
    const result = ctx.services.islamic.getDua(query, settings);
    const title = `DUA | ${result.category || query}`;
    const lines = compactLines(result.lines, 9);
    await ctx.services.visuals.sendDuaCard({
      ctx,
      title,
      lines,
      caption: buildCaption(title, lines),
      chips: [result.category || "Dua", "Adhkar"],
      stats: [{ label: "Topic", value: String(result.category || query).slice(0, 24) }],
      subtitle: "Source-backed dua",
    });
  },
};
