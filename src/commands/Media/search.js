const yts = require("yt-search");
const axios = require("axios");

module.exports = {
  meta: {
    name: "ytsearch",
    aliases: ["yts", "search"],
    category: "media",
    cooldownSeconds: 4,
    access: "user",
    chat: "both",
    usage: "ytsearch <query>",
    description: "Search and download YouTube videos"
  },

  async execute(ctx) {
    const client = ctx.client || ctx.sock || ctx.conn;
    const msg = ctx.msg;
    const jid =
      msg?.key?.remoteJid ||
      ctx.from;

    const text =
      (ctx.body || "").trim();

    if (!client?.sendMessage) {
      return ctx.reply("❌ WhatsApp client not available.");
    }

    client.searchStore = client.searchStore || new Map();

    
    const session = client.searchStore.get(jid);

    if (session) {

     
      if (session.stage === "select") {

        const num = parseInt(text);

        if (isNaN(num) || num < 1 || num > session.results.length) {
          return client.sendMessage(jid, {
            text: "❌ Invalid number. Reply 1–10."
          }, { quoted: msg });
        }

        const selected = session.results[num - 1];

        session.stage = "type";
        session.selected = selected;

        client.searchStore.set(jid, session);

        return client.sendMessage(jid, {
          text:
`🎧 *Choose Format*

1 → Video 🎬
2 → Audio 🎵

Reply with 1 or 2`
        }, { quoted: msg });
      }

     
      if (session.stage === "type") {

        const url = session.selected.url;
        const info = session.selected;

        client.searchStore.delete(jid);

      
        if (text === "1") {

          await client.sendMessage(jid, {
            text: "🎥 Downloading video..."
          }, { quoted: msg });

          try {
            const { data } = await axios.get(
              `https://apis.davidcyril.name.ng/youtube/mp4?url=${encodeURIComponent(url)}`
            );

            if (data?.result?.download_url) {
              return client.sendMessage(jid, {
                video: { url: data.result.download_url },
                caption: info.title
              }, { quoted: msg });
            }
          } catch {}

          try {
            const { data } = await axios.get(
              `https://apis.davidcyril.name.ng/download/ytmp4?url=${encodeURIComponent(url)}`
            );

            if (data?.result?.download_url) {
              return client.sendMessage(jid, {
                video: { url: data.result.download_url },
                caption: info.title
              }, { quoted: msg });
            }
          } catch {}

          return client.sendMessage(jid, {
            text: "❌ Video download failed."
          }, { quoted: msg });
        }

        
        if (text === "2") {

          await client.sendMessage(jid, {
            text: "🎶 Downloading audio..."
          }, { quoted: msg });

          try {
            const { data } = await axios.get(
              `https://apis.davidcyril.name.ng/play?query=${encodeURIComponent(url)}`
            );

            if (data?.result?.download_url) {
              return client.sendMessage(jid, {
                document: { url: data.result.download_url },
                mimetype: "audio/mpeg",
                fileName: `${info.title}.mp3`
              }, { quoted: msg });
            }
          } catch {}

          return client.sendMessage(jid, {
            text: "❌ Audio download failed."
          }, { quoted: msg });
        }

        return client.sendMessage(jid, {
          text: "❌ Reply with 1 or 2."
        }, { quoted: msg });
      }
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

      
      client.searchStore.set(jid, {
        stage: "select",
        results: videos
      });

      const thumb = videos[0].thumbnail;

      let textMsg = `🎧 *YouTube Search*\n\n`;
      textMsg += `🔍 Query: ${query}\n\n`;

      videos.forEach((v, i) => {
        textMsg += `*${i + 1}.* ${v.title}\n`;
        textMsg += `👤 ${v.author.name}\n`;
        textMsg += `⏱ ${v.duration?.timestamp || "Unknown"}\n\n`;
      });

      textMsg += `📥 Reply with number (1–10)`;

      return client.sendMessage(jid, {
        image: { url: thumb },
        caption: textMsg
      }, { quoted: msg });

    } catch (err) {
      console.error("YTSEARCH ERROR:", err);
      return ctx.reply("❌ Error fetching results.");
    }
  }
};
