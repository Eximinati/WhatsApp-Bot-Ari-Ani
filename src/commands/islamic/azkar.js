const {
  buildCaption,
  compactLines,
  getCommandText,
  requireInput,
} = require("../../utils/islamic-command-utils");

module.exports = {
  meta: {
    name: "azkar",
    aliases: ["adhkar"],
    category: "islamic",
    description: "Show curated azkar for a category like morning, evening, or travel.",
    cooldownSeconds: 8,
    access: "user",
    chat: "both",
    usage: "<morning|evening|sleep|travel|rain|distress>",
  },
  async execute(ctx) {
    const query = getCommandText(ctx);
    if (!(await requireInput(ctx, query, "Use /azkar morning or /azkar travel."))) {
      return;
    }

    const settings = await ctx.services.islamic.getUserIslamicSettings(ctx.msg.sender);
    const result = ctx.services.islamic.getAzkar(query, settings);
    const title = `AZKAR | ${result.category}`;
    const lines = compactLines(result.lines, 10);
    await ctx.services.visuals.sendDuaCard({
      ctx,
      title,
      lines,
      caption: buildCaption(title, lines),
      chips: [result.category, "Top 3"],
      stats: [{ label: "Entries", value: String(result.entries.length) }],
      subtitle: "Curated adhkar pack",
    });
  },
};
