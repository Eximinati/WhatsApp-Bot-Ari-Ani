const {
  buildCaption,
  compactLines,
  getCommandText,
  requireInput,
} = require("../../utils/islamic-command-utils");

module.exports = {
  meta: {
    name: "page",
    aliases: ["mushafpage"],
    category: "islamic",
    description: "Render a Madinah Mushaf page image by page number.",
    cooldownSeconds: 8,
    access: "user",
    chat: "both",
    usage: "<1-604>",
  },
  async execute(ctx) {
    const query = getCommandText(ctx);
    if (!(await requireInput(ctx, query, "Use /page 1."))) {
      return;
    }

    const result = await ctx.services.islamic.getPage(query);
    const title = `PAGE | ${result.page}`;
    const lines = compactLines(result.lines, 6);
    await ctx.services.visuals.sendQuranAyahCard({
      ctx,
      title,
      image: result.image,
      lines,
      caption: buildCaption(title, lines),
      chips: [`Page ${result.page}`, "Mushaf"],
      stats: [
        { label: "Starts", value: `${result.meta.first[0]}:${result.meta.first[1]}` },
        { label: "Ends", value: `${result.meta.last[0]}:${result.meta.last[1]}` },
      ],
      subtitle: "Madinah Mushaf page",
    });
  },
};
