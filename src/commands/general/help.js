const { capitalize } = require("../../utils/text");
const { formatNow, getGreeting } = require("../../utils/time");

module.exports = {
  meta: {
    name: "help",
    aliases: ["h","commands"],
    category: "general",
    description: "Show command list or details",
    cooldownSeconds: 5,
    access: "user",
    chat: "both",
    usage: "[command]",
  },

  async execute(ctx) {

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

    const query = ctx.args[0]?.toLowerCase();

    const client = ctx.client || ctx.sock || ctx.conn;
    const jid = ctx.msg?.key?.remoteJid || ctx.from;

    if (!client?.sendMessage) {
      return ctx.reply("❌ WhatsApp client unavailable.");
    }

    
    if (query) {
      const grouped = ctx.services.commands.grouped();
      const category = grouped[query];

      if (category) {
        const icon = icons[query] || "✨";

        let cmdList = "";
        for (const cmd of category) {
          cmdList += `┃ ◦ ${cmd.meta.name}\n`;
        }

        return ctx.reply(
`${icon} *${capitalize(query)}* (${category.length})

${cmdList}
┗━━━━━━━━━━━━╯

📌 Use ${ctx.config.prefix}help <command> for details.`
        );
      }

      const command = ctx.services.commands.get(query);

      if (!command) {
        return ctx.reply(`❌ No command or category named *${query}* found.\n\nUse ${ctx.config.prefix}menu to see all categories.`);
      }

      const meta = command.meta;

      return ctx.reply(
`📖 𝐂𝐎𝐌𝐌𝐀𝐍𝐃 𝐈𝐍𝐅𝐎

🧩 𝐍𝐚𝐦𝐞: ${meta.name}
📝 𝐃𝐞𝐬𝐜𝐫𝐢𝐩𝐭𝐢𝐨𝐧: ${meta.description}
🔖 𝐀𝐥𝐢𝐚𝐬𝐞𝐬: ${meta.aliases?.join(", ") || "none"}
📌 𝐔𝐬𝐚𝐠𝐞: ${meta.usage}
👤 𝐀𝐜𝐜𝐞𝐬𝐬: ${meta.access}`
      );
    }

    
    const grouped = ctx.services.commands.grouped();

    
    let categories = "";

    for (const category of Object.keys(grouped)) {
      categories += `┃ ${icons[category] || "✨"} ${capitalize(category)}\n`;
    }

  
    let message = `
👋 ${getGreeting(ctx.config.timezone)} ${ctx.pushName || "User"}, I'm Ari-Ani your WhatsApp assistant bot.

🏮→ 𝐓𝐡𝐢𝐬 𝐢𝐬 𝐚 𝐩𝐮𝐛𝐥𝐢𝐜 𝐬𝐜𝐫𝐢𝐩𝐭, 𝐧𝐨𝐭 𝐟𝐨𝐫 𝐬𝐚𝐥𝐞.
🏮→ 𝐃𝐨𝐧'𝐭 𝐜𝐚𝐥𝐥 𝐭𝐡𝐞 𝐛𝐨𝐭 𝐨𝐫 𝐲𝐨𝐮 𝐦𝐚𝐲 𝐛𝐞 𝐛𝐚𝐧𝐧𝐞𝐝.
🏮→ 𝐃𝐨𝐧'𝐭 𝐮𝐬𝐞 𝐭𝐡𝐞 𝐛𝐨𝐭 𝐢𝐧 𝐏𝐌 𝐨𝐫 𝐲𝐨𝐮 𝐦𝐚𝐲 𝐛𝐞 𝐛𝐚𝐧𝐧𝐞𝐝.

🧧 𝐏𝐫𝐞𝐟𝐢𝐱: [ ${ctx.config.prefix} ]

⛩️ 𝐇𝐞𝐫𝐞 𝐚𝐫𝐞 𝐭𝐡𝐞 𝐜𝐚𝐭𝐞𝐠𝐨𝐫𝐲 𝐜𝐨𝐦𝐦𝐚𝐧𝐝𝐬:

╭─📦 𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐈𝐄𝐒 ─╮

${categories}
╰───────────╯

🌟 𝐔𝐬𝐚𝐠𝐞: 𝐮𝐬𝐞 ${ctx.config.prefix}menu <category>
🌟 𝐔𝐬𝐚𝐠𝐞: 𝐮𝐬𝐞 ${ctx.config.prefix}help <command>
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
