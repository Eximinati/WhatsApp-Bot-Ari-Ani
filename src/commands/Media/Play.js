const axios = require("axios");
const yts = require("yt-search");

async function downloadBuffer(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 120000
      });
      return res.data;
    } catch (err) {
      console.log(`Download retry ${i + 1}`);
      if (i === retries - 1) throw err;
    }
  }
}

module.exports = {
  meta: {
    name: "play",
    aliases: ["yta", "song", "ytaudio", "playaudio"],
    category: "media",
    description: "Download and play audio from YouTube.",
    cooldownSeconds: 10,
    access: "user",
    chat: "both",
    usage: "<song name/link>",
  },

  async execute(ctx) {
    const arg = ctx.args.join(" ");
    const client = ctx.client; 
    const msg = ctx.msg; 
    
    if (!arg) {
      await ctx.reply("❗ Provide a YouTube link or song name.");
      return;
    }

    
    if (ctx.react) await ctx.react("✅");

    try {
      const search = async (term) => {
        const { videos } = await yts(term.trim());
        return videos?.length ? videos[0] : null;
      };

      const validYT = /^https?:\/\/(youtu\.be\/|(www\.)?youtube\.com\/(embed|v|shorts|watch))/;
      const isLink = validYT.test(arg.trim());

      let info;
      let url;

      if (isLink) {
        const idMatch = arg.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
        if (!idMatch) return ctx.reply("❗ Invalid YouTube link.");
        info = await yts({ videoId: idMatch[1] });
        url = arg.trim();
      } else {
        info = await search(arg);
        url = info?.url;
      }

      if (!info) return ctx.reply("❗ Could not retrieve video details.");

      if (Number(info.seconds) > 10800) {
        return ctx.reply("❌ Cannot download audio longer than 3 hours.");
      }

      await ctx.reply(`🎵 Preparing audio: *${info.title}*`);
      try {
        const apiUrl = (`https://apis.davidcyril.name.ng/play?query=${encodeURIComponent(url)}`);
        const { data } = await axios.get(apiUrl, { timeout: 120000 });

        if (data?.status && data?.result?.download_url) {
          const audioBuffer = await downloadBuffer(data.result.download_url);
          return await client.sendMessage(ctx.from, {
            document: audioBuffer,
            mimetype: "audio/mpeg",
            fileName: `${info.title.replace(/[\\/:*?"<>|]/g, "")}.mp3`,
            contextInfo: {
              externalAdReply: {
                title: info.title,
                body: info.author?.name || "",
                thumbnailUrl: data.result.thumbnail,
                mediaType: 2,
                mediaUrl: url,
                sourceUrl: url
              }
            }
          }, { quoted: msg });
        }
      } catch (err) {
        console.log("❌ API1 failed");
      }

      
      try {
        const API_BASE = "https://space2bnhz.tail9ef80b.ts.net";
        const response = await axios.post(
          `${API_BASE}/song/download`,
          { title: info.title },
          { headers: { "Content-Type": "application/json" }, timeout: 120000 }
        );

        const data = response.data;
        if (data?.file_url) {
          const fixedUrl = data.file_url.replace("http://127.0.0.1:5000", API_BASE);
          const audioBuffer = await downloadBuffer(fixedUrl);

          return await client.sendMessage(ctx.from, {
            document: audioBuffer,
            mimetype: "audio/mpeg",
            fileName: `${(data.title || info.title).replace(/[\\/:*?"<>|]/g, "")}.mp3`,
            contextInfo: {
              externalAdReply: {
                title: data.title || info.title,
                body: "Download Complete 🎵",
                thumbnailUrl: data.thumbnail,
                mediaType: 2,
                mediaUrl: data.url || url,
                sourceUrl: data.url || url
              }
            }
          }, { quoted: msg });
        }
      } catch (err) {
        console.log("❌ API2 failed");
      }

      
      try {
        const api3 = `https://apis-keith.vercel.app/download/dlmp3?url=${encodeURIComponent(url)}`;
        const { data } = await axios.get(api3, { timeout: 120000 });
        const downloadUrl = data?.result?.download || data?.download || data?.url;

        if (downloadUrl) {
          const audioBuffer = await downloadBuffer(downloadUrl);
          return await client.sendMessage(ctx.from, {
            document: audioBuffer,
            mimetype: "audio/mpeg",
            fileName: `${info.title.replace(/[\\/:*?"<>|]/g, "")}.mp3`,
            contextInfo: {
              externalAdReply: {
                title: info.title,
                body: "Backup Download 🎵",
                thumbnailUrl: info.thumbnail,
                mediaType: 2,
                mediaUrl: url,
                sourceUrl: url
              }
            }
          }, { quoted: msg });
        }
      } catch (err) {
        console.log("❌ API3 failed");
      }

      return ctx.reply("❌ Failed to download audio after trying all sources.");

    } catch (error) {
      console.error("Unexpected error:", error);
      ctx.reply("❌ Unexpected error occurred.");
    }
  },
};

