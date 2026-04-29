const { capitalize, commandUsage } = require("../../utils/text");
const { formatNow, getGreeting } = require("../../utils/time");

module.exports = {
  meta: {
    name: "help",
    aliases: ["h", "menu", "commands"],
    category: "general",
    description: "Show command list or details",
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
        return ctx.reply(`❌ No command named *${query}* found.`);
      }

      const meta = command.meta;

      return ctx.reply(
`📖 *COMMAND INFO*

🧩 Name: ${meta.name}
📝 Description: ${meta.description}
🔖 Aliases: ${meta.aliases?.join(", ") || "none"}
📌 Usage: ${commandUsage(ctx.config.prefix, meta.name, meta.usage)}
👤 Access: ${capitalize(meta.access)}
💬 Chat: ${capitalize(meta.chat)}`
      );
    }
    const grouped = ctx.services.commands.grouped();

    const lines = [
`╭─❖─❖─❖─❖─❖─❖─❖─❖─╮
│ 👋 ${getGreeting(ctx.config.timezone)}
│ 🤖 Bot: ${ctx.config.botName}
│ ⏰ Time: ${formatNow(ctx.config.timezone)}
╰─❖─❖─❖─❖─❖─❖─❖─❖─╯

🧧 𝐏𝐫𝐞𝐟𝐢𝐱: [ ${ctx.config.prefix} ]

💡 Use categories below to explore commands.`
    ];

    const icons = {
      economy: "🎰",
      general: "🌀",
      group: "👥",
      mods: "🖥️",
      games: "🎮",
      media: "🎵",
      misc: "🉐",
      access: "📡",
      islamic: "☪️",
      productivity: "⏳️",
      search: "🔍",
      study: "📖",
      utils: "🧩",
      weeb: "🎴"
 };

    for (const [category, commands] of Object.entries(grouped)) {
      const names = commands.map(c => c.meta.name).join(", ");

      lines.push(
`*${capitalize(category)} ${icons[category] || "✨"} :-*
\`\`\`${names}\`\`\``
      );
    }

    
    lines.push(
`💡 Type *.help <cmd>* for details.`
    );

    return ctx.reply(lines.join("\n"));
  }
};
