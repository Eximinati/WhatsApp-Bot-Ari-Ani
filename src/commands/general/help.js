const { capitalize, commandUsage } = require("../../utils/text");
const { formatNow, getGreeting } = require("../../utils/time");

module.exports = {
  meta: {
    name: "help",
    aliases: ["h", "menu", "commands"],
    category: "general",
    description: "Show the command list or detailed help for a specific command.",
    cooldownSeconds: 5,
    access: "user",
    chat: "both",
    usage: "[command]",
  },
  async execute(ctx) {
    const query = ctx.args[0]?.toLowerCase();
    if (query) {
      const command = ctx.services.commands.get(query);
      if (!command) {
        await ctx.reply(`No command named *${query}* was found.`);
        return;
      }

      const meta = command.meta;
      const message = [
        `*${meta.name}*`,
        meta.description,
        `Aliases: ${meta.aliases.join(", ") || "none"}`,
        `Usage: ${commandUsage(ctx.config.prefix, meta.name, meta.usage)}`,
        `Access: ${capitalize(meta.access)}`,
        `Chat: ${capitalize(meta.chat)}`,
      ].join("\n");
      await ctx.reply(message);
      return;
    }

    const grouped = ctx.services.commands.grouped();
    const lines = [
      `*${getGreeting(ctx.config.timezone)}*`,
      `Bot: ${ctx.config.botName}`,
      `Time: ${formatNow(ctx.config.timezone)}`,
      "",
    ];

    for (const [category, commands] of Object.entries(grouped)) {
      const names = commands.map((command) => `\`${command.meta.name}\``).join(", ");
      lines.push(`*${capitalize(category)}*`);
      lines.push(names);
      lines.push("");
    }

    lines.push(`Use *${ctx.config.prefix}help <command>* for details.`);
    await ctx.reply(lines.join("\n"));
  },
};
