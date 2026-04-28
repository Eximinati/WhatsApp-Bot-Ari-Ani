const yts = require("yt-search");

module.exports = {
  meta: {
    name: "ytsearch",
    aliases: ["yts", "search"],
    category: "media",
    cooldownSeconds: 4,
    access: "user",
    chat: "both",
    usage: "ytsearch <query>",
    description: "Search YouTube videos"
  },

  async execute(ctx) {
    const client = ctx.client || ctx.sock || ctx.conn;
    const msg = ctx.msg;
    const jid = msg?.key?.remoteJid || ctx.from;

    if (!client?.sendMessage) {
      return ctx.reply("❌ WhatsApp client not available.");
    }

    const query = ctx.args.join(" ").trim();

    if (!query) {
      return ctx.reply("❌ Provide a search query.");
    }

    try {
      await client.sendPresenceUpdate("composing", jid);

      const search = await yts(query);
      const videos = search.videos.slice(0, 10);

      if (!videos.length) {
        return ctx.reply("❌ No results found.");
      }

      
      client.searchStore = client.searchStore || new Map();

      
      client.searchStore.set(jid, {
        stage: "select",
        results: videos
      });

      const thumb = videos[0].thumbnail;

      let text = `🎧 *YouTube Search*\n\n`;
      text += `🔍 Query: ${query}\n\n`;

      videos.forEach((v, i) => {
        text += `*${i + 1}.* ${v.title}\n`;
        text += `👤 ${v.author.name}\n`;
        text += `⏱ ${v.duration?.timestamp || "Unknown"}\n\n`;
      });

      text += `📥 Reply with number (1–10) to continue`;

      return await client.sendMessage(
        jid,
        {
          image: { url: thumb },
          caption: text
        },
        { quoted: msg }
      );

    } catch (err) {
      console.error("YT Search Error:", err);
      return ctx.reply("❌ Error fetching results.");
    }
  }
};
