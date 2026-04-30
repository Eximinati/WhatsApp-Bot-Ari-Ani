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

    const client = ctx.client || ctx.sock || ctx.conn;
    const jid = ctx.msg?.key?.remoteJid || ctx.from;

    if (!client?.sendMessage) {
      return ctx.reply("❌ WhatsApp client unavailable.");
    }

    
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
📌 Usage: ${meta.usage}
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
      misc: "🧩",
      access: "📡",
      islamic: "☪️",
      productivity: "⏳️",
      search: "🔍",
      study: "📖",
      utils: "🧩",
      weeb: "🎴"
    };

    let categories = "";

    for (const category of Object.keys(grouped)) {
      categories += `┃ ${icons[category] || "✨"}  𝑪𝒂𝒕𝒆𝒈𝒐𝒓𝒚: ${capitalize(category)}\n`;
    }

    
    let message = `
👋 ${getGreeting(ctx.config.timezone)} ${ctx.pushName || "User"}, I'm Ari-Ani your WhatsApp assistant bot.

🏮→ 𝐒𝐜𝐫𝐢𝐩𝐭: 𝐓𝐡𝐢𝐬 𝐢𝐬 𝐚 𝐩𝐮𝐛𝐥𝐢𝐜 𝐬𝐜𝐫𝐢𝐩𝐭, 𝐧𝐨𝐭 𝐟𝐨𝐫 𝐬𝐚𝐥𝐞.
🏮→ 𝐖𝐚𝐫𝐧𝐢𝐧𝐠: 𝐃𝐨𝐧'𝐭 𝐜𝐚𝐥𝐥 𝐭𝐡𝐞 𝐛𝐨𝐭 𝐨𝐫 𝐲𝐨𝐮 𝐦𝐚𝐲 𝐛𝐞 𝐛𝐚𝐧𝐧𝐞𝐝.
🏮→ 𝐖𝐚𝐫𝐧𝐢𝐧𝐠: 𝐃𝐨𝐧'𝐭 𝐮𝐬𝐞 𝐭𝐡𝐞 𝐛𝐨𝐭 𝐢𝐧 𝐏𝐌 𝐨𝐫 𝐲𝐨𝐮 𝐦𝐚𝐲 𝐛𝐞 𝐛𝐚𝐧𝐧𝐞𝐝.

🧧 𝐏𝐫𝐞𝐟𝐢𝐱: [ ${ctx.config.prefix} ]

⛩️ 𝐇𝐞𝐫𝐞 𝐚𝐫𝐞 𝐭𝐡𝐞 𝐜𝐚𝐭𝐞𝐠𝐨𝐫𝐲 𝐜𝐨𝐦𝐦𝐚𝐧𝐝𝐬:

╭─📦 𝑪𝑨𝑻𝑬𝑮𝑶𝑹𝑰𝑬𝑺 ─╮

${categories}

╰──────────────────╯

🌟 Usage: → ${ctx.config.prefix}menu <category>
🌟 Usage: → ${ctx.config.prefix}help <command>
`;

    
    const imageUrl = "https://i.ibb.co/XkV6hgfw/Deryl.jpg";

    return client.sendMessage(
      jid,
      {
        image: { url: imageUrl },
        caption: message
      },
      { quoted: ctx.msg }
    );
  }
};
