const axios = require("axios");

module.exports = {
  meta: {
    name: "shorturl",
    aliases: ["short", "surl"],
    category: "utils",
    description: "Shorten a URL using shrtco.de.",
    cooldownSeconds: 5,
    access: "user",
    chat: "both",
    usage: "<url>",
  },
  async execute(ctx) {
    if (!ctx.text) {
      await ctx.reply("Provide the URL you want to shorten.");
      return;
    }

    const { data } = await axios.get("https://api.shrtco.de/v2/shorten", {
      params: { url: ctx.text },
      timeout: 15_000,
    });

    await ctx.reply(
      `Original: ${ctx.text}\nShort: ${data.result.full_short_link}`,
    );
  },
};
