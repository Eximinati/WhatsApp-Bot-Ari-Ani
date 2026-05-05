const { capitalize } = require("../../utils/text");
const { formatNow, getGreeting } = require("../../utils/time");

const customFontMap = {
  a: '𝐚', b: '𝐛', c: '𝐜', d: '𝐝', e: '𝐞', f: '𝐟', g: '𝐠', h: '𝐡', i: '𝐢', j: '𝐣',
  k: '𝐤', l: '𝐥', m: '𝐦', n: '𝐧', o: '𝐨', p: '𝐩', q: '𝐪', r: '𝐫', s: '𝐬', t: '𝐭',
  u: '𝐮', v: '𝐯', w: '𝐰', x: '𝐱', y: '𝐲', z: '𝐳',

  A: '𝐀', B: '𝐁', C: '𝐂', D: '𝐃', E: '𝐄', F: '𝐅', G: '𝐆', H: '𝐇', I: '𝐈', J: '𝐉',
  K: '𝐊', L: '𝐋', M: '𝐌', N: '𝐍', O: '𝐎', P: '𝐏', Q: '𝐐', R: '𝐑', S: '𝐒', T: '𝐓',
  U: '𝐔', V: '𝐕', W: '𝐖', X: '𝐗', Y: '𝐘', Z: '𝐙'
};

const toFont = (text = "") =>
  text.replace(/[a-zA-Z]/g, (char) => customFontMap[char] || char);


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
          .slice(0, 900);

        const text = toFont(`
▬▬▬๑۩ ${capitalize(query)} ۩๑▬▬▬▬

☞   ${cmdLine}

⌜${capitalize(query)} Commands ⌝
        `);

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

      return ctx.reply(toFont(
`📖 COMMAND INFO

🧩 Name: ${meta.name}
📝 Description: ${meta.description}
🔖 Aliases: ${meta.aliases?.join(", ") || "none"}
📌 Usage: ${meta.usage}
👤 Access: ${meta.access}`
      ));
    }


    
    const grouped = ctx.services.commands.grouped();

    let categories = Object.keys(grouped)
      .map(cat => `┃ ${icons[cat] || "✨"} ${capitalize(cat)}`)
      .join("\n");

    let message = toFont(`
👋 ${getGreeting(ctx.config.timezone)} ${ctx.pushName || "User"}, I'm Ari-Ani your WhatsApp assistant bot.

🏮→ This is a public script, not for sale.
🏮→ Don't call the bot or you may be banned.
🏮→ Don't use the bot in PM

🧧 Prefix: [ ${ctx.config.prefix} ]

⛩️ Here are the category commands:

╭─ 📦 CATEGORIES ─╮

${categories}

╰────────╯

🌟 Usage: use ${ctx.config.prefix}menu <category>
🌟 Usage: use ${ctx.config.prefix}help <command>
`);

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
