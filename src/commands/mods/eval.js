const mathjs = require("mathjs");

module.exports = {
  meta: {
    name: "eval",
    aliases: ["calculate"],
    category: "mods",
    description: "Safely evaluate a math expression.",
    cooldownSeconds: 3,
    access: "owner",
    chat: "both",
    usage: "<expression>",
  },
  async execute(ctx) {
    if (!ctx.text) {
      await ctx.reply(`Usage: ${ctx.config.prefix}eval 2 + 2 * 5`);
      return;
    }

    const result = mathjs.evaluate(ctx.text);
    await ctx.reply(`Result: ${result}`);
  },
};
