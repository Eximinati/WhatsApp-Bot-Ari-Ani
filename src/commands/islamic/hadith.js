const {
  buildCaption,
  compactLines,
  getCommandText,
  requireInput,
} = require("../../utils/islamic-command-utils");

module.exports = {
  meta: {
    name: "hadith",
    aliases: ["hadees"],
    category: "islamic",
    description: "Fetch a hadith by collection and number, or by curated topic.",
    cooldownSeconds: 8,
    access: "user",
    chat: "both",
    usage: "<collection number | topic>",
  },
  async execute(ctx) {
    const query = getCommandText(ctx);
    if (!(await requireInput(ctx, query, "Use /hadith bukhari 1 or /hadith intentions."))) {
      return;
    }

    const settings = await ctx.services.islamic.getUserIslamicSettings(ctx.msg.sender);
    const [a = "", b = ""] = ctx.args;
    const result =
      ctx.args.length >= 2
        ? await ctx.services.islamic.getHadith(a, b, settings)
        : await ctx.services.islamic.getHadith(query, "", settings);
    const ref = `${result.bundle.collection || result.topic?.collection || a} ${result.bundle.number}`;
    const title = `HADITH | ${ref}`;
    const lines = compactLines(result.lines, 9);
    await ctx.services.visuals.sendHadithCard({
      ctx,
      title,
      lines,
      caption: buildCaption(title, lines),
      chips: [String(result.bundle.collection || result.topic?.collection || "Hadith"), String(result.bundle.number)],
      stats: [
        { label: "Collection", value: String(result.bundle.collection || result.topic?.collection || "Hadith") },
        { label: "Number", value: String(result.bundle.number) },
      ],
      subtitle: result.exact ? "Exact hadith reference" : "Curated topic match",
    });
  },
};
