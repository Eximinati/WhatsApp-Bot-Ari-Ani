module.exports = {
  meta: {
    name: "dict",
    aliases: ["dictionary"],
    category: "search",
    description: "Look up a word definition.",
    cooldownSeconds: 5,
    access: "user",
    chat: "both",
    usage: "<word>",
  },
  async execute(ctx) {
    if (!ctx.text) {
      await ctx.reply("Provide a word to define.");
      return;
    }

    try {
      const result = await ctx.services.external.dictionary.define(ctx.text);
      await ctx.reply(
        [
          `*${result.word}* ${result.phonetic || ""}`.trim(),
          result.partOfSpeech ? `Part of speech: ${result.partOfSpeech}` : "",
          result.definition || "No definition found.",
          result.example ? `Example: ${result.example}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    } catch {
      await ctx.reply("Dictionary lookup failed right now. Try another word later.");
    }
  },
};
