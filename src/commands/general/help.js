const { capitalize } = require("../../utils/text");
const { formatNow, getGreeting } = require("../../utils/time");


const categoryImages = {
general: "https://i.ibb.co/WvCnB8WM/Deryl.jpg",
group: "https://i.ibb.co/CKvNPBLr/Deryl.jpg",
games: "https://i.ibb.co/4gC4Rj9b/Deryl.jpg",
media: "https://i.ibb.co/ynV86TBY/Deryl.jpg",
weeb: "https://i.ibb.co/dsWj285f/Deryl.jpg",
economy: "https://i.ibb.co/nM7SHwLY/Deryl.jpg",
mods: "https://i.ibb.co/nqZXYv56/Deryl.jpg",
productivity: "https://i.ibb.co/XQtrY26/Deryl.jpg",
access: "https://i.ibb.co/rGrx1swS/Deryl.jpg",
misc: "https://i.ibb.co/1YXJcD5m/Deryl.jpg",
ismlamic: "https://i.ibb.co/XfRfySZZ/Deryl.jpg",
search: "https://i.ibb.co/v6QJYnmr/Deryl.jpg",
study: "https://i.ibb.co/Y7XbKcbC/Deryl.jpg",
utils: "https://i.ibb.co/G3T425vQ/Deryl.jpg"

};


const thumbnailUrls = [
"https://i.ibb.co/6RxTGwCZ/Deryl.jpg",
"https://i.ibb.co/pvnNm0TX/Deryl.jpg",
"https://i.ibb.co/jkyVdTh4/Deryl.jpg",
"https://i.ibb.co/VYg9c7DJ/Deryl.jpg",
"https://i.ibb.co/4ZtT2wpH/Deryl.jpg",
"https://i.ibb.co/cStLwZy4/Deryl.jpg"
];

function getRandomThumbnailUrl() {
  return thumbnailUrls[Math.floor(Math.random() * thumbnailUrls.length)];
}

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

        
        let cmdLine = category
          .map(cmd => `❄︎ ${cmd.meta.name}`)
          .join("  ")
          .slice(0, 900); // prevent overflow

        const text = `
▬▬▬๑۩ ${capitalize(query)} ۩๑▬▬▬▬

☞   ${cmdLine}

⌜${capitalize(query)} Commands ⌝
`;

        const imageUrl = categoryImages[query] || getRandomThumbnailUrl();

        return client.sendMessage(
          jid,
          {
            image: { url: imageUrl },
            caption: text
          },
          { quoted: ctx.msg }
        );
      }

      
      const command = ctx.services.commands.get(query);

      if (!command) {
        return ctx.reply(
`❌ No command or category named *${query}* found.

Use ${ctx.config.prefix}menu to see all categories.`
        );
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

    let categories = Object.keys(grouped)
      .map(cat => `┃ ${icons[cat] || "✨"} ${capitalize(cat)}`)
      .join("\n");

    let message = `
👋 ${getGreeting(ctx.config.timezone)} ${ctx.pushName || "User"}, I'm Ari-Ani your WhatsApp assistant bot.

🏮→ 𝐓𝐡𝐢𝐬 𝐢𝐬 𝐚 𝐩𝐮𝐛𝐥𝐢𝐜 𝐬𝐜𝐫𝐢𝐩𝐭, 𝐧𝐨𝐭 𝐟𝐨𝐫 𝐬𝐚𝐥𝐞.
🏮→ 𝐃𝐨𝐧'𝐭 𝐜𝐚𝐥𝐥 𝐭𝐡𝐞 𝐛𝐨𝐭 𝐨𝐫 𝐲𝐨𝐮 𝐦𝐚𝐲 𝐛𝐞 𝐛𝐚𝐧𝐧𝐞𝐝.
🏮→ 𝐃𝐨𝐧'𝐭 𝐮𝐬𝐞 𝐭𝐡𝐞 𝐛𝐨𝐭 𝐢𝐧 𝐏𝐌

🧧 𝐏𝐫𝐞𝐟𝐢𝐱: [ ${ctx.config.prefix} ]

⛩️ 𝐇𝐞𝐫𝐞 𝐚𝐫𝐞 𝐭𝐡𝐞 𝐜𝐚𝐭𝐞𝐠𝐨𝐫𝐲 𝐜𝐨𝐦𝐦𝐚𝐧𝐝𝐬:

╭─ 📦  𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐈𝐄𝐒  ─╮

${categories}

╰────────╯

🌟 𝐔𝐬𝐚𝐠𝐞: 𝐮𝐬𝐞 ${ctx.config.prefix}menu <category>
🌟 𝐔𝐬𝐚𝐠𝐞: 𝐮𝐬𝐞 ${ctx.config.prefix}help <command>
`;

    const imageUrl = getRandomThumbnailUrl();

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
