const axios = require("axios");
const yts = require("yt-search");

async function downloadBuffer(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 120000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "*/*",
          "Referer": "https://www.youtube.com/"
        }
      });

      return Buffer.from(res.data);

    } catch (err) {
      console.log(`Download retry ${i + 1}`);
      if (i === retries - 1) throw err;
    }
  }
}

module.exports = {
  meta: {
    name: "video",
    aliases: ["ytvideo", "mp4", "ytv"],
    category: "media",
    cooldownSeconds: 5,
    access: "user",
    chat: "both",
    usage: "video <youtube link or name>",
    description: "Download YouTube videos"
  },

  async execute(ctx) {
    const client = ctx.client || ctx.sock || ctx.conn;
    const msg = ctx.msg;
    const jid = msg?.key?.remoteJid || ctx.from;

    if (!client?.sendMessage) {
      return ctx.reply("❌ WhatsApp client not available.");
    }

    const arg = ctx.args.join(" ").trim();

    if (!arg) {
      return ctx.reply("❗ Provide a YouTube link or video name.");
    }

    const validYT =
      /^https?:\/\/(youtu\.be\/|(www\.)?youtube\.com\/(embed|v|shorts|watch))/;

    const isLink = validYT.test(arg);

    let info;
    let url;

    try {
      const search = async (term) => {
        const { videos } = await yts(term.trim());
        return videos?.length ? videos[0] : null;
      };

      if (isLink) {
        const idMatch = arg.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);

        if (!idMatch) {
          return ctx.reply("❗ Invalid YouTube link.");
        }

        info = await yts({ videoId: idMatch[1] });
        url = arg.trim();

      } else {
        info = await search(arg);
        url = info?.url;
      }

      if (!info) {
        return ctx.reply("❗ Could not retrieve video details.");
      }

      await ctx.reply(`🎬 Preparing video: *${info.title}*`);

     
      try {
        console.log("🔵 Trying API1");

        const { data } = await axios.get(
          `https://apis.davidcyril.name.ng/youtube/mp4?url=${encodeURIComponent(url)}`
        );

        if (data?.status && data?.result?.download_url) {
          const videoBuffer = await downloadBuffer(data.result.download_url);

          return await client.sendMessage(
            jid,
            {
              video: videoBuffer,
              caption: `🎬 ${info.title}\n\n⏱ ${info.timestamp}\n👤 ${info.author?.name || "Unknown"}`
            },
            { quoted: msg }
          );
        }

      } catch (e) {
        console.log("API1 failed:", e.message);
      }

     
      try {
        console.log("🟣 Trying API2");

        const { data } = await axios.get(
          `https://apis.davidcyril.name.ng/download/ytmp4?url=${encodeURIComponent(url)}`
        );

        if (data?.status && data?.result?.download_url) {
          const videoBuffer = await downloadBuffer(data.result.download_url);

          return await client.sendMessage(
            jid,
            {
              video: videoBuffer,
              caption: `🎬 ${info.title}\n\n⏱ ${info.timestamp}\n👤 ${info.author?.name || "Unknown"}`
            },
            { quoted: msg }
          );
        }

      } catch (e) {
        console.log("API2 failed:", e.message);
      }

      
      try {
        console.log("🟡 Trying API3");

        const API_BASE = "https://space2bnhz.tail9ef80b.ts.net";

        const { data } = await axios.post(
          `${API_BASE}/video/download`,
          { title: info.title },
          { timeout: 120000 }
        );

        if (!data?.file_url) throw new Error("Invalid response");

        const fixedUrl = data.file_url.replace(
          "http://127.0.0.1:5000",
          API_BASE
        );

        const videoBuffer = await downloadBuffer(fixedUrl);

        return await client.sendMessage(
          jid,
          {
            video: videoBuffer,
            caption: `🎬 ${info.title}\n\nDownloaded Successfully`
          },
          { quoted: msg }
        );

      } catch (e) {
        console.log("API3 failed:", e.message);
      }

      return ctx.reply("❌ Failed to download video. Try another link.");

    } catch (err) {
      console.error("Video Command Error:", err);
      return ctx.reply("❌ Unexpected error occurred.");
    }
  }
};
