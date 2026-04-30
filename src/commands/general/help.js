const { capitalize, commandUsage } = require("../../utils/text");
const { formatNow, getGreeting } = require("../../utils/time");
const axios = require("axios");

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

    let commands = "";

    for (const [category, cmds] of Object.entries(grouped)) {
      const names = cmds.map(c => c.meta.name).join(", ");

      commands += `*${capitalize(category)} ${icons[category] || "✨"}*\n\`\`\`${names}\`\`\`\n\n`;
    }

    
    let message = `👋 ${getGreeting(ctx.config.timezone)} ${ctx.pushName || "User"}, l'm Ari-Ani your WhatsApp assistant bot.

🤖 *${ctx.config.botName}*
⏰ ${formatNow(ctx.config.timezone)}

🧧 Prefix: [ ${ctx.config.prefix} ]

💡 *Tips:*
→ Type *${ctx.config.prefix}help <command>* to view details
→ Stay updated and explore all features

📋 *COMMAND LIST:*
━━━━━━━━━━━━━━━━━━━━━━━
${commands}
━━━━━━━━━━━━━━━━━━━━━━━

🗃️ Thanks for using ${ctx.config.botName} 💖
🌟 If you find me helpful, please share me with your friends and leave a review!`;

    
    const imageUrl = "https://i.ibb.co/XkV6hgfw/Deryl.jpg";

    const { data } = await axios.get(imageUrl, {
      responseType: "arraybuffer"
    });

    const buffer = Buffer.from(data, "binary");

    
    return ctx.sock.sendMessage(ctx.chat, {
      image: buffer,
      caption: message,
      footer: ctx.config.botName,
      headerType: 4
    });
  }
};
